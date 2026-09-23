import type { QueryClient } from '@tanstack/react-query';
import { createFoodEntry } from './api/foodEntriesApi';
import {
  createNutritionCapture,
  uploadNutritionCaptureImage,
} from './api/nutritionCaptureApi';
import { fetchProfile } from './api/profileApi';
import { ApiError } from './api/errors';
import { getActiveServerConfigId } from './storage';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import {
  listPendingNutritionActions,
  markNutritionActionAttentionRequired,
  markNutritionActionPending,
  markNutritionActionSynced,
  markNutritionActionSyncing,
  type NutritionActionErrorClass,
  type NutritionActionIdentity,
  type PendingNutritionAction,
} from './nutritionActionOutbox';
import { dailySummaryRootQueryKey } from '../hooks/queryKeys';

const MAX_ACTIONS_PER_PASS = 20;
const MAX_RETRY_DELAY_MS = 60_000;
const BASE_RETRY_DELAY_MS = 2_000;

export interface NutritionSyncResult {
  processed: number;
  nextDelayMs: number | null;
}

/** The production dependencies can be substituted in deterministic tests. */
export interface NutritionSyncDependencies {
  getIdentity: typeof getActiveNutritionIdentity;
  getServerConfigId: typeof getActiveServerConfigId;
  fetchProfile: typeof fetchProfile;
  listPending: typeof listPendingNutritionActions;
  markSyncing: typeof markNutritionActionSyncing;
  markPending: typeof markNutritionActionPending;
  markAttention: typeof markNutritionActionAttentionRequired;
  markSynced: typeof markNutritionActionSynced;
  createEntry: typeof createFoodEntry;
  createCapture: typeof createNutritionCapture;
  uploadCaptureImage: typeof uploadNutritionCaptureImage;
}

const productionDependencies: NutritionSyncDependencies = {
  getIdentity: getActiveNutritionIdentity,
  getServerConfigId: getActiveServerConfigId,
  fetchProfile,
  listPending: listPendingNutritionActions,
  markSyncing: markNutritionActionSyncing,
  markPending: markNutritionActionPending,
  markAttention: markNutritionActionAttentionRequired,
  markSynced: markNutritionActionSynced,
  createEntry: createFoodEntry,
  createCapture: createNutritionCapture,
  uploadCaptureImage: uploadNutritionCaptureImage,
};

function retryDelay(retryCount: number): number {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * 2 ** Math.min(Math.max(retryCount - 1, 0), 10)
  );
}

function dueIn(action: PendingNutritionAction, now: number): number {
  if (!action.lastAttemptAt || action.retryCount === 0) return 0;
  const elapsed = now - Date.parse(action.lastAttemptAt);
  return Math.max(0, retryDelay(action.retryCount) - elapsed);
}

function classify(error: unknown): {
  reason: NutritionActionErrorClass;
  permanent: boolean;
} {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return { reason: 'auth', permanent: false };
    }
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return { reason: 'validation', permanent: true };
    }
    return { reason: 'server', permanent: false };
  }
  return { reason: 'network', permanent: false };
}

function sameIdentity(
  a: NutritionActionIdentity | null,
  b: NutritionActionIdentity
): boolean {
  return a?.serverConfigId === b.serverConfigId && a.userId === b.userId;
}

let inFlight: Promise<NutritionSyncResult> | null = null;

/** One bounded pass. Retried requests always reuse their original operation ID. */
export function reconcileNutritionActions(
  queryClient?: QueryClient,
  dependencies: NutritionSyncDependencies = productionDependencies,
  now = () => Date.now()
): Promise<NutritionSyncResult> {
  if (inFlight) return inFlight;
  const work = reconcilePass(queryClient, dependencies, now);
  inFlight = work;
  void work
    .finally(() => {
      if (inFlight === work) inFlight = null;
    })
    .catch(() => undefined);
  return work;
}

async function reconcilePass(
  queryClient: QueryClient | undefined,
  deps: NutritionSyncDependencies,
  now: () => number
): Promise<NutritionSyncResult> {
  const identity = await deps.getIdentity();
  if (!identity) return { processed: 0, nextDelayMs: null };
  const actions = await deps.listPending(identity);
  if (actions.length === 0) return { processed: 0, nextDelayMs: null };

  // Verify the authenticated owner before any write. A stale local identity
  // must never replay another account's unsent food under this session.
  try {
    const profile = await deps.fetchProfile();
    if (
      profile.id !== identity.userId ||
      (await deps.getServerConfigId()) !== identity.serverConfigId
    ) {
      return { processed: 0, nextDelayMs: null };
    }
  } catch {
    // Profile/auth/network failure leaves every action untouched.
    return { processed: 0, nextDelayMs: MAX_RETRY_DELAY_MS };
  }

  let processed = 0;
  let nextDelayMs: number | null = null;
  for (const action of actions) {
    if (processed >= MAX_ACTIONS_PER_PASS) {
      nextDelayMs = 0;
      break;
    }
    const delay = dueIn(action, now());
    if (delay > 0) {
      nextDelayMs = Math.min(nextDelayMs ?? delay, delay);
      continue;
    }
    if (
      (await deps.getServerConfigId()) !== identity.serverConfigId ||
      !sameIdentity(await deps.getIdentity(), identity)
    ) {
      return { processed, nextDelayMs: null };
    }

    await deps.markSyncing(identity, action.clientOperationId);
    processed += 1;
    try {
      const result =
        action.type === 'logFoodEntry'
          ? await deps.createEntry(action.payload)
          : await deps.createCapture(action.payload);
      if (action.type === 'createPhotoEntry') {
        for (const image of action.payload.images) {
          await deps.uploadCaptureImage(action.payload.id, image);
        }
      }
      // A switch during the request cannot reassign the local acknowledgement.
      if (
        (await deps.getServerConfigId()) !== identity.serverConfigId ||
        !sameIdentity(await deps.getIdentity(), identity)
      ) {
        return { processed, nextDelayMs: null };
      }
      await deps.markSynced(identity, action.clientOperationId, result.id);
      void queryClient?.invalidateQueries({
        queryKey: dailySummaryRootQueryKey,
      });
      if (action.type === 'createPhotoEntry') {
        void queryClient?.invalidateQueries({
          queryKey: ['nutritionCaptures', action.payload.entryDate],
        });
      }
    } catch (error) {
      const failure = classify(error);
      if (failure.permanent) {
        await deps.markAttention(
          identity,
          action.clientOperationId,
          failure.reason
        );
      } else {
        await deps.markPending(
          identity,
          action.clientOperationId,
          failure.reason
        );
        const wait = retryDelay(action.retryCount + 1);
        nextDelayMs = Math.min(nextDelayMs ?? wait, wait);
        if (failure.reason === 'auth') break;
      }
    }
  }
  return { processed, nextDelayMs };
}
