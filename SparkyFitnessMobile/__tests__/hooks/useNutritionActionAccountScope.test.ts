import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { MedicationEntry } from '@workspace/shared';
import { useManualWaterActions } from '../../src/hooks/useManualWaterActions';
import { useNutritionDiaryActions } from '../../src/hooks/useNutritionDiaryActions';
import { usePlannedSupplementActions } from '../../src/hooks/usePlannedSupplementActions';
import { useCachedNutritionFavorites } from '../../src/hooks/useCachedNutritionFavorites';
import type {
  NutritionActionIdentity,
  PendingNutritionAction,
  PendingPlannedSupplementAction,
} from '../../src/services/nutritionActionOutbox';
import {
  acknowledgeNutritionActionVisible,
  listNutritionActions,
} from '../../src/services/nutritionActionOutbox';
import type { FoodEntry } from '../../src/types/foodEntries';
import {
  readNutritionFavoriteCache,
  type NutritionFavoriteCache,
} from '../../src/services/nutritionFavoriteCache';

let mockCurrentIdentity: NutritionActionIdentity = {
  serverConfigId: 'server-1',
  userId: 'account-a',
};
const mockIdentityListeners = new Set<() => void>();

jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: () => Promise.resolve(mockCurrentIdentity),
  subscribeNutritionIdentity: (listener: () => void) => {
    mockIdentityListeners.add(listener);
    return () => mockIdentityListeners.delete(listener);
  },
}));
jest.mock('../../src/services/nutritionActionOutbox', () => ({
  listNutritionActions: jest.fn(),
  subscribeNutritionActions: () => () => undefined,
  acknowledgeNutritionActionVisible: jest.fn(),
}));
jest.mock('../../src/services/nutritionFavoriteCache', () => ({
  readNutritionFavoriteCache: jest.fn(),
  subscribeNutritionFavoriteCache: () => () => undefined,
}));

const day = '2026-09-24';
const at = '2026-09-24T10:00:00.000Z';
const common = {
  version: 1 as const,
  serverConfigId: 'server-1',
  userId: 'account-a',
  occurredAt: at,
  createdAt: at,
  syncState: 'pending' as const,
  retryCount: 0,
  lastAttemptAt: null,
  lastError: null,
  serverIdentity: null,
};
const foodId = '11111111-1111-4111-8111-111111111111';
const waterId = '22222222-2222-4222-8222-222222222222';
const supplementId = '33333333-3333-4333-8333-333333333333';
const accountAActions: PendingNutritionAction[] = [
  {
    ...common,
    type: 'logFoodEntry',
    clientOperationId: foodId,
    payload: {
      client_operation_id: foodId,
      meal_type_id: 'meal-1',
      quantity: 1,
      unit: 'serving',
      entry_date: day,
      food_name: 'Account A food',
    },
  },
  {
    ...common,
    type: 'logManualWater',
    clientOperationId: waterId,
    payload: {
      client_operation_id: waterId,
      entry_date: day,
      water_ml: 250,
      logged_at: at,
    },
  },
  {
    ...common,
    type: 'logPlannedSupplement',
    clientOperationId: supplementId,
    payload: {
      client_operation_id: supplementId,
      medication_id: '44444444-4444-4444-8444-444444444444',
      schedule_id: '55555555-5555-4555-8555-555555555555',
      entry_date: day,
      status: 'taken',
      occurred_at: at,
    },
  },
];

const mockListNutritionActions = listNutritionActions as jest.MockedFunction<
  typeof listNutritionActions
>;
const mockAcknowledgeNutritionActionVisible =
  acknowledgeNutritionActionVisible as jest.MockedFunction<
    typeof acknowledgeNutritionActionVisible
  >;
const mockReadFavorites = readNutritionFavoriteCache as jest.MockedFunction<
  typeof readNutritionFavoriteCache
>;
const accountAFavorites: NutritionFavoriteCache = {
  version: 1,
  updatedAt: at,
  foods: [
    {
      id: 'favorite-a',
      name: 'Account A favorite',
      brand: null,
      default_variant: {
        serving_size: 1,
        serving_unit: 'serving',
        calories: 100,
        protein: 1,
        carbs: 2,
        fat: 3,
      },
    },
  ],
  mealTypes: [],
};

describe('account-scoped local nutrition projections', () => {
  beforeEach(() => {
    mockIdentityListeners.clear();
    mockCurrentIdentity = { serverConfigId: 'server-1', userId: 'account-a' };
    mockListNutritionActions.mockReset();
    mockListNutritionActions.mockResolvedValue(accountAActions);
    mockAcknowledgeNutritionActionVisible.mockReset();
    mockAcknowledgeNutritionActionVisible.mockResolvedValue(undefined);
    mockReadFavorites.mockReset();
    mockReadFavorites.mockResolvedValue(accountAFavorites);
  });

  it('hides prior-account food, water, and supplement rows when the next account cannot be read', async () => {
    const { result } = renderHook(() => ({
      food: useNutritionDiaryActions(day, []),
      water: useManualWaterActions(day),
      supplements: usePlannedSupplementActions(day, undefined),
    }));

    await waitFor(() => {
      expect(result.current.food.actions).toHaveLength(1);
      expect(result.current.water.pendingMl).toBe(250);
      expect(result.current.supplements.bySchedule.size).toBe(1);
    });

    mockCurrentIdentity = { serverConfigId: 'server-1', userId: 'account-b' };
    mockListNutritionActions.mockRejectedValue(
      new Error('storage unavailable')
    );
    act(() => {
      for (const listener of mockIdentityListeners) listener();
    });

    expect(result.current.food.actions).toHaveLength(0);
    expect(result.current.water.pendingMl).toBe(0);
    expect(result.current.supplements.bySchedule.size).toBe(0);
    expect(result.current.food.identity).toBeNull();
    expect(result.current.supplements.identity).toBeNull();

    await waitFor(() => {
      expect(result.current.food.storageError).toBe(true);
      expect(result.current.water.storageError).toBe(true);
      expect(result.current.supplements.storageError).toBe(true);
    });

    mockListNutritionActions.mockResolvedValue([]);
    act(() => {
      for (const listener of mockIdentityListeners) listener();
    });
    await waitFor(() => {
      expect(result.current.food.identity?.userId).toBe('account-b');
      expect(result.current.supplements.identity?.userId).toBe('account-b');
      expect(result.current.food.storageError).toBe(false);
      expect(result.current.water.storageError).toBe(false);
      expect(result.current.supplements.storageError).toBe(false);
    });
    expect(result.current.food.actions).toHaveLength(0);
    expect(result.current.water.pendingMl).toBe(0);
    expect(result.current.supplements.bySchedule.size).toBe(0);
  });

  it('does not reconcile an action against a remote diary from a different account', async () => {
    const syncedFood: PendingNutritionAction = {
      ...accountAActions[0],
      syncState: 'synced',
      serverIdentity: 'entry-a',
    };
    mockListNutritionActions.mockResolvedValue([syncedFood]);
    const remote: FoodEntry[] = [
      {
        id: 'entry-a',
        client_operation_id: foodId,
        meal_type: 'Breakfast',
        quantity: 1,
        unit: 'serving',
        entry_date: day,
        serving_size: 1,
        calories: 100,
      },
    ];
    const scopeA = JSON.stringify(['server-1', 'account-a']);
    const scopeB = JSON.stringify(['server-1', 'account-b']);
    const { result, rerender } = renderHook(
      ({ scope }) => useNutritionDiaryActions(day, remote, scope),
      { initialProps: { scope: scopeB } }
    );

    await waitFor(() =>
      expect(result.current.identity?.userId).toBe('account-a')
    );
    expect(result.current.actions).toHaveLength(1);
    expect(mockAcknowledgeNutritionActionVisible).not.toHaveBeenCalled();

    rerender({ scope: scopeA });
    await waitFor(() => {
      expect(result.current.actions).toHaveLength(0);
      expect(mockAcknowledgeNutritionActionVisible).toHaveBeenCalledWith(
        mockCurrentIdentity,
        foodId,
        'entry-a'
      );
    });
  });

  it('hands a synced supplement row to the visible server entry without waiting for local cleanup', async () => {
    const initialSupplement = accountAActions[2];
    if (initialSupplement.type !== 'logPlannedSupplement') {
      throw new Error('Expected planned supplement action');
    }
    const syncedSupplement: PendingPlannedSupplementAction = {
      ...initialSupplement,
      syncState: 'synced',
      serverIdentity: 'entry-a',
    };
    mockListNutritionActions.mockResolvedValue([syncedSupplement]);
    const remoteEntry: MedicationEntry = {
      id: 'entry-a',
      medication_id: syncedSupplement.payload.medication_id,
      schedule_id: syncedSupplement.payload.schedule_id,
      user_id: 'account-a',
      status: 'taken',
      taken_at: at,
      scheduled_for: null,
      entry_date: day,
      med_name_snapshot: null,
      dose_amount_snapshot: null,
      dose_unit_snapshot: null,
      notes: null,
      source: 'reminder',
      custom_fields: {},
      created_at: at,
      updated_at: at,
    };
    const { result, rerender } = renderHook(
      ({ remoteEntries }: { remoteEntries: MedicationEntry[] }) =>
        usePlannedSupplementActions(day, remoteEntries),
      { initialProps: { remoteEntries: [] as MedicationEntry[] } }
    );

    await waitFor(() => expect(result.current.bySchedule.size).toBe(1));

    rerender({ remoteEntries: [{ ...remoteEntry, user_id: 'account-b' }] });
    expect(result.current.bySchedule.size).toBe(1);
    expect(mockAcknowledgeNutritionActionVisible).not.toHaveBeenCalled();

    rerender({ remoteEntries: [remoteEntry] });
    expect(result.current.bySchedule.size).toBe(0);
    await waitFor(() =>
      expect(mockAcknowledgeNutritionActionVisible).toHaveBeenCalledWith(
        mockCurrentIdentity,
        supplementId,
        remoteEntry.id
      )
    );
  });

  it('hides prior-account favorites if the next account cache cannot be read', async () => {
    const { result } = renderHook(() => useCachedNutritionFavorites());
    await waitFor(() =>
      expect(result.current.cache?.foods[0]?.name).toBe('Account A favorite')
    );

    mockCurrentIdentity = { serverConfigId: 'server-1', userId: 'account-b' };
    mockReadFavorites.mockRejectedValue(new Error('storage unavailable'));
    act(() => {
      for (const listener of mockIdentityListeners) listener();
    });

    expect(result.current.cache).toBeNull();
    await waitFor(() => expect(result.current.storageError).toBe(true));
    expect(result.current.cache).toBeNull();

    mockReadFavorites.mockResolvedValue({
      ...accountAFavorites,
      foods: [],
    });
    act(() => {
      for (const listener of mockIdentityListeners) listener();
    });
    await waitFor(() => expect(result.current.storageError).toBe(false));
    expect(result.current.cache?.foods).toEqual([]);
  });
});
