import type { QueryClient } from '@tanstack/react-query';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import {
  enqueueContainerWaterAction,
  listNutritionActions,
} from './nutritionActionOutbox';
import { reconcileNutritionActions } from './nutritionActionSync';

export type PhoneContainerWaterResult =
  'synced' | 'queued' | 'attentionRequired';

/** Keep a phone container press available for replay before contacting the API. */
export async function logPhoneContainerWaterAction(
  entryDate: string,
  containerId: number,
  queryClient: QueryClient,
  loggedAt = new Date().toISOString()
): Promise<PhoneContainerWaterResult> {
  const identity = await getActiveNutritionIdentity();
  if (!identity) throw new Error('No active nutrition account');
  const action = await enqueueContainerWaterAction({
    ...identity,
    entryDate,
    containerId,
    loggedAt,
  });
  try {
    await reconcileNutritionActions(queryClient);
  } catch {
    // The action is already durable and the app-scope sync gate can retry.
  }
  let latest:
    Awaited<ReturnType<typeof listNutritionActions>>[number] | undefined;
  try {
    latest = (await listNutritionActions(identity)).find(
      (stored) => stored.clientOperationId === action.clientOperationId
    );
  } catch {
    // Enqueue already succeeded. A failed status read must not invite a
    // second press with a new ID for the same unconfirmed drink.
    return 'queued';
  }
  if (latest?.syncState === 'attentionRequired') return 'attentionRequired';
  return latest?.syncState === 'synced' ? 'synced' : 'queued';
}
