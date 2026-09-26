import { useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppLocale } from '../localization';
import {
  cancelScheduledNotification,
  cancelScheduledNotificationWithResult,
  scheduleWaterReminderNotifications,
} from '../services/notifications';
import { addLog } from '../services/LogService';
import { releaseFutureDiscretionaryPrompt } from '../services/discretionaryPromptLedger';
import {
  useAppPreferencesStore,
  type WaterReminderIntervalHours,
} from '../stores/appPreferencesStore';
import { computeReminderSchedule } from '../utils/hydrationReminder';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';

// Reconciliation runs in exactly one mounted place — the app-scope
// `HydrationReminderReconciler` — and persists the scheduled
// chain so an unchanged input never reschedules. Every operation goes through
// one promise queue: a log tap and an app resume can both reconcile at once,
// and two interleaved passes would each schedule a chain.
const WATER_REMINDER_STORAGE_KEY = '@SparkyFitness/waterReminderSchedule';

interface StoredWaterReminderSchedule {
  signature: string;
  notificationIds: string[];
  scheduledTimes?: number[];
  identity?: NutritionActionIdentity | null;
}

export interface WaterReminderReconcileInput {
  identity?: NutritionActionIdentity | null;
  today: string;
  lastLoggedAt: Date | null;
  goalMetToday: boolean;
  intervalHours: WaterReminderIntervalHours;
  windowStart: string;
  windowEnd: string;
  language?: string | null;
  /** Selected by the combined discretionary policy; absent for legacy callers. */
  plannedTimes?: Date[];
}

let queue: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch((error: unknown) => {
    addLog(`Water reminder task failed: ${String(error)}`, 'ERROR');
  });
  return queue;
}

function signatureOf(input: WaterReminderReconcileInput): string {
  return JSON.stringify([
    2,
    input.identity?.serverConfigId ?? null,
    input.identity?.userId ?? null,
    input.today,
    input.lastLoggedAt?.getTime() ?? null,
    input.goalMetToday,
    input.intervalHours,
    input.windowStart,
    input.windowEnd,
    input.language ?? null,
    input.plannedTimes?.map((time) => time.getTime()) ?? null,
  ]);
}

async function readStoredSchedule(): Promise<StoredWaterReminderSchedule | null> {
  try {
    const raw = await AsyncStorage.getItem(WATER_REMINDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredWaterReminderSchedule>;
    if (
      typeof parsed.signature === 'string' &&
      Array.isArray(parsed.notificationIds) &&
      parsed.notificationIds.every((id) => typeof id === 'string') &&
      (parsed.scheduledTimes === undefined ||
        (Array.isArray(parsed.scheduledTimes) &&
          parsed.scheduledTimes.length === parsed.notificationIds.length &&
          parsed.scheduledTimes.every(
            (time) => typeof time === 'number' && Number.isFinite(time)
          )))
    ) {
      return {
        signature: parsed.signature,
        notificationIds: parsed.notificationIds,
        scheduledTimes: parsed.scheduledTimes,
        identity: parsed.identity ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function clearStoredSchedule(
  stored: StoredWaterReminderSchedule
): Promise<void> {
  for (const [index, id] of stored.notificationIds.entries()) {
    const at = stored.scheduledTimes?.[index];
    if (at === undefined) {
      await cancelScheduledNotification(id);
    } else if (await cancelScheduledNotificationWithResult(id)) {
      await releaseFutureDiscretionaryPrompt({
        identity: stored.identity ?? null,
        candidateId: `hydration:drink:${at}`,
        at,
      });
    }
  }
  await AsyncStorage.removeItem(WATER_REMINDER_STORAGE_KEY);
}

/**
 * Keeps the scheduled reminder chain in step with the observed water state.
 * Idempotent for an unchanged input; any change cancels the old chain first.
 * An empty scheduling result (no permission) is not persisted, so the next
 * reconcile tries again.
 */
export function reconcileWaterReminders(
  input: WaterReminderReconcileInput,
  now: Date = new Date()
): Promise<void> {
  return enqueue(async () => {
    const signature = signatureOf(input);
    const stored = await readStoredSchedule();
    if (stored?.signature === signature) return;
    if (stored) await clearStoredSchedule(stored);

    const times =
      input.plannedTimes ??
      computeReminderSchedule({
        lastLoggedAt: input.lastLoggedAt,
        now,
        intervalHours: input.intervalHours,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        goalMetToday: input.goalMetToday,
      });
    const scheduledTimes: number[] = [];
    const notificationIds = await scheduleWaterReminderNotifications(
      times,
      input.identity ?? null,
      (_id, time) => scheduledTimes.push(time.getTime())
    );
    if (notificationIds.length === 0) return;

    try {
      await AsyncStorage.setItem(
        WATER_REMINDER_STORAGE_KEY,
        JSON.stringify({
          signature,
          notificationIds,
          identity: input.identity ?? null,
          ...(scheduledTimes.length === notificationIds.length
            ? { scheduledTimes }
            : {}),
        })
      );
    } catch (error) {
      // `cancelWaterReminders` can only cancel what was persisted, so a failed
      // write would leave a live chain nothing can reach — including the
      // toggle-off path. Cancel it here and let the queue log the failure.
      await clearStoredSchedule({
        signature,
        notificationIds,
        scheduledTimes:
          scheduledTimes.length === notificationIds.length
            ? scheduledTimes
            : undefined,
        identity: input.identity ?? null,
      });
      throw error;
    }
  });
}

/** Cancels and forgets any scheduled reminder chain. */
export function cancelWaterReminders(): Promise<void> {
  return enqueue(async () => {
    const stored = await readStoredSchedule();
    if (stored) await clearStoredSchedule(stored);
  });
}

/** Preserve an offline chain on relaunch only when it belongs to this account. */
export function cancelWaterRemindersForDifferentIdentity(
  identity: NutritionActionIdentity | null
): Promise<void> {
  return enqueue(async () => {
    const stored = await readStoredSchedule();
    if (!stored) return;
    if (
      identity &&
      stored.identity?.serverConfigId === identity.serverConfigId &&
      stored.identity.userId === identity.userId
    ) {
      return;
    }
    await clearStoredSchedule(stored);
  });
}

export interface HydrationReminderReconcilerInput {
  identity?: NutritionActionIdentity | null;
  today: string;
  lastLoggedAt: Date | null;
  waterMl: number;
  waterGoalMl: number | null;
  isLoading: boolean;
  refetch: () => void;
  plannedTimes?: Date[];
}

/**
 * Single-owner reconciler. Mount it once, in an always-present place. The
 * `lastLoggedAt` dependency is its millisecond value so a new Date instance
 * for the same log does not re-run the effect.
 */
export function useHydrationReminderReconciler({
  identity,
  today,
  lastLoggedAt,
  waterMl,
  waterGoalMl,
  isLoading,
  refetch,
  plannedTimes,
}: HydrationReminderReconcilerInput): void {
  const remindersActive = useAppPreferencesStore(
    (s) => s.notificationsEnabled && s.waterReminderEnabled
  );
  const intervalHours = useAppPreferencesStore(
    (s) => s.waterReminderIntervalHours
  );
  const windowStart = useAppPreferencesStore((s) => s.waterReminderWindowStart);
  const windowEnd = useAppPreferencesStore((s) => s.waterReminderWindowEnd);
  const appLocale = useAppLocale();

  const lastLoggedAtMs = lastLoggedAt?.getTime() ?? null;
  const plannedTimesMs = plannedTimes?.map((time) => time.getTime());
  const plannedTimesSignature = JSON.stringify(plannedTimesMs ?? null);
  const goalMetToday =
    waterGoalMl !== null && waterGoalMl > 0 && waterMl >= waterGoalMl;

  useEffect(() => {
    if (!remindersActive) {
      void cancelWaterReminders();
      return;
    }
    if (isLoading) return;
    void reconcileWaterReminders({
      identity,
      today,
      lastLoggedAt: lastLoggedAtMs === null ? null : new Date(lastLoggedAtMs),
      goalMetToday,
      intervalHours,
      windowStart,
      windowEnd,
      language: appLocale,
      plannedTimes:
        plannedTimesSignature === 'null'
          ? undefined
          : (JSON.parse(plannedTimesSignature) as number[]).map(
              (time) => new Date(time)
            ),
    });
  }, [
    remindersActive,
    isLoading,
    today,
    lastLoggedAtMs,
    goalMetToday,
    intervalHours,
    windowStart,
    windowEnd,
    appLocale,
    identity,
    plannedTimesSignature,
  ]);

  // On resume, refetch so a drink logged elsewhere or a day rollover is seen;
  // the fresh data then reconciles through the effect above.
  useEffect(() => {
    if (!remindersActive) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refetch();
    });
    return () => subscription.remove();
  }, [remindersActive, refetch]);
}

/** Test-only helper — drops any queued reconcile work. */
export function __resetWaterReminderStateForTests(): void {
  queue = Promise.resolve();
}
