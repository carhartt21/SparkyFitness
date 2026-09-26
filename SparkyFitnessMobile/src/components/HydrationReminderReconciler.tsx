import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { useDailySummary } from '../hooks/useDailySummary';
import { useServerConnection } from '../hooks/useServerConnection';
import {
  cancelWaterReminders,
  cancelWaterRemindersForDifferentIdentity,
  useHydrationReminderReconciler,
} from '../hooks/useHydrationReminder';
import { useManualWaterActions } from '../hooks/useManualWaterActions';
import { waterIntakeLogQueryKey } from '../hooks/queryKeys';
import { fetchWaterIntakeLog } from '../services/api/measurementsApi';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { getTodayDate } from '../utils/dateUtils';
import {
  computeReminderSchedule,
  MAX_SCHEDULED_WATER_REMINDERS,
} from '../utils/hydrationReminder';
import {
  selectHydrationReminderSchedule,
  type ReminderCandidate,
} from '../services/healthEngagementPolicy';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';

/**
 * Headless owner of hydration reminder reconciliation — renders nothing.
 *
 * Always reads today, not the Dashboard's selected date: a reminder is about
 * drinking now. Remote queries stay disabled while reminders are off or the
 * server is unreachable; durable local water still repairs the anchor offline.
 * The hook always runs so turning reminders off cancels what was scheduled.
 */
const HydrationReminderReconciler: React.FC<{
  sharedPlan: ReminderCandidate[];
  nowMs: number;
  medicationReservedTimes: number[] | null;
  spentByDay: Record<string, number> | null;
}> = ({ sharedPlan, nowMs, medicationReservedTimes, spentByDay }) => {
  const remindersActive = useAppPreferencesStore(
    (s) => s.notificationsEnabled && s.waterReminderEnabled
  );
  const { isConnected } = useServerConnection();
  const intervalHours = useAppPreferencesStore(
    (s) => s.waterReminderIntervalHours
  );
  const windowStart = useAppPreferencesStore((s) => s.waterReminderWindowStart);
  const windowEnd = useAppPreferencesStore((s) => s.waterReminderWindowEnd);
  const [today, setToday] = useState(getTodayDate);
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  const [identityReady, setIdentityReady] = useState(false);
  const identityGeneration = useRef(0);
  const queriesEnabled = remindersActive && isConnected && !!identity;
  const identityScope = identity
    ? `${identity.serverConfigId}:${identity.userId}`
    : null;

  useEffect(() => {
    const refresh = (changed = false) => {
      const currentGeneration = ++identityGeneration.current;
      setIdentity(null);
      setIdentityReady(false);
      // An explicit account change clears its chain immediately. On app
      // launch, preserve a same-account chain if the phone is offline.
      if (changed) void cancelWaterReminders();
      void getActiveNutritionIdentity()
        .then((current) => {
          if (currentGeneration === identityGeneration.current) {
            void cancelWaterRemindersForDifferentIdentity(current);
            setIdentity(current);
            setIdentityReady(true);
          }
        })
        .catch(() => {
          if (currentGeneration === identityGeneration.current) {
            void cancelWaterReminders();
            setIdentity(null);
            setIdentityReady(true);
          }
        });
    };
    const stop = subscribeNutritionIdentity(() => refresh(true));
    refresh();
    return () => {
      identityGeneration.current += 1;
      stop();
    };
  }, []);

  useEffect(() => {
    const refreshDay = () => setToday(getTodayDate());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshDay();
    });
    // Re-evaluate the local day while the app remains open across midnight.
    const interval = setInterval(refreshDay, 60_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  const { summary, refetch: refetchSummary } = useDailySummary({
    date: today,
    enabled: queriesEnabled,
    scope: identityScope,
  });
  const { data: logEntries, refetch: refetchLog } = useQuery({
    queryKey: [...waterIntakeLogQueryKey(today), identityScope],
    queryFn: () => fetchWaterIntakeLog(today),
    enabled: queriesEnabled,
  });

  const localWater = useManualWaterActions(today, logEntries ?? null);
  const lastLoggedAt = localWater.latestLoggedAt;
  const lastLoggedAtMs = lastLoggedAt?.getTime() ?? null;
  const waterMl = (summary?.waterConsumed ?? 0) + localWater.pendingMl;
  const waterGoalMl = summary?.waterGoal ?? null;
  const goalMetToday =
    waterGoalMl !== null && waterGoalMl > 0 && waterMl >= waterGoalMl;

  // Keep the candidate chain stable while the clock ticks each minute. A
  // changed drink, goal, day, or preference samples a new planning clock.
  const rawTimes = useMemo(
    () =>
      computeReminderSchedule({
        lastLoggedAt: lastLoggedAtMs === null ? null : new Date(lastLoggedAtMs),
        now: new Date(nowMs),
        intervalHours,
        windowStart,
        windowEnd,
        goalMetToday,
        maxCount: 128,
      }),
    // `nowMs` intentionally does not re-anchor an overdue reminder every
    // minute, which would keep postponing its delivery while the app is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, lastLoggedAtMs, intervalHours, windowStart, windowEnd, goalMetToday]
  );
  const sharedPlanSignature = JSON.stringify(
    sharedPlan.map((candidate) => [candidate.id, candidate.preferredAt])
  );
  const plannedTimes = useMemo(
    () =>
      selectHydrationReminderSchedule({
        times: rawTimes,
        sharedPlan,
        reservedTimes: medicationReservedTimes ?? [],
        spentByDay: spentByDay ?? {},
        now: nowMs,
        windowEnd,
        maxScheduled: MAX_SCHEDULED_WATER_REMINDERS,
      }),
    // Clock ticks alone must not revoke a reminder around its delivery time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      rawTimes,
      sharedPlanSignature,
      medicationReservedTimes,
      spentByDay,
      windowEnd,
    ]
  );

  const refetch = useCallback(() => {
    if (!queriesEnabled) return;
    void refetchSummary();
    void refetchLog();
  }, [queriesEnabled, refetchSummary, refetchLog]);

  useHydrationReminderReconciler({
    identity,
    today,
    lastLoggedAt,
    waterMl,
    waterGoalMl,
    isLoading:
      !identityReady ||
      !identity ||
      medicationReservedTimes === null ||
      spentByDay === null ||
      localWater.storageError ||
      (queriesEnabled && (summary === undefined || logEntries === undefined)) ||
      (!queriesEnabled && lastLoggedAt === null),
    refetch,
    plannedTimes,
  });

  return null;
};

export default HydrationReminderReconciler;
