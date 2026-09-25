import { z } from 'zod';
import { queryClient } from '../hooks/queryClient';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import {
  enqueueManualWaterAction,
  listNutritionActions,
} from './nutritionActionOutbox';
import { reconcileNutritionActions } from './nutritionActionSync';

const payloadSchema = z.strictObject({
  clientId: z.uuid(),
  entryDate: z.iso.date(),
  loggedAt: z.iso.datetime({ offset: true }),
  waterMl: z.literal(250),
  scope: z.string().min(1),
});
const scopeSchema = z.tuple([z.string().min(1), z.string().min(1)]);

export type WatchManualWaterPayload = z.infer<typeof payloadSchema>;
export type WatchManualWaterResult = 'synced' | 'queued' | 'rejected';

/**
 * Retains the Watch's operation ID through local storage and server replay.
 * A success result is reserved for a confirmed server write; a queued action
 * stays visible on the Watch until a later retry sees it synced.
 */
export async function handleWatchManualWaterAction(
  raw: WatchManualWaterPayload
): Promise<WatchManualWaterResult> {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return 'rejected';

  let decodedScope: unknown;
  try {
    decodedScope = JSON.parse(parsed.data.scope);
  } catch {
    return 'rejected';
  }
  const scope = scopeSchema.safeParse(decodedScope);
  if (!scope.success) return 'rejected';

  const identity = await getActiveNutritionIdentity();
  if (
    identity?.serverConfigId !== scope.data[0] ||
    identity.userId !== scope.data[1]
  ) {
    return 'rejected';
  }

  const existing = (await listNutritionActions(identity)).find(
    (action) => action.clientOperationId === parsed.data.clientId
  );
  if (existing) {
    if (
      existing.type !== 'logManualWater' ||
      existing.payload.entry_date !== parsed.data.entryDate ||
      existing.payload.water_ml !== parsed.data.waterMl ||
      existing.payload.logged_at !== parsed.data.loggedAt
    ) {
      return 'rejected';
    }
  } else {
    await enqueueManualWaterAction({
      ...identity,
      clientOperationId: parsed.data.clientId,
      entryDate: parsed.data.entryDate,
      loggedAt: parsed.data.loggedAt,
      waterMl: parsed.data.waterMl,
    });
  }

  if (existing?.syncState === 'attentionRequired') return 'rejected';
  if (existing?.syncState === 'synced') return 'synced';

  try {
    await reconcileNutritionActions(queryClient);
  } catch {
    // Durable enqueue succeeded. The sync gate can retry after connectivity
    // returns, and the Watch will retain the original operation ID.
  }
  const latest = (await listNutritionActions(identity)).find(
    (action) => action.clientOperationId === parsed.data.clientId
  );
  if (latest?.syncState === 'attentionRequired') return 'rejected';
  return latest?.syncState === 'synced' ? 'synced' : 'queued';
}
