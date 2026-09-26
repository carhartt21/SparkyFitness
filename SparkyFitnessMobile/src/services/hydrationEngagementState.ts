import type { WaterIntakeLogEntry } from '@workspace/shared';
import type {
  PendingContainerWaterAction,
  PendingManualWaterAction,
} from './nutritionActionOutbox';

/** Reconcile durable local water with the server ledger by operation ID. */
export function deriveHydrationEngagementState(input: {
  day: string;
  remoteLog: WaterIntakeLogEntry[] | null;
  localActions: PendingManualWaterAction[];
  containerActions?: PendingContainerWaterAction[];
}) {
  const remoteIds = new Set(
    (input.remoteLog ?? [])
      .filter((entry) => entry.entry_date === input.day)
      .map((entry) => entry.source_id)
      .filter((id): id is string => !!id)
  );
  let latestLoggedAtMs: number | null = null;
  for (const entry of input.remoteLog ?? []) {
    if (entry.entry_date !== input.day) continue;
    const at = Date.parse(entry.logged_at);
    if (Number.isFinite(at))
      latestLoggedAtMs = Math.max(latestLoggedAtMs ?? at, at);
  }
  let pendingMl = 0;
  let attentionMl = 0;
  let pendingContainerCount = 0;
  let attentionContainerCount = 0;
  for (const action of input.localActions) {
    if (
      action.payload.entry_date !== input.day ||
      remoteIds.has(action.clientOperationId)
    )
      continue;
    // A fetched ledger is authoritative for a synced action, including after
    // a user deletes that drink on another device.
    if (action.syncState === 'synced' && input.remoteLog !== null) continue;
    const at = Date.parse(action.payload.logged_at);
    if (Number.isFinite(at))
      latestLoggedAtMs = Math.max(latestLoggedAtMs ?? at, at);
    if (action.syncState === 'attentionRequired')
      attentionMl += action.payload.water_ml;
    else if (action.syncState !== 'synced')
      pendingMl += action.payload.water_ml;
  }
  for (const action of input.containerActions ?? []) {
    if (
      action.payload.entry_date !== input.day ||
      remoteIds.has(action.clientOperationId)
    )
      continue;
    // A fetched ledger is authoritative after a synced drink is deleted.
    if (action.syncState === 'synced' && input.remoteLog !== null) continue;
    const at = Date.parse(action.payload.logged_at);
    if (Number.isFinite(at))
      latestLoggedAtMs = Math.max(latestLoggedAtMs ?? at, at);
    if (action.syncState === 'attentionRequired') attentionContainerCount += 1;
    else if (action.syncState !== 'synced') pendingContainerCount += 1;
  }
  return {
    latestLoggedAt:
      latestLoggedAtMs === null ? null : new Date(latestLoggedAtMs),
    pendingMl,
    attentionMl,
    pendingContainerCount,
    attentionContainerCount,
    remoteKnown: input.remoteLog !== null,
  };
}
