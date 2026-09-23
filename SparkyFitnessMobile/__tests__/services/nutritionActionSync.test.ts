import {
  reconcileNutritionActions,
  type NutritionSyncDependencies,
} from '../../src/services/nutritionActionSync';
import type {
  PendingNutritionAction,
  NutritionActionIdentity,
} from '../../src/services/nutritionActionOutbox';
import { ApiError } from '../../src/services/api/errors';

const identity: NutritionActionIdentity = {
  serverConfigId: 'server-a',
  userId: 'user-a',
};

function foodAction(id: string): PendingNutritionAction {
  return {
    version: 1,
    type: 'logFoodEntry',
    clientOperationId: id,
    ...identity,
    occurredAt: '2026-09-23T12:00:00.000Z',
    createdAt: '2026-09-23T12:00:00.000Z',
    payload: {
      client_operation_id: id,
      meal_type_id: 'lunch',
      quantity: 1,
      unit: 'serving',
      entry_date: '2026-09-23',
      food_name: 'Synthetic food',
    },
    syncState: 'pending',
    retryCount: 0,
    lastAttemptAt: null,
    lastError: null,
    serverIdentity: null,
  };
}

function harness(actions: PendingNutritionAction[]) {
  const rows = new Map(
    actions.map((action) => [action.clientOperationId, action])
  );
  const createEntry = jest.fn().mockImplementation(async (payload) => ({
    id: `server-${payload.client_operation_id}`,
  }));
  const deps = {
    getIdentity: jest.fn().mockResolvedValue(identity),
    getServerConfigId: jest.fn().mockResolvedValue(identity.serverConfigId),
    fetchProfile: jest.fn().mockResolvedValue({ id: identity.userId }),
    listPending: jest
      .fn()
      .mockImplementation(async () =>
        [...rows.values()].filter(
          (row) => row.syncState === 'pending' || row.syncState === 'syncing'
        )
      ),
    markSyncing: jest.fn().mockImplementation(async (_owner, id) => {
      const next = { ...rows.get(id)!, syncState: 'syncing' as const };
      rows.set(id, next);
      return next;
    }),
    markPending: jest.fn().mockImplementation(async (_owner, id, reason) => {
      const next = {
        ...rows.get(id)!,
        syncState: 'pending' as const,
        lastError: reason,
      };
      rows.set(id, next);
      return next;
    }),
    markAttention: jest.fn().mockImplementation(async (_owner, id, reason) => {
      const next = {
        ...rows.get(id)!,
        syncState: 'attentionRequired' as const,
        lastError: reason,
      };
      rows.set(id, next);
      return next;
    }),
    markSynced: jest.fn().mockImplementation(async (_owner, id, serverId) => {
      const next = {
        ...rows.get(id)!,
        syncState: 'synced' as const,
        serverIdentity: serverId,
      };
      rows.set(id, next);
      return next;
    }),
    createEntry,
    createCapture: jest.fn().mockResolvedValue({ id: 'capture-1' }),
    uploadCaptureImage: jest.fn().mockResolvedValue({ id: 'image-1' }),
  } as unknown as NutritionSyncDependencies;
  return { rows, deps, createEntry };
}

describe('nutrition action reconciliation', () => {
  test('submits a stable operation ID and acknowledges the server identity', async () => {
    const id = 'd4d56c1e-d55e-458c-99f7-fc7b2a53d700';
    const { rows, deps, createEntry } = harness([foodAction(id)]);
    const result = await reconcileNutritionActions(undefined, deps);
    expect(result).toEqual({ processed: 1, nextDelayMs: null });
    expect(createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ client_operation_id: id })
    );
    expect(rows.get(id)?.serverIdentity).toBe(`server-${id}`);
    expect(rows.get(id)?.syncState).toBe('synced');
    await reconcileNutritionActions(undefined, deps);
    expect(createEntry).toHaveBeenCalledTimes(1);
  });

  test('lost response keeps action and retry reuses the same operation ID', async () => {
    const id = '036c8cf7-18de-483d-ac2b-5136b97c8800';
    const { rows, deps, createEntry } = harness([foodAction(id)]);
    createEntry.mockRejectedValueOnce(new Error('response lost'));
    expect(await reconcileNutritionActions(undefined, deps)).toEqual({
      processed: 1,
      nextDelayMs: 2000,
    });
    expect(rows.get(id)?.syncState).toBe('pending');
    await reconcileNutritionActions(undefined, deps);
    expect(createEntry).toHaveBeenCalledTimes(2);
    expect(createEntry.mock.calls[0][0].client_operation_id).toBe(id);
    expect(createEntry.mock.calls[1][0].client_operation_id).toBe(id);
  });

  test('different signed-in user cannot receive the saved action', async () => {
    const { deps, createEntry } = harness([foodAction('op-1')]);
    (deps.fetchProfile as jest.Mock).mockResolvedValue({ id: 'user-b' });
    expect(await reconcileNutritionActions(undefined, deps)).toEqual({
      processed: 0,
      nextDelayMs: null,
    });
    expect(createEntry).not.toHaveBeenCalled();
  });

  test('a recent failure waits for backoff and a recovered action resumes', async () => {
    const delayed = {
      ...foodAction('op-delayed'),
      retryCount: 3,
      lastAttemptAt: '2026-09-23T12:00:00.000Z',
    };
    const { deps, createEntry } = harness([delayed]);
    expect(
      await reconcileNutritionActions(undefined, deps, () =>
        Date.parse('2026-09-23T12:00:01.000Z')
      )
    ).toEqual({ processed: 0, nextDelayMs: 7000 });
    expect(createEntry).not.toHaveBeenCalled();
    await reconcileNutritionActions(undefined, deps, () =>
      Date.parse('2026-09-23T12:00:09.000Z')
    );
    expect(createEntry).toHaveBeenCalledTimes(1);
  });

  test('server switch during a request leaves action for safe replay', async () => {
    const { rows, deps, createEntry } = harness([foodAction('op-switch')]);
    createEntry.mockImplementationOnce(async () => {
      (deps.getServerConfigId as jest.Mock).mockResolvedValue('server-b');
      return { id: 'server-op-switch' };
    });
    await reconcileNutritionActions(undefined, deps);
    expect(rows.get('op-switch')?.syncState).toBe('syncing');
    expect(deps.markSynced).not.toHaveBeenCalled();
  });

  test('validation errors require attention; authentication failures pause replay', async () => {
    const first = harness([foodAction('op-1')]);
    first.createEntry.mockRejectedValue(new ApiError('invalid', 422));
    await reconcileNutritionActions(undefined, first.deps);
    expect(first.rows.get('op-1')?.syncState).toBe('attentionRequired');
    expect(first.rows.get('op-1')?.lastError).toBe('validation');

    const second = harness([foodAction('op-2'), foodAction('op-3')]);
    second.createEntry.mockRejectedValueOnce(new ApiError('expired', 401));
    await reconcileNutritionActions(undefined, second.deps);
    expect(second.rows.get('op-2')?.syncState).toBe('pending');
    expect(second.rows.get('op-2')?.lastError).toBe('auth');
    expect(second.createEntry).toHaveBeenCalledTimes(1);
  });

  test('parallel triggers share one pass', async () => {
    const { deps, createEntry } = harness([foodAction('op-1')]);
    const [first, second] = await Promise.all([
      reconcileNutritionActions(undefined, deps),
      reconcileNutritionActions(undefined, deps),
    ]);
    expect(first).toEqual(second);
    expect(createEntry).toHaveBeenCalledTimes(1);
  });

  test('photo capture is acknowledged only after every idempotent image upload', async () => {
    const id = '281fe77f-2d74-43aa-8f35-c47aa106d6e7';
    const imageId = '162242cb-e405-481a-84da-e15d3d2c563e';
    const photo = {
      ...foodAction(id),
      type: 'createPhotoEntry' as const,
      payload: {
        id,
        capturedAt: '2026-09-23T12:00:00.000Z',
        consumedAt: '2026-09-23T12:00:00.000Z',
        entryDate: '2026-09-23',
        images: [{ id: imageId, uri: 'file:///documents/meal.jpg' }],
      },
    };
    const { rows, deps } = harness([photo]);
    (deps.createCapture as jest.Mock).mockResolvedValue({ id });
    (deps.uploadCaptureImage as jest.Mock).mockRejectedValueOnce(
      new Error('response lost')
    );
    await reconcileNutritionActions(undefined, deps);
    expect(rows.get(id)?.syncState).toBe('pending');
    expect(deps.markSynced).not.toHaveBeenCalled();
    await reconcileNutritionActions(undefined, deps);
    expect(deps.createCapture).toHaveBeenCalledTimes(2);
    expect(deps.uploadCaptureImage).toHaveBeenCalledTimes(2);
    expect(deps.uploadCaptureImage).toHaveBeenCalledWith(id, {
      id: imageId,
      uri: 'file:///documents/meal.jpg',
    });
    expect(rows.get(id)?.syncState).toBe('synced');
  });
});
