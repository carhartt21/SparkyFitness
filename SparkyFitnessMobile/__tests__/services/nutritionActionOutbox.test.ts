import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'cbb275a8-8d2a-4514-a6e2-0fb864452293'),
}));
import {
  NutritionOutboxCorruptError,
  acknowledgeNutritionActionVisible,
  enqueueFoodEntry,
  enqueueManualWaterAction,
  enqueueContainerWaterAction,
  enqueuePlannedSupplementAction,
  discardRejectedPlannedSupplementAction,
  enqueuePhotoCompletion,
  listNutritionActions,
  listPendingNutritionActions,
  markNutritionActionAttentionRequired,
  markNutritionActionPending,
  markNutritionActionSynced,
  markNutritionActionSyncing,
  retryNutritionAction,
  subscribeNutritionActions,
} from '../../src/services/nutritionActionOutbox';

const identity = { serverConfigId: 'server-1', userId: 'user-1' };
const operation = '33333333-3333-4333-8333-333333333333';
const payload = {
  meal_type_id: 'meal-1',
  food_id: 'food-1',
  variant_id: 'variant-1',
  quantity: 1,
  unit: 'bar',
  entry_date: '2026-09-23',
  food_name: 'Synthetic bar',
  calories: 200,
  protein: 20,
  carbs: 18,
  fat: 5,
};

const input = {
  ...identity,
  clientOperationId: operation,
  occurredAt: '2026-09-23T10:15:00.000Z',
  payload,
};

describe('nutrition action outbox', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('durably stores an immutable snapshot and original occurrence time', async () => {
    const action = await enqueueFoodEntry(input);
    expect(action.clientOperationId).toBe(operation);
    expect(action.payload.client_operation_id).toBe(operation);
    expect(action.occurredAt).toBe('2026-09-23T10:15:00.000Z');
    expect(action.syncState).toBe('pending');
    expect(
      (await AsyncStorage.getAllKeys()).some((key) => key.includes(operation))
    ).toBe(true);
    expect(await listPendingNutritionActions(identity)).toEqual([action]);
  });

  it('keeps one immutable plain-water action across retries', async () => {
    const waterInput = {
      ...identity,
      clientOperationId: operation,
      entryDate: '2026-09-23',
      waterMl: 250,
      loggedAt: '2026-09-23T10:15:00.000Z',
    };
    const first = await enqueueManualWaterAction(waterInput);
    expect(first.payload.client_operation_id).toBe(operation);
    expect(await enqueueManualWaterAction(waterInput)).toEqual(first);
    await expect(
      enqueueManualWaterAction({ ...waterInput, waterMl: 500 })
    ).rejects.toThrow('another action');
    expect(await listPendingNutritionActions(identity)).toEqual([first]);
  });

  it('retries an attention-required water action with its original operation and payload', async () => {
    const first = await enqueueManualWaterAction({
      ...identity,
      clientOperationId: operation,
      entryDate: '2026-09-23',
      waterMl: 250,
      loggedAt: '2026-09-23T10:15:00.000Z',
    });
    await markNutritionActionAttentionRequired(
      identity,
      operation,
      'validation'
    );

    const retried = await retryNutritionAction(identity, operation);
    expect(retried.syncState).toBe('pending');
    expect(retried.clientOperationId).toBe(first.clientOperationId);
    expect(retried.payload).toEqual(first.payload);

    await markNutritionActionSynced(identity, operation, 'water-entry-1');
    const afterSync = await retryNutritionAction(identity, operation);
    expect(afterSync.syncState).toBe('synced');
    expect(await listPendingNutritionActions(identity)).toEqual([]);
  });

  it('persists the original container, day and time and rejects a changed replay', async () => {
    const waterInput = {
      ...identity,
      clientOperationId: operation,
      entryDate: '2026-09-23',
      containerId: 12,
      loggedAt: '2026-09-23T10:15:00.000Z',
    };
    const first = await enqueueContainerWaterAction(waterInput);
    expect(first.type).toBe('logContainerWater');
    expect(first.payload.client_operation_id).toBe(operation);
    expect(await enqueueContainerWaterAction(waterInput)).toEqual(first);
    await expect(
      enqueueContainerWaterAction({ ...waterInput, containerId: 13 })
    ).rejects.toThrow('another action');
    expect(await listPendingNutritionActions(identity)).toEqual([first]);
  });

  it('keeps one supplement response per schedule and day within each account', async () => {
    const supplementInput = {
      ...identity,
      medicationId: '11111111-1111-4111-8111-111111111111',
      scheduleId: '22222222-2222-4222-8222-222222222222',
      entryDate: '2026-09-23',
      status: 'taken' as const,
      occurredAt: '2026-09-23T10:15:00.000Z',
    };
    const first = await enqueuePlannedSupplementAction(supplementInput);
    const repeated = await enqueuePlannedSupplementAction({
      ...supplementInput,
      occurredAt: '2026-09-23T10:16:00.000Z',
    });
    expect(repeated).toEqual(first);
    expect(first.payload.client_operation_id).toBe(first.clientOperationId);
    await expect(
      enqueuePlannedSupplementAction({ ...supplementInput, status: 'skipped' })
    ).rejects.toThrow('already has a response');
    expect(await listNutritionActions(identity)).toHaveLength(1);
    expect(
      await listNutritionActions({ ...identity, userId: 'other-user' })
    ).toEqual([]);
  });

  it('clears only a rejected supplement response after explicit repair', async () => {
    const action = await enqueuePlannedSupplementAction({
      ...identity,
      medicationId: '11111111-1111-4111-8111-111111111111',
      scheduleId: '22222222-2222-4222-8222-222222222222',
      entryDate: '2026-09-23',
      status: 'skipped',
      occurredAt: '2026-09-23T10:15:00.000Z',
    });
    expect(
      await discardRejectedPlannedSupplementAction(
        identity,
        action.clientOperationId
      )
    ).toBe(false);
    await markNutritionActionAttentionRequired(
      identity,
      action.clientOperationId,
      'validation'
    );
    expect(
      await discardRejectedPlannedSupplementAction(
        { ...identity, userId: 'other-user' },
        action.clientOperationId
      )
    ).toBe(false);
    expect(
      await discardRejectedPlannedSupplementAction(
        identity,
        action.clientOperationId
      )
    ).toBe(true);
    expect(await listNutritionActions(identity)).toEqual([]);
  });

  it('accepts a three-decimal water volume and rejects extra precision', async () => {
    const waterInput = {
      ...identity,
      clientOperationId: operation,
      entryDate: '2026-09-23',
      waterMl: 1.001,
      loggedAt: '2026-09-23T10:15:00.000Z',
    };
    await enqueueManualWaterAction(waterInput);
    await expect(
      enqueueManualWaterAction({
        ...waterInput,
        clientOperationId: '44444444-4444-4444-8444-444444444444',
        waterMl: 1.0001,
      })
    ).rejects.toThrow();
  });

  it('does not invent zero nutrition for unknown values', async () => {
    const action = await enqueueFoodEntry({
      ...input,
      payload: {
        meal_type_id: payload.meal_type_id,
        food_name: 'Unknown nutrition',
        quantity: 1,
        unit: 'serving',
        entry_date: payload.entry_date,
      },
    });
    expect(action.payload.calories).toBeUndefined();
    expect(action.payload.protein).toBeUndefined();
  });

  it('deduplicates the same operation and rejects a changed payload', async () => {
    const first = await enqueueFoodEntry(input);
    expect(await enqueueFoodEntry(input)).toEqual(first);
    await expect(
      enqueueFoodEntry({ ...input, payload: { ...payload, calories: 999 } })
    ).rejects.toThrow('different food action');
    expect(await listNutritionActions(identity)).toHaveLength(1);
  });

  it('partitions actions by server and user', async () => {
    await enqueueFoodEntry(input);
    expect(
      await listNutritionActions({
        serverConfigId: 'server-2',
        userId: 'user-1',
      })
    ).toEqual([]);
    expect(
      await listNutritionActions({
        serverConfigId: 'server-1',
        userId: 'user-2',
      })
    ).toEqual([]);
    await enqueueFoodEntry({ ...input, serverConfigId: 'server-2' });
    expect(await listNutritionActions(identity)).toHaveLength(1);
  });

  it('persists state transitions and removes only after matching reconciliation', async () => {
    await enqueueFoodEntry(input);
    const syncing = await markNutritionActionSyncing(identity, operation);
    expect(syncing.retryCount).toBe(1);
    expect(syncing.lastAttemptAt).not.toBeNull();
    expect(await listPendingNutritionActions(identity)).toHaveLength(1);
    await markNutritionActionPending(identity, operation, 'network');
    await markNutritionActionAttentionRequired(
      identity,
      operation,
      'validation'
    );
    expect(await listPendingNutritionActions(identity)).toHaveLength(0);
    await retryNutritionAction(identity, operation);
    const synced = await markNutritionActionSynced(
      identity,
      operation,
      'entry-1'
    );
    expect(synced.serverIdentity).toBe('entry-1');
    expect(
      await acknowledgeNutritionActionVisible(
        identity,
        operation,
        'wrong-entry'
      )
    ).toBe(false);
    expect(await listNutritionActions(identity)).toHaveLength(1);
    expect(
      await acknowledgeNutritionActionVisible(identity, operation, 'entry-1')
    ).toBe(true);
    expect(await listNutritionActions(identity)).toEqual([]);
  });

  it('does not report capture success if the durable write fails', async () => {
    jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('disk full'));
    await expect(enqueueFoodEntry(input)).rejects.toThrow('disk full');
    expect(await listNutritionActions(identity)).toEqual([]);
  });

  it('notifies diary subscribers only after a durable change', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeNutritionActions(listener);
    await enqueueFoodEntry(input);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    await markNutritionActionSyncing(identity, operation);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('preserves and reports malformed or future-version actions', async () => {
    const key = `@SparkyFitness/nutrition-action/v1/server-1/user-1/${operation}`;
    await AsyncStorage.setItem(key, JSON.stringify({ version: 2 }));
    await expect(listNutritionActions(identity)).rejects.toBeInstanceOf(
      NutritionOutboxCorruptError
    );
    expect(await AsyncStorage.getItem(key)).not.toBeNull();
  });

  it('refuses extra payload fields that could include credentials', async () => {
    await expect(
      enqueueFoodEntry({
        ...input,
        payload: Object.assign({}, payload, { apiKey: 'must-not-persist' }),
      })
    ).rejects.toThrow();
    expect(await listNutritionActions(identity)).toEqual([]);
  });

  it('keeps one durable completion operation for a captured occurrence', async () => {
    const completion = {
      ...identity,
      occurredAt: '2026-09-23T10:15:00.000Z',
      payload: {
        captureId: '281fe77f-2d74-43aa-8f35-c47aa106d6e7',
        entryDate: '2026-09-23',
        food: {
          meal_type_id: 'lunch',
          quantity: 1,
          unit: 'serving',
          food_name: 'Synthetic lunch',
          serving_size: 1,
          serving_unit: 'serving',
          calories: 300,
        },
      },
    };
    const first = await enqueuePhotoCompletion(completion);
    const repeated = await enqueuePhotoCompletion({
      ...completion,
      payload: {
        ...completion.payload,
        food: { ...completion.payload.food, calories: 400 },
      },
    });
    expect(repeated.clientOperationId).toBe(first.clientOperationId);
    expect(repeated.payload.food.calories).toBe(300);
    expect(await listNutritionActions(identity)).toHaveLength(1);
    expect(
      (await AsyncStorage.getAllKeys()).some((key) =>
        key.includes(first.clientOperationId)
      )
    ).toBe(true);
  });
});
