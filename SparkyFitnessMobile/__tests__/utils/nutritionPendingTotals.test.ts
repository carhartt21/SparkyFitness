import {
  getPendingNutritionTotals,
  projectPendingNutritionSummary,
} from '../../src/utils/nutritionPendingTotals';
import type {
  PendingFoodAction,
  PendingPhotoCompletionAction,
} from '../../src/services/nutritionActionOutbox';
import type { DailySummary } from '../../src/types/dailySummary';
import type { FoodEntry } from '../../src/types/foodEntries';

const food: PendingFoodAction = {
  version: 1,
  type: 'logFoodEntry',
  clientOperationId: '11111111-1111-4111-8111-111111111111',
  serverConfigId: 'server-1',
  userId: 'user-1',
  occurredAt: '2026-09-23T10:00:00.000Z',
  createdAt: '2026-09-23T10:00:01.000Z',
  syncState: 'pending',
  retryCount: 0,
  lastAttemptAt: null,
  lastError: null,
  serverIdentity: null,
  payload: {
    client_operation_id: '11111111-1111-4111-8111-111111111111',
    meal_type_id: 'meal-1',
    entry_date: '2026-09-23',
    quantity: 42,
    unit: 'g',
    serving_size: 100,
    serving_unit: 'g',
    food_name: 'Synthetic bread',
    calories: 250,
    protein: 20,
    carbs: 40,
    fat: 5,
  },
};

const completion: PendingPhotoCompletionAction = {
  ...food,
  type: 'completePhotoEntry',
  clientOperationId: '22222222-2222-4222-8222-222222222222',
  payload: {
    captureId: '33333333-3333-4333-8333-333333333333',
    entryDate: '2026-09-23',
    food: {
      meal_type_id: 'meal-1',
      quantity: 1,
      unit: 'serving',
      serving_size: 1,
      serving_unit: 'serving',
      food_name: 'Synthetic meal',
      calories: 180,
      protein: 12,
    },
  },
};

describe('pending nutrition totals', () => {
  it('scales known snapshot nutrients by amount without rounding or inventing missing macros', () => {
    expect(getPendingNutritionTotals([food], [], [])).toEqual({
      calories: 105,
      protein: 8.4,
      carbs: 16.8,
      fat: 2.1,
      fiber: 0,
      knownEnergyCount: 1,
      unknownEnergyCount: 0,
    });
  });

  it('distinguishes unknown calories from a known zero and keeps incomplete food visible', () => {
    const unknown = {
      ...food,
      payload: {
        ...food.payload,
        calories: undefined,
        serving_size: undefined,
      },
    };
    const knownZero = {
      ...food,
      clientOperationId: '44444444-4444-4444-8444-444444444444',
      payload: { ...food.payload, calories: 0 },
    };
    const result = getPendingNutritionTotals([unknown, knownZero], [], []);
    expect(result.calories).toBe(0);
    expect(result.knownEnergyCount).toBe(1);
    expect(result.unknownEnergyCount).toBe(1);
  });

  it('counts a pending photo completion until the linked server food is visible', () => {
    expect(getPendingNutritionTotals([], [completion], []).calories).toBe(180);
    const visible = {
      id: 'entry-1',
      client_operation_id: completion.clientOperationId,
      nutrition_capture_id: completion.payload.captureId,
    } as FoodEntry;
    expect(
      getPendingNutritionTotals([], [completion], [visible]).calories
    ).toBe(0);
  });

  it('does not double count a food action after the server diary receives it', () => {
    const visible = {
      id: 'entry-1',
      client_operation_id: food.clientOperationId,
    } as FoodEntry;
    expect(
      getPendingNutritionTotals([food], [], [visible]).knownEnergyCount
    ).toBe(0);
  });

  it('adds only pending intake to the server goal and exercise summary', () => {
    const summary = {
      caloriesConsumed: 1000,
      netCalories: 800,
      remainingCalories: 1200,
      protein: { consumed: 70, goal: 120 },
      carbs: { consumed: 90, goal: 0 },
      fat: { consumed: 30, goal: 0 },
      fiber: { consumed: 15, goal: 0 },
      calorieBalance: {
        eaten: 1000,
        burned: 200,
        net: 800,
        remaining: 1200,
        goal: 2000,
        progress: 40,
        bmr: 0,
        exerciseSource: 'logged',
        tdeeProjection: null,
      },
    } as DailySummary;
    const projected = projectPendingNutritionSummary(
      summary,
      getPendingNutritionTotals([food], [], [])
    );
    expect(projected.caloriesConsumed).toBe(1105);
    expect(projected.calorieBalance.remaining).toBe(1095);
    expect(projected.calorieBalance.progress).toBeCloseTo(45.25);
    expect(projected.protein.consumed).toBeCloseTo(78.4);
    expect(summary.calorieBalance.eaten).toBe(1000);
  });
});
