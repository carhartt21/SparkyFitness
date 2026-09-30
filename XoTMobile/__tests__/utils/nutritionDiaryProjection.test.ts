import {
  projectLocalFoodActions,
  reconciledFoodActions,
} from '../../src/utils/nutritionDiaryProjection';
import type { PendingNutritionAction } from '../../src/services/nutritionActionOutbox';
import type { FoodEntry } from '../../src/types/foodEntries';

const action: PendingNutritionAction = {
  version: 1,
  type: 'logFoodEntry',
  clientOperationId: '33333333-3333-4333-8333-333333333333',
  serverConfigId: 'server-1',
  userId: 'user-1',
  occurredAt: '2026-09-23T10:15:00.000Z',
  createdAt: '2026-09-23T10:16:00.000Z',
  payload: {
    client_operation_id: '33333333-3333-4333-8333-333333333333',
    meal_type_id: 'meal-1',
    quantity: 1,
    unit: 'bar',
    entry_date: '2026-09-23',
    food_name: 'Synthetic bar',
    calories: 200,
  },
  syncState: 'pending',
  retryCount: 0,
  lastAttemptAt: null,
  lastError: null,
  serverIdentity: null,
};

const remote: FoodEntry = {
  id: 'entry-1',
  client_operation_id: action.clientOperationId,
  meal_type: 'Breakfast',
  quantity: 1,
  unit: 'bar',
  entry_date: '2026-09-23',
  serving_size: 1,
  calories: 200,
};

describe('local nutrition diary projection', () => {
  it('shows an offline action only on its original diary day', () => {
    expect(projectLocalFoodActions('2026-09-23', [action], [])).toEqual([
      action,
    ]);
    expect(projectLocalFoodActions('2026-09-24', [action], [])).toEqual([]);
  });

  it('hides the local row when the server row has the same operation ID', () => {
    expect(projectLocalFoodActions('2026-09-23', [action], [remote])).toEqual(
      []
    );
  });

  it('keeps a synced row until it is present in the remote diary', () => {
    const synced = {
      ...action,
      syncState: 'synced' as const,
      serverIdentity: 'entry-1',
    };
    expect(projectLocalFoodActions('2026-09-23', [synced], [])).toEqual([
      synced,
    ]);
    expect(reconciledFoodActions([synced], [])).toEqual([]);
    expect(
      projectLocalFoodActions(
        '2026-09-23',
        [synced],
        [{ ...remote, client_operation_id: null }]
      )
    ).toEqual([]);
    expect(reconciledFoodActions([synced], [remote])).toEqual([synced]);
  });

  it('does not confuse a second food entry with the pending one', () => {
    const unrelated = {
      ...remote,
      id: 'entry-2',
      client_operation_id: 'another-operation',
    };
    expect(
      projectLocalFoodActions('2026-09-23', [action], [unrelated])
    ).toEqual([action]);
  });
});
