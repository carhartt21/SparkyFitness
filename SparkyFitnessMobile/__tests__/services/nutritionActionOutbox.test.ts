import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NutritionOutboxCorruptError,
  acknowledgeNutritionActionVisible,
  enqueueFoodEntry,
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
});
