import type {
  PendingFoodAction,
  PendingNutritionAction,
  PendingMealAction,
} from '../services/nutritionActionOutbox';
import type { FoodEntry } from '../types/foodEntries';
import { offlineMealNutrition } from '../services/offlineMealSnapshot';

/** Presentation only: the durable action retains every recipe ingredient. */
function mealPresentation(action: PendingMealAction): PendingFoodAction {
  return {
    ...action,
    type: 'logFoodEntry',
    payload: {
      client_operation_id: action.clientOperationId,
      meal_type_id: action.payload.meal_type_id,
      entry_date: action.payload.entry_date,
      entry_time: action.payload.entry_time,
      food_name: action.payload.meal.name,
      quantity: action.payload.quantity,
      unit: action.payload.meal.serving_unit,
      serving_size: action.payload.meal.serving_size,
      ...offlineMealNutrition(action.payload.meal),
    },
  };
}

function presentations(actions: PendingNutritionAction[]): PendingFoodAction[] {
  return actions.flatMap((action) =>
    action.type === 'logMealEntry'
      ? [mealPresentation(action)]
      : action.type === 'logFoodEntry'
        ? [action]
        : []
  );
}

/** Local actions remain visible until the matching server row is in the diary. */
export function projectLocalFoodActions(
  day: string,
  local: PendingNutritionAction[],
  remote: FoodEntry[]
): PendingFoodAction[] {
  const remoteIds = new Set(
    remote.flatMap((entry) => [
      entry.id,
      ...(entry.food_entry_meal_id ? [entry.food_entry_meal_id] : []),
    ])
  );
  const remoteOperationIds = new Set(
    remote.flatMap((entry) =>
      entry.client_operation_id ? [entry.client_operation_id] : []
    )
  );
  return presentations(local).filter(
    (action): action is PendingFoodAction =>
      action.type === 'logFoodEntry' &&
      action.payload.entry_date === day &&
      !remoteOperationIds.has(action.clientOperationId) &&
      (!action.serverIdentity || !remoteIds.has(action.serverIdentity))
  );
}

export function reconciledFoodActions(
  local: PendingNutritionAction[],
  remote: FoodEntry[]
): PendingFoodAction[] {
  const remoteIds = new Set(
    remote.flatMap((entry) => [
      entry.id,
      ...(entry.food_entry_meal_id ? [entry.food_entry_meal_id] : []),
    ])
  );
  const remoteOperationIds = new Set(
    remote.flatMap((entry) =>
      entry.client_operation_id ? [entry.client_operation_id] : []
    )
  );
  return presentations(local).filter(
    (action): action is PendingFoodAction =>
      action.type === 'logFoodEntry' &&
      action.syncState === 'synced' &&
      action.serverIdentity !== null &&
      (remoteIds.has(action.serverIdentity) ||
        remoteOperationIds.has(action.clientOperationId))
  );
}
