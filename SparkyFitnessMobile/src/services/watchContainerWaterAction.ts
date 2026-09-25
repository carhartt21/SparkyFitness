import { z } from 'zod';
import { queryClient } from '../hooks/queryClient';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import {
  enqueueContainerWaterAction,
  listNutritionActions,
} from './nutritionActionOutbox';
import { reconcileNutritionActions } from './nutritionActionSync';

const payloadSchema = z.strictObject({
  clientId: z.uuid(),
  entryDate: z.iso.date(),
  containerId: z.number().int().positive(),
  loggedAt: z.string().optional(),
  scope: z.string().min(1),
});
const scopeSchema = z.tuple([z.string().min(1), z.string().min(1)]);

export type WatchContainerWaterPayload = z.infer<typeof payloadSchema>;
export type WatchContainerWaterResult = 'synced' | 'queued' | 'rejected';

/** Persist a Watch container tap before trying the API. */
export async function handleWatchContainerWaterAction(
  raw: WatchContainerWaterPayload
): Promise<WatchContainerWaterResult> {
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

  // Older Watch builds do not send a capture instant. A fixed fallback keeps
  // their replay payload identical instead of creating a server conflict.
  const loggedAt =
    parsed.data.loggedAt || `${parsed.data.entryDate}T12:00:00.000Z`;
  const existing = (await listNutritionActions(identity)).find(
    (action) => action.clientOperationId === parsed.data.clientId
  );
  if (existing) {
    if (
      existing.type !== 'logContainerWater' ||
      existing.payload.entry_date !== parsed.data.entryDate ||
      existing.payload.container_id !== parsed.data.containerId ||
      existing.payload.logged_at !== loggedAt
    ) {
      return 'rejected';
    }
  } else {
    await enqueueContainerWaterAction({
      ...identity,
      clientOperationId: parsed.data.clientId,
      entryDate: parsed.data.entryDate,
      containerId: parsed.data.containerId,
      loggedAt,
    });
  }

  if (existing?.syncState === 'attentionRequired') return 'rejected';
  if (existing?.syncState === 'synced') return 'synced';
  try {
    await reconcileNutritionActions(queryClient);
  } catch {
    // Enqueue succeeded. The app-scope sync gate can retry later.
  }
  const latest = (await listNutritionActions(identity)).find(
    (action) => action.clientOperationId === parsed.data.clientId
  );
  if (latest?.syncState === 'attentionRequired') return 'rejected';
  return latest?.syncState === 'synced' ? 'synced' : 'queued';
}
