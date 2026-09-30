let mockUuidIndex = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    `00000000-0000-4000-8000-${String(++mockUuidIndex).padStart(12, '0')}`,
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/services/api/apiClient';
import { ApiError } from '../../src/services/api/errors';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import {
  saveMobilityRoutine,
  synchronizeMobility,
  getMobilityState,
  startMobilitySession,
  applyMobilitySessionAction,
  deleteMobilitySessionHistory,
} from '../../src/services/mobilityRoutineStore';
import type { MobilityOperation } from '@workspace/shared';
jest.mock('../../src/services/api/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
const identity = {
  serverConfigId: 'synthetic-server',
  userId: 'synthetic-user',
};
const empty = {
  timezone: 'Europe/Berlin',
  routines: [],
  schedules: [],
  plans: [],
  sessions: [],
};
const draft = {
  name: 'Synthetic mobility',
  cue: 'off' as const,
  steps: [
    {
      name: 'Reach',
      instructions: '',
      side: 'both' as const,
      kind: 'timed' as const,
      durationSeconds: 30,
      transitionSeconds: 0,
    },
  ],
};
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
});
it('retains a stable operation ID after a lost response, preserving original identifiers and timestamps', async () => {
  const routine = await saveMobilityRoutine(
    identity,
    draft,
    new Date('2026-09-30T10:00:00Z')
  );
  jest.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
  await expect(synchronizeMobility(identity)).rejects.toThrow('offline');
  const queued = (await getMobilityState(identity)).pendingOperations[0];
  expect(queued.mutation).toMatchObject({
    data: { id: routine.id, createdAt: '2026-09-30T10:00:00.000Z' },
  });
  jest
    .mocked(apiFetch)
    .mockResolvedValueOnce({ revision: 1 })
    .mockResolvedValueOnce({
      ...empty,
      routines: [{ revision: 1, data: routine, deleted: false }],
    });
  await synchronizeMobility(identity);
  expect(jest.mocked(apiFetch).mock.calls[1][0].body).toEqual(queued);
  expect((await getMobilityState(identity)).pendingOperations).toEqual([]);
});
it('keeps a conflicting local routine until explicitly resolved', async () => {
  await saveMobilityRoutine(identity, draft);
  jest
    .mocked(apiFetch)
    .mockRejectedValueOnce(new ApiError('conflict', 409))
    .mockResolvedValueOnce(empty);
  await synchronizeMobility(identity);
  const state = await getMobilityState(identity);
  expect(state.conflicts).toHaveLength(1);
  expect(state.routines).toHaveLength(1);
  expect(state.syncError).toBe('conflict');
});
it('does not send old-account operations after the active account changes', async () => {
  await saveMobilityRoutine(identity, draft);
  jest
    .mocked(getActiveNutritionIdentity)
    .mockResolvedValue({ ...identity, userId: 'other' });
  await synchronizeMobility(identity);
  expect(apiFetch).not.toHaveBeenCalled();
});
it('preserves an active local timer while merging remote history', async () => {
  const routine = await saveMobilityRoutine(identity, draft);
  const session = await startMobilitySession(identity, routine.id);
  jest.mocked(apiFetch).mockImplementation(async (request) =>
    request.method === 'POST'
      ? { revision: 1 }
      : {
          ...empty,
          routines: [{ revision: 1, data: routine, deleted: false }],
        }
  );
  await synchronizeMobility(identity);
  expect((await getMobilityState(identity)).activeSession?.id).toBe(session.id);
  const mutations = jest
    .mocked(apiFetch)
    .mock.calls.filter(([request]) => request.method === 'POST')
    .map(([request]) => request.body as MobilityOperation);
  expect(
    mutations.some(
      (op) =>
        op.mutation.kind === 'session' && op.mutation.data.id === session.id
    )
  ).toBe(true);
});

it('retains server history when the 101st session trims local history; only explicit deletion queues a tombstone', async () => {
  const routine = await saveMobilityRoutine(identity, draft);
  for (let i = 0; i < 101; i++) {
    const session = await startMobilitySession(
      identity,
      routine.id,
      new Date(1_790_764_800_000 + i * 60_000)
    );
    await applyMobilitySessionAction(identity, session.id, 'complete-step');
  }
  let state = await getMobilityState(identity);
  expect(state.history).toHaveLength(100);
  expect(
    state.pendingOperations.filter(
      (op) => op.mutation.kind === 'session' && op.mutation.deleted
    )
  ).toHaveLength(0);
  const removed = state.history[10];
  await deleteMobilitySessionHistory(identity, removed.id);
  state = await getMobilityState(identity);
  const deletes = state.pendingOperations.filter(
    (op) => op.mutation.kind === 'session' && op.mutation.deleted
  );
  expect(deletes).toHaveLength(1);
  expect(deletes[0].mutation).toMatchObject({
    data: { id: removed.id },
    deleted: true,
  });
});
it('persists the linked plan revision from an acknowledgement even if the later snapshot fetch is offline', async () => {
  const routine = await saveMobilityRoutine(identity, draft);
  const plan = {
    revision: 1,
    deleted: false,
    data: {
      id: '00000000-0000-4000-8000-999999999999',
      routine,
      scheduleId: null,
      day: '2026-09-30',
      time: '18:00',
      state: 'planned',
      activeSessionId: null,
    },
  };
  jest.mocked(apiFetch).mockImplementation(async (request) =>
    request.method === 'POST'
      ? { revision: 1 }
      : {
          ...empty,
          plans: [plan],
          routines: [{ revision: 1, data: routine, deleted: false }],
        }
  );
  await synchronizeMobility(identity);
  const session = await startMobilitySession(
    identity,
    routine.id,
    new Date('2026-09-30T10:00:00Z'),
    plan.data.id
  );
  jest.mocked(apiFetch).mockImplementation(async (request) => {
    if (request.method === 'POST')
      return {
        revision: 1,
        plan: {
          ...plan,
          revision: 2,
          data: { ...plan.data, state: 'active', activeSessionId: session.id },
        },
      };
    throw new Error('offline');
  });
  await expect(synchronizeMobility(identity)).rejects.toThrow('offline');
  const state = await getMobilityState(identity);
  expect(state.plans[0]).toMatchObject({
    revision: 2,
    data: { state: 'active', activeSessionId: session.id },
  });
  expect(state.revisions[`plan:${plan.data.id}`]).toBe(2);
});
