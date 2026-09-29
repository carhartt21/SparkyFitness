import { create } from 'zustand';
import type { PendingNutritionAction } from './nutritionActionOutbox';

/** One explicitly tracked job; the Health import is the first. */
export interface HealthSyncActivity {
  status: 'idle' | 'syncing' | 'synced' | 'attention';
  /** When the status last changed (ms since epoch). */
  at: number;
  message?: string;
}

interface SyncActivityState {
  health: HealthSyncActivity;
  setHealth: (health: Omit<HealthSyncActivity, 'at'>) => void;
}

/** In-memory only: sync status is shown live, never restored from disk. */
export const useSyncActivityStore = create<SyncActivityState>((set) => ({
  health: { status: 'idle', at: 0 },
  setHealth: (health) => set({ health: { ...health, at: Date.now() } }),
}));

export type SyncIndicatorState =
  'hidden' | 'syncing' | 'synced' | 'savedLocally' | 'waiting' | 'attention';

/** How long a completed sync shows its checkmark before the indicator hides. */
export const SYNCED_VISIBLE_MS = 3000;

export interface OutboxCounts {
  pending: number;
  syncing: number;
  attention: number;
}

export function countOutbox(
  actions: readonly Pick<PendingNutritionAction, 'syncState'>[]
): OutboxCounts {
  return {
    pending: actions.filter((action) => action.syncState === 'pending').length,
    syncing: actions.filter((action) => action.syncState === 'syncing').length,
    attention: actions.filter(
      (action) => action.syncState === 'attentionRequired'
    ).length,
  };
}

/**
 * One indicator for several jobs with explicit precedence: anything needing
 * attention wins, then running work, then unsent local saves. "Synced" only
 * shows when the Health job just finished and no other work is outstanding;
 * a finished Health import never implies the diary outbox is empty.
 */
export function summarizeSyncActivity(input: {
  health: HealthSyncActivity;
  outbox: OutboxCounts;
  online: boolean;
  now: number;
}): SyncIndicatorState {
  const { health, outbox, online, now } = input;
  if (health.status === 'attention' || outbox.attention > 0) return 'attention';
  if (health.status === 'syncing' || (online && outbox.syncing > 0))
    return 'syncing';
  const unsent = outbox.pending + outbox.syncing;
  if (unsent > 0) return online ? 'savedLocally' : 'waiting';
  if (health.status === 'synced' && now - health.at < SYNCED_VISIBLE_MS)
    return 'synced';
  return 'hidden';
}
