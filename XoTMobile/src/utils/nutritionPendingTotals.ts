import type {
  PendingFoodAction,
  PendingPhotoCompletionAction,
} from '../services/nutritionActionOutbox';
import type { DailySummary } from '../types/dailySummary';
import type { FoodEntry } from '../types/foodEntries';

export interface PendingNutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  knownEnergyCount: number;
  unknownEnergyCount: number;
}

const emptyTotals = (): PendingNutritionTotals => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  knownEnergyCount: 0,
  unknownEnergyCount: 0,
});

/** Only actions absent from the server diary contribute to its local overlay. */
export function getPendingNutritionTotals(
  foods: PendingFoodAction[],
  completions: PendingPhotoCompletionAction[],
  remote: FoodEntry[]
): PendingNutritionTotals {
  const totals = emptyTotals();
  const remoteOperations = new Set(
    remote.flatMap((entry) =>
      entry.client_operation_id ? [entry.client_operation_id] : []
    )
  );
  const remoteCaptures = new Set(
    remote.flatMap((entry) =>
      entry.nutrition_capture_id ? [entry.nutrition_capture_id] : []
    )
  );
  const add = (snapshot: {
    quantity: number;
    serving_size?: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    dietary_fiber?: number;
  }) => {
    const factor =
      snapshot.serving_size && snapshot.serving_size > 0
        ? snapshot.quantity / snapshot.serving_size
        : null;
    if (factor === null || snapshot.calories === undefined) {
      totals.unknownEnergyCount += 1;
    } else {
      totals.calories += snapshot.calories * factor;
      totals.knownEnergyCount += 1;
    }
    if (factor === null) return;
    totals.protein += (snapshot.protein ?? 0) * factor;
    totals.carbs += (snapshot.carbs ?? 0) * factor;
    totals.fat += (snapshot.fat ?? 0) * factor;
    totals.fiber += (snapshot.dietary_fiber ?? 0) * factor;
  };
  for (const action of foods) {
    if (remoteOperations.has(action.clientOperationId)) continue;
    if (
      action.serverIdentity &&
      remote.some((entry) => entry.id === action.serverIdentity)
    )
      continue;
    add(action.payload);
  }
  for (const action of completions) {
    if (
      remoteOperations.has(action.clientOperationId) ||
      remoteCaptures.has(action.payload.captureId)
    )
      continue;
    add(action.payload.food);
  }
  return totals;
}

/** Preserve server goal/exercise calculations while overlaying unsynced intake. */
export function projectPendingNutritionSummary(
  summary: DailySummary,
  pending: PendingNutritionTotals
): DailySummary {
  const calories = pending.calories;
  const balance = summary.calorieBalance;
  return {
    ...summary,
    caloriesConsumed: summary.caloriesConsumed + calories,
    netCalories: summary.netCalories + calories,
    remainingCalories: summary.remainingCalories - calories,
    protein: {
      ...summary.protein,
      consumed: summary.protein.consumed + pending.protein,
    },
    carbs: {
      ...summary.carbs,
      consumed: summary.carbs.consumed + pending.carbs,
    },
    fat: { ...summary.fat, consumed: summary.fat.consumed + pending.fat },
    fiber: {
      ...summary.fiber,
      consumed: summary.fiber.consumed + pending.fiber,
    },
    calorieBalance: {
      ...balance,
      eaten: balance.eaten + calories,
      net: balance.net + calories,
      remaining: balance.remaining - calories,
      progress:
        balance.goal > 0
          ? Math.max(
              0,
              ((balance.goal - balance.remaining + calories) / balance.goal) *
                100
            )
          : balance.progress,
    },
  };
}
