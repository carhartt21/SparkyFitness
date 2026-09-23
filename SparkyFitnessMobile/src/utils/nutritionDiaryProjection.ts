import type {
  PendingFoodAction,
  PendingNutritionAction,
} from '../services/nutritionActionOutbox';
import type { FoodEntry } from '../types/foodEntries';

/** Local actions remain visible until the matching server row is in the diary. */
export function projectLocalFoodActions(
  day: string,
  local: PendingNutritionAction[],
  remote: FoodEntry[]
): PendingFoodAction[] {
  const remoteIds = new Set(remote.map((entry) => entry.id));
  const remoteOperationIds = new Set(
    remote.flatMap((entry) =>
      entry.client_operation_id ? [entry.client_operation_id] : []
    )
  );
  return local.filter(
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
  const remoteIds = new Set(remote.map((entry) => entry.id));
  const remoteOperationIds = new Set(
    remote.flatMap((entry) =>
      entry.client_operation_id ? [entry.client_operation_id] : []
    )
  );
  return local.filter(
    (action): action is PendingFoodAction =>
      action.type === 'logFoodEntry' &&
      action.syncState === 'synced' &&
      action.serverIdentity !== null &&
      (remoteIds.has(action.serverIdentity) ||
        remoteOperationIds.has(action.clientOperationId))
  );
}
