import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppState } from 'react-native';
import WatchConnectivity, {
  type WatchCheckInPayload,
  type WatchContextPayload,
  type WatchContainerPayload,
  type WatchHistoryPoint,
  type WatchWaterIntakePayload,
  type WatchWaterDeletePayload,
  type WatchWaterLogPayload,
  type WatchWorkoutSetOperationPayload,
  type WatchFoodLogPayload,
} from '../../modules/watch-connectivity';
import { fetchFoods } from '../services/api/foodsApi';
import { fetchFavorites } from '../services/api/favoritesApi';
import { fetchMealTypes } from '../services/api/mealTypesApi';
import { getDefaultMealTypeId } from '../constants/meals';
import {
  upsertCheckIn,
  fetchMeasurementsRange,
  fetchWaterContainers,
  fetchWaterIntakeLog,
  deleteWaterIntakeLogEntry,
} from '../services/api/measurementsApi';
import {
  measurementsQueryKey,
  measurementsRangeQueryKey,
  dailySummaryQueryKey,
  waterContainersQueryKey,
  waterIntakeLogQueryKey,
  foodsQueryKey,
  favoritesQueryKey,
  mealTypesQueryKey,
} from './queryKeys';
import { refreshHealthSyncCache } from './refreshHealthSyncCache';
import { getTodayDate, addDays } from '../utils/dateUtils';
import { getServingVolume } from '../utils/unitConversions';
import { formatTimeLabel } from '../utils/entryTimeDisplay';
import { addLog } from '../services/LogService';
import { getActiveServerConfig } from '../services/storage';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import { isCurrentWatchActionScope } from '../services/watchActionScope';
import { handleWatchContainerWaterAction } from '../services/watchContainerWaterAction';
import {
  enqueueFoodEntry,
  listNutritionActions,
  subscribeNutritionActions,
} from '../services/nutritionActionOutbox';
import { queryClient } from './queryClient';
import { usePreferences } from './usePreferences';
import { useDailySummary } from './useDailySummary';
import type { CheckInMeasurement } from '../types/measurements';
import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';
import { buildWatchWorkoutSnapshot } from '../utils/watchWorkoutSnapshot';
import { buildWatchFoodShortcuts } from '../utils/watchFoodShortcuts';
import { saveActiveWorkoutSession } from './useActiveWorkoutAutosave';

/** Clamps a goal-progress fraction to 0...1 — passing a goal always reads as 1. */
function goalProgress(consumed: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.max(0, Math.min(1, consumed / goal));
}

/** Days of history relayed to the watch — matches the watch's 14-day chart. */
const HISTORY_DAYS = 14;

/**
 * Every day-scoped figure, blanked.
 *
 * Sent instead of the real ones whenever this hook's data belongs to a
 * different calendar day than the push does. The watch's mapper returns nil for
 * both snapshots when the three calorie figures or the two water figures are
 * missing, so this lands as "not synced yet" on the pages and an empty
 * complication — the honest answer, and one the wearer can tell apart from a
 * real zero.
 *
 * All of them, not the stale half: a payload the watch can only partly trust is
 * worse than an empty one, because nothing marks which half is which.
 */
const NO_FIGURES_FOR_TODAY = {
  calorieGoalProgress: null,
  proteinGoalProgress: null,
  carbsGoalProgress: null,
  fatGoalProgress: null,
  caloriesConsumed: null,
  caloriesBurned: null,
  caloriesRemaining: null,
  proteinConsumed: null,
  proteinGoal: null,
  carbsConsumed: null,
  carbsGoal: null,
  fatConsumed: null,
  fatGoal: null,
  waterConsumedMl: null,
  waterLog: [] as WatchWaterLogPayload[],
} as const;

function emptyWatchContext(): WatchContextPayload {
  return {
    pushedAt: Date.now(),
    today: getTodayDate(),
    actionScope: null,
    history: [],
    ackedClientIds: [],
    failedClientIds: [],
    containers: [],
    foodShortcuts: [],
    mealTypes: [],
    defaultMealTypeId: null,
    waterGoalMl: null,
    waterDisplayUnit: null,
    workout: null,
    ...NO_FIGURES_FOR_TODAY,
  };
}

/**
 * Turns a `logged_at` timestamp into the 'HH:MM' shape `formatTimeLabel`
 * expects, in the device's own timezone.
 *
 * Deliberately not `toISOString().slice(11, 16)`: that reads the time back in
 * UTC, which shifts it by an hour or two for Adam (UTC+1/+2) — the same
 * timezone anti-pattern this repo already avoids for calendar dates.
 */
function localHourMinute(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Bridges Apple Watch check-ins to the SparkyFitness server.
 *
 * The watch cannot call the API itself (auth lives here), so it captures weight
 * and body fat locally and hands them over via WatchConnectivity. This hook
 * writes them with the normal check-in upsert, acknowledges them so the watch can
 * stop showing "queued", and pushes back fresh seed values plus recent history so
 * the watch's Digital Crown starts from the right number.
 *
 * iOS-only; a no-op everywhere else.
 */
export function useWatchCheckInBridge(enabled: boolean): void {
  const activeWorkoutState = useActiveWorkoutStore();
  const workoutSnapshot = useMemo(
    () => buildWatchWorkoutSnapshot(activeWorkoutState),
    [activeWorkoutState]
  );
  // Acks are relayed inside the application context (which is latest-value-only
  // and survives the watch app being asleep), so they must accumulate across
  // pushes rather than being sent once and forgotten.
  const ackedClientIdsRef = useRef<string[]>([]);
  // Increments on every `pushContext` call, so each one can tell whether it is
  // still the newest by the time it has something to send.
  const pushGenerationRef = useRef(0);
  const contextWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueueContext = useCallback(
    (context: WatchContextPayload, generation?: number): Promise<void> => {
      const write = contextWriteQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (generation != null && generation !== pushGenerationRef.current)
            return;
          await WatchConnectivity?.updateContext(context);
        });
      contextWriteQueueRef.current = write;
      return write;
    },
    []
  );
  // Guards against a queued transfer being delivered twice — WatchConnectivity
  // makes no once-only promise.
  const handledClientIdsRef = useRef<Set<string>>(new Set());
  // Same guard for water taps. Kept as its own set (rather than sharing
  // handledClientIdsRef) since check-in ids and water-tap ids are separate
  // namespaces the watch generates independently.
  const handledWaterClientIdsRef = useRef<Set<string>>(new Set());
  const pendingWaterClientIdsRef = useRef<Set<string>>(new Set());
  const pendingFoodClientIdsRef = useRef<Set<string>>(new Set());
  // Client ids the server refused. Rides in every context push beside
  // `ackedClientIds`, so a failed water tap reaches a watch whose phone was
  // never reachable — the immediate `sendAck` below can't manage that, and the
  // watch would otherwise show the tap as queued indefinitely.
  const failedClientIdsRef = useRef<string[]>([]);

  // Shared, already-cached query (30 min stale time) — reading it here adds no
  // extra fetch. 'st_lbs' collapses to 'lbs' for the watch: its crown dial only
  // has room for one number, not a stone+lb split.
  const { preferences } = usePreferences();
  const { data: foodLists } = useQuery({
    queryKey: foodsQueryKey,
    queryFn: fetchFoods,
    enabled,
    staleTime: 300_000,
  });
  const { data: favorites } = useQuery({
    queryKey: favoritesQueryKey,
    queryFn: fetchFavorites,
    enabled,
    staleTime: 300_000,
  });
  const { data: allMealTypes } = useQuery({
    queryKey: mealTypesQueryKey,
    queryFn: fetchMealTypes,
    enabled,
    staleTime: 300_000,
  });
  const mealTypes = useMemo(
    () =>
      (allMealTypes ?? [])
        .filter((meal) => meal.is_visible)
        .sort((a, b) => a.sort_order - b.sort_order),
    [allMealTypes]
  );
  const watchFoodShortcuts = useMemo(
    () =>
      buildWatchFoodShortcuts(
        favorites?.favoriteFoods ?? [],
        foodLists?.recentFoods ?? []
      ),
    [favorites?.favoriteFoods, foodLists?.recentFoods]
  );
  const weightUnit: 'kg' | 'lbs' =
    preferences?.default_weight_unit === 'lbs' ||
    preferences?.default_weight_unit === 'st_lbs'
      ? 'lbs'
      : 'kg';

  // The calendar day everything below describes.
  //
  // State rather than a bare `getTodayDate()` call, because this hook is
  // mounted for the life of the app and midnight re-renders nothing on its own.
  // Left as a plain call, the query stayed on yesterday's key while
  // `pushContext` stamped its payload with today's date — the watch then had
  // today's numbers, by its own reckoning, and every staleness guard it owns
  // passed on data from the day before.
  const [summaryDate, setSummaryDate] = useState(getTodayDate);

  /**
   * Rolls this hook onto the current day if the clock has moved past it.
   *
   * Returns the same value when it hasn't, so React bails out rather than
   * re-rendering on every inbound watch event. Called from the event handlers
   * and the foreground listener — all places a fresh day plausibly first
   * becomes noticeable.
   */
  const catchUpToToday = useCallback(() => {
    setSummaryDate((current) => {
      const today = getTodayDate();
      return current === today ? current : today;
    });
  }, []);

  // Always today's summary regardless of what date the Dashboard happens to
  // have selected — this hook seeds the watch, which only ever cares about
  // today. Same underlying query the Dashboard uses, so this rides its cache
  // rather than adding a second fetch when both are mounted.
  const { summary: dailySummary } = useDailySummary({
    date: summaryDate,
    enabled,
  });

  // EVERY calorie figure sent to the watch comes from this one object — the
  // same one the phone's own summary bar (DiaryCalorieMacroSummary) and the
  // iOS home-screen widget read.
  //
  // The flatter `summary.caloriesBurned` / `caloriesConsumed` /
  // `remainingCalories` fields are rawer inputs and do NOT agree with it:
  // `calorieBalance.burned` accounts for the day's exercise source
  // (logged / active / steps / none) and BMR, and `.eaten` has supplement
  // doses folded in. Reading those instead is what made the watch show 993
  // burned against the phone's 607. Issue #2094 was this same class of bug
  // one layer up, which is why the balance is computed in exactly one place.
  const balance = dailySummary?.calorieBalance;

  // Null when there is no summary at all, 0 only when a summary says there is
  // no goal. These feed the complication rings, and the two cases are not the
  // same claim: a 0 the watch can't tell apart from "nothing logged yet" drew
  // an empty ring for today while the Goals page next to it said "not synced
  // yet" — the same page/complication divergence we chased before, in reverse.
  const calorieGoalProgress = dailySummary
    ? balance && balance.goal > 0
      ? Math.max(0, Math.min(1, balance.progress / 100))
      : 0
    : null;
  const proteinGoalProgress = dailySummary
    ? goalProgress(dailySummary.protein.consumed, dailySummary.protein.goal)
    : null;
  const carbsGoalProgress = dailySummary
    ? goalProgress(dailySummary.carbs.consumed, dailySummary.carbs.goal)
    : null;
  const fatGoalProgress = dailySummary
    ? goalProgress(dailySummary.fat.consumed, dailySummary.fat.goal)
    : null;

  // Totals behind the watch's Goals page: eaten on the left, remaining in the
  // ring, burned on the right. Null rather than 0 while the summary is still
  // loading, so the watch can show dashes instead of a convincing-looking
  // zero it has no way to tell apart from a real "nothing logged yet".
  const caloriesConsumed = balance?.eaten ?? null;
  const caloriesBurned = balance?.burned ?? null;
  const caloriesRemaining = balance?.remaining ?? null;
  const proteinConsumed = dailySummary?.protein.consumed ?? null;
  const proteinGoal = dailySummary?.protein.goal ?? null;
  const carbsConsumed = dailySummary?.carbs.consumed ?? null;
  const carbsGoal = dailySummary?.carbs.goal ?? null;
  const fatConsumed = dailySummary?.fat.consumed ?? null;
  const fatGoal = dailySummary?.fat.goal ?? null;

  // Today's water totals for the watch's Water page bottle — same
  // `dailySummary` object as the phone's own hydration gauge reads, so the
  // two never disagree.
  const waterConsumedMl = dailySummary?.waterConsumed ?? null;
  const waterGoalMl = dailySummary?.waterGoal ?? null;
  // The app's globally configured display unit (independent of any one
  // container's own unit) — same source and fallback as the phone's own
  // hydration gauge (DashboardScreen).
  const waterDisplayUnit = preferences?.water_display_unit ?? null;

  // Configured containers, one square per entry on the watch. Long staleTime:
  // these change only when Adam edits them in Settings, and this rides
  // whatever's already cached rather than adding a fetch of its own if the
  // Dashboard's own container UI is mounted too.
  const { data: containers } = useQuery({
    queryKey: waterContainersQueryKey,
    queryFn: fetchWaterContainers,
    staleTime: Infinity,
    enabled,
  });

  // Today's individual logged drinks, for the watch's water log view. Keyed
  // on today's date and invalidated by every tap/delete below, so it tracks
  // the same truth the totals do.
  const { data: waterLogEntries } = useQuery({
    queryKey: waterIntakeLogQueryKey(summaryDate),
    queryFn: () => fetchWaterIntakeLog(summaryDate),
    enabled,
  });

  const timeFormat = preferences?.time_format ?? null;

  // Memoized because `pushContext` below closes over it. A fresh array every
  // render would either churn the listener subscription that watches
  // pushContext's identity, or — if left out of the dep list — leave it
  // pushing a stale log. Keying the memo on the inputs the mapping actually
  // reads keeps the two honest.
  const watchWaterLog: WatchWaterLogPayload[] = useMemo(
    () =>
      (waterLogEntries ?? [])
        // Manual entries only, per the watch view's design: a synced record
        // (Apple Health and friends) has no container behind it, so there's no
        // honest name to bold and nothing the wearer would recognize as theirs
        // to delete.
        .filter((entry) => entry.source === 'manual' && entry.container_name)
        // Newest first. The endpoint already orders logged_at DESC, but the watch
        // view's whole premise is that the drink you just mis-tapped is the top
        // row — too load-bearing to leave resting on the server's ORDER BY.
        .slice()
        .sort(
          (a, b) =>
            new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
        )
        .map((entry) => ({
          id: entry.id,
          name: entry.container_name ?? '',
          volumeMl: Number(entry.water_ml) || 0,
          time:
            formatTimeLabel(localHourMinute(entry.logged_at), timeFormat) ?? '',
        })),
    [waterLogEntries, timeFormat]
  );

  const watchContainers: WatchContainerPayload[] = useMemo(
    () =>
      (containers ?? []).flatMap((container) => {
        // For standard containers, getServingVolume computes the volume per serving.
        // For food-linked containers, fall back to the linked variant's water volume or container volume.
        const servingVolumeMl =
          getServingVolume(container) ??
          (container.linked_variant_water_ml != null
            ? Number(container.linked_variant_water_ml)
            : container.volume || 0);

        return [
          {
            id: container.id,
            name: container.name,
            servingVolumeMl,
            unit: container.unit,
          },
        ];
      }),
    [containers]
  );

  // Bundled so the day check below is one decision rather than sixteen. The
  // memo also keeps `pushContext`'s identity stable across renders that changed
  // nothing it reads.
  const figuresForSummaryDate = useMemo(
    () => ({
      calorieGoalProgress,
      proteinGoalProgress,
      carbsGoalProgress,
      fatGoalProgress,
      caloriesConsumed,
      caloriesBurned,
      caloriesRemaining,
      proteinConsumed,
      proteinGoal,
      carbsConsumed,
      carbsGoal,
      fatConsumed,
      fatGoal,
      waterConsumedMl,
      waterLog: watchWaterLog,
    }),
    [
      calorieGoalProgress,
      proteinGoalProgress,
      carbsGoalProgress,
      fatGoalProgress,
      caloriesConsumed,
      caloriesBurned,
      caloriesRemaining,
      proteinConsumed,
      proteinGoal,
      carbsConsumed,
      carbsGoal,
      fatConsumed,
      fatGoal,
      waterConsumedMl,
      watchWaterLog,
    ]
  );

  const pushContext = useCallback(async (): Promise<void> => {
    if (!WatchConnectivity) return;
    // Claimed before the first await, checked again before publishing: this
    // is a latest-only guard, so an older push that finishes late is dropped
    // rather than overwriting a newer one.
    //
    // Overlap is normal here — a reachability change, a context request, a
    // foreground and a data change can all land within a second — and the
    // day-scoped figures come from the closure each call was built with. So a
    // push started before a meal was logged, but finishing after the push that
    // carried it, would put the pre-meal numbers back. `updateApplicationContext`
    // keeps only the last value written, which makes late-and-stale the one
    // ordering that sticks.
    const generation = ++pushGenerationRef.current;
    try {
      const today = getTodayDate();
      const startDate = addDays(today, -(HISTORY_DAYS - 1));
      const actionIdentity = await getActiveNutritionIdentity();
      if (!actionIdentity) {
        await enqueueContext(emptyWatchContext(), generation);
        return;
      }
      const [range, activeConfig] = await Promise.all([
        fetchMeasurementsRange(startDate, today),
        getActiveServerConfig(),
      ]);

      // The API returns DESC by updated_at, so the first row seen for a date is
      // the most recent one for that date.
      const byDay = new Map<
        string,
        { weight?: number | null; bodyFat?: number | null }
      >();
      for (const entry of range) {
        if (byDay.has(entry.entry_date)) continue;
        byDay.set(entry.entry_date, {
          weight: entry.weight,
          bodyFat: entry.body_fat_percentage,
        });
      }

      const history: WatchHistoryPoint[] = [];
      for (let i = 0; i < HISTORY_DAYS; i++) {
        const day = addDays(today, -(HISTORY_DAYS - 1 - i));
        const row = byDay.get(day);
        if (row?.weight != null && row.weight > 0) {
          history.push({
            day,
            weightKg: row.weight,
            bodyFatPercentage: row.bodyFat ?? null,
          });
        }
      }

      const todayRow = byDay.get(today);
      // Most recent day that actually has a weight — the crown's anchor. Falls
      // back through history so a skipped morning doesn't leave the watch
      // unseeded.
      const lastWithWeight =
        [...history].reverse().find((point) => point.day !== today) ??
        [...history].reverse()[0];

      // The one check that stops a stale payload from impersonating a fresh
      // one. `today` is read at call time; every figure below was read when
      // this hook last rendered, which — with the app resident overnight — can
      // be yesterday. When they disagree, the day-scoped values are dropped
      // wholesale. `catchUpToToday()` in the handlers then re-renders onto the
      // new day, react-query fetches it, and the effect below pushes again with
      // real numbers a moment later.
      //
      // Seed weight, history and containers are deliberately NOT gated: none of
      // them expires at midnight, and a watch that loses its containers because
      // the phone woke up on a new day is the bug we fixed once already.
      const figures =
        summaryDate === today ? figuresForSummaryDate : NO_FIGURES_FOR_TODAY;

      // The callback identity tracks React's subscribed snapshot, but a Watch
      // action can arrive while this async push is awaiting measurements. Use
      // the store's current state if it changed during that wait.
      const currentWorkoutState = useActiveWorkoutStore.getState();
      const currentWorkoutSnapshot =
        currentWorkoutState === activeWorkoutState
          ? workoutSnapshot
          : buildWatchWorkoutSnapshot(currentWorkoutState);
      const context: WatchContextPayload = {
        // Keeps consecutive pushes distinct — see the field's own comment.
        // Without it an unchanged day pushes an identical dictionary, which
        // WatchConnectivity silently declines to redeliver.
        pushedAt: Date.now(),
        today,
        actionScope: actionIdentity
          ? JSON.stringify([
              actionIdentity.serverConfigId,
              actionIdentity.userId,
            ])
          : null,
        todayWeightKg: todayRow?.weight ?? null,
        todayBodyFatPercentage: todayRow?.bodyFat ?? null,
        lastWeightKg: lastWithWeight?.weightKg ?? null,
        lastBodyFatPercentage: lastWithWeight?.bodyFatPercentage ?? null,
        lastEntryDate: lastWithWeight?.day ?? null,
        history,
        ackedClientIds: ackedClientIdsRef.current.slice(-20),
        failedClientIds: failedClientIdsRef.current.slice(-20),
        weightUnit,
        containers: watchContainers,
        foodShortcuts: watchFoodShortcuts,
        mealTypes: mealTypes.map((meal) => ({
          id: meal.id,
          name: meal.display_name?.trim() || meal.name,
        })),
        defaultMealTypeId: getDefaultMealTypeId(mealTypes),
        // Goal and display unit ride outside the day gate: the watch treats
        // both as account configuration and carries them forward, which is
        // what lets a phone-free morning still draw a tap against a scale.
        waterGoalMl,
        waterDisplayUnit,
        workout:
          activeConfig?.id != null &&
          activeConfig.id === currentWorkoutState.sourceServerConfigId
            ? currentWorkoutSnapshot
            : null,
        ...figures,
      };

      // A response fetched under a departed account must never be relabelled
      // with the new account's scope if identity changed during the await.
      const currentIdentity = await getActiveNutritionIdentity();
      if (
        currentIdentity?.serverConfigId !== actionIdentity.serverConfigId ||
        currentIdentity.userId !== actionIdentity.userId
      )
        return;

      // Superseded while the fetch above was in flight — a newer push has
      // already sent, or is about to, from fresher state than this one holds.
      if (generation !== pushGenerationRef.current) return;

      await enqueueContext(context, generation);
    } catch (error) {
      // A failed push is recoverable: the watch keeps its cached context and asks
      // again next time it becomes reachable.
      addLog(`Watch context push failed: ${String(error)}`, 'WARNING');
    }
    // Everything read above is a dep, so logging food, drinking water or
    // flipping the phone's unit setting all give `pushContext` a new identity —
    // which the push effect below watches, so the watch hears about the change
    // within a render rather than waiting for its next request. All four
    // aggregates are memoized, so an identical refetch doesn't cause a push.
  }, [
    weightUnit,
    waterGoalMl,
    waterDisplayUnit,
    summaryDate,
    figuresForSummaryDate,
    watchContainers,
    watchFoodShortcuts,
    mealTypes,
    activeWorkoutState,
    workoutSnapshot,
    enqueueContext,
  ]);

  useEffect(() => {
    if (!WatchConnectivity || !WatchConnectivity.isSupported()) return;
    return subscribeNutritionIdentity(() => {
      // Queue the blank after any native write already in flight. The account
      // change also invalidates in-progress fetches before they can enqueue.
      pushGenerationRef.current += 1;
      ackedClientIdsRef.current = [];
      failedClientIdsRef.current = [];
      handledClientIdsRef.current.clear();
      handledWaterClientIdsRef.current.clear();
      pendingWaterClientIdsRef.current.clear();
      pendingFoodClientIdsRef.current.clear();
      void enqueueContext(emptyWatchContext()).catch((error) => {
        addLog(`Watch account reset failed: ${String(error)}`, 'WARNING');
      });
    });
  }, [enqueueContext]);

  /**
   * The newest `pushContext`, for the write handlers below.
   *
   * They each finish by pushing, and that push has to carry the result of the
   * write they just did. Calling the `pushContext` they closed over sends the
   * state from before it — so a delete, say, was confirmed to the watch by
   * re-sending the log with the deleted row still in it.
   */
  const pushContextRef = useRef(pushContext);
  useEffect(() => {
    pushContextRef.current = pushContext;
  });

  const handleCheckIn = useCallback(
    async (payload: WatchCheckInPayload): Promise<void> => {
      if (!WatchConnectivity) return;
      if (!(await isCurrentWatchActionScope(payload.scope))) {
        await WatchConnectivity.sendAck(payload.clientId, false);
        return;
      }
      if (
        payload.clientId &&
        handledClientIdsRef.current.has(payload.clientId)
      ) {
        // Already written; re-ack so the watch can clear it and move on.
        await WatchConnectivity.sendAck(payload.clientId, true);
        return;
      }

      try {
        const saved: CheckInMeasurement = await upsertCheckIn({
          entryDate: payload.entryDate,
          weight: payload.weightKg,
          // Skipped body fat must be OMITTED, not null: the endpoint upserts by
          // date, so null would wipe an existing reading for the day.
          ...(payload.bodyFatPercentage != null
            ? { bodyFatPercentage: payload.bodyFatPercentage }
            : {}),
        });

        handledClientIdsRef.current.add(payload.clientId);
        ackedClientIdsRef.current = [
          ...ackedClientIdsRef.current,
          payload.clientId,
        ].slice(-20);

        queryClient.setQueryData<CheckInMeasurement>(
          measurementsQueryKey(payload.entryDate),
          saved
        );
        queryClient.invalidateQueries({
          queryKey: measurementsRangeQueryKey(
            addDays(getTodayDate(), -(HISTORY_DAYS - 1)),
            getTodayDate()
          ),
        });
        refreshHealthSyncCache(queryClient);

        addLog(
          `Watch check-in saved for ${payload.entryDate}: ${payload.weightKg} kg`,
          'INFO'
        );
        await WatchConnectivity.sendAck(payload.clientId, true);
        await pushContextRef.current();
      } catch (error) {
        addLog(`Watch check-in failed to save: ${String(error)}`, 'ERROR');
        // Report the failure so the watch shows a retry affordance rather than a
        // false "saved".
        await WatchConnectivity.sendAck(payload.clientId, false);
      }
    },
    []
  );

  /**
   * A container tap captured on the watch. The immediate ack and context
   * ack/failure lists settle its persisted Watch record; the refreshed water
   * total then replaces any optimistic fill.
   */
  const handleWaterTap = useCallback(
    async (payload: WatchWaterIntakePayload): Promise<void> => {
      if (!WatchConnectivity) return;
      if (!(await isCurrentWatchActionScope(payload.scope))) {
        await WatchConnectivity.sendAck(payload.clientId, false);
        return;
      }
      if (
        payload.clientId &&
        handledWaterClientIdsRef.current.has(payload.clientId)
      ) {
        return;
      }
      // Reserve in memory to avoid parallel deliveries. The server's durable
      // operation receipt is the authority across phone relaunches or a lost
      // response after the food and water rows already committed.
      if (payload.clientId)
        handledWaterClientIdsRef.current.add(payload.clientId);

      try {
        const result = await handleWatchContainerWaterAction(payload);
        if (result === 'queued') {
          pendingWaterClientIdsRef.current.add(payload.clientId);
          handledWaterClientIdsRef.current.delete(payload.clientId);
          addLog(`Watch water tap queued for ${payload.entryDate}`, 'INFO');
          return;
        }
        if (result === 'rejected') {
          handledWaterClientIdsRef.current.delete(payload.clientId);
          pendingWaterClientIdsRef.current.delete(payload.clientId);
          failedClientIdsRef.current = [
            ...failedClientIdsRef.current,
            payload.clientId,
          ].slice(-20);
          await WatchConnectivity.sendAck(payload.clientId, false);
          await pushContextRef.current();
          return;
        }
        pendingWaterClientIdsRef.current.delete(payload.clientId);

        // Acknowledged both ways: immediately when the watch is reachable,
        // and durably through the context push. A retry of a tap that
        // previously failed also clears it from the failed list, so the watch
        // doesn't keep a red dot for something that has since gone through.
        ackedClientIdsRef.current = [
          ...ackedClientIdsRef.current,
          payload.clientId,
        ].slice(-20);
        failedClientIdsRef.current = failedClientIdsRef.current.filter(
          (id) => id !== payload.clientId
        );
        await WatchConnectivity.sendAck(payload.clientId, true);

        queryClient.invalidateQueries({
          queryKey: dailySummaryQueryKey(payload.entryDate),
        });
        // The tap also created a new log row, which the watch's log view
        // reads — refetch so the next push carries it.
        await queryClient.invalidateQueries({
          queryKey: waterIntakeLogQueryKey(payload.entryDate),
        });

        addLog(
          `Watch water tap logged for ${payload.entryDate}: container ${payload.containerId}`,
          'INFO'
        );
        await pushContextRef.current();
      } catch (error) {
        // Storage failure is different from a successfully queued API retry.
        if (payload.clientId) {
          handledWaterClientIdsRef.current.delete(payload.clientId);
          pendingWaterClientIdsRef.current.delete(payload.clientId);
          failedClientIdsRef.current = [
            ...failedClientIdsRef.current,
            payload.clientId,
          ].slice(-20);
          await WatchConnectivity.sendAck(payload.clientId, false);
        }
        addLog(`Watch water tap failed to save: ${String(error)}`, 'ERROR');
        // So the failure still reaches a watch that wasn't reachable for the
        // ack above.
        await pushContextRef.current();
      }
    },
    []
  );

  const handleFoodLog = useCallback(
    async (payload: WatchFoodLogPayload): Promise<void> => {
      if (!WatchConnectivity) return;
      const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const valid =
        uuid.test(payload.clientId) &&
        uuid.test(payload.foodId) &&
        uuid.test(payload.variantId) &&
        uuid.test(payload.mealTypeId) &&
        /^\d{4}-\d{2}-\d{2}$/.test(payload.entryDate) &&
        Number.isFinite(payload.quantity) &&
        payload.quantity > 0 &&
        payload.quantity <= 10000 &&
        payload.unit.length > 0 &&
        payload.unit.length <= 40 &&
        !Number.isNaN(Date.parse(payload.loggedAt));
      if (!valid || !(await isCurrentWatchActionScope(payload.scope))) {
        await WatchConnectivity.sendAck(payload.clientId, false);
        return;
      }
      if (pendingFoodClientIdsRef.current.has(payload.clientId)) return;
      pendingFoodClientIdsRef.current.add(payload.clientId);
      try {
        const identity = await getActiveNutritionIdentity();
        if (!identity || !(await isCurrentWatchActionScope(payload.scope))) {
          pendingFoodClientIdsRef.current.delete(payload.clientId);
          return;
        }
        const action = await enqueueFoodEntry({
          ...identity,
          clientOperationId: payload.clientId,
          occurredAt: payload.loggedAt,
          payload: {
            meal_type_id: payload.mealTypeId,
            quantity: payload.quantity,
            unit: payload.unit,
            entry_date: payload.entryDate,
            entry_time: localHourMinute(payload.loggedAt),
            food_id: payload.foodId,
            variant_id: payload.variantId,
          },
        });
        if (
          action.syncState === 'synced' ||
          action.syncState === 'attentionRequired'
        ) {
          pendingFoodClientIdsRef.current.delete(payload.clientId);
          const success = action.syncState === 'synced';
          const destination = success ? ackedClientIdsRef : failedClientIdsRef;
          const opposite = success ? failedClientIdsRef : ackedClientIdsRef;
          opposite.current = opposite.current.filter(
            (id) => id !== payload.clientId
          );
          destination.current = [
            ...destination.current.filter((id) => id !== payload.clientId),
            payload.clientId,
          ].slice(-20);
          await WatchConnectivity.sendAck(payload.clientId, success);
          await pushContextRef.current();
        }
      } catch (error) {
        pendingFoodClientIdsRef.current.delete(payload.clientId);
        ackedClientIdsRef.current = ackedClientIdsRef.current.filter(
          (id) => id !== payload.clientId
        );
        failedClientIdsRef.current = [
          ...failedClientIdsRef.current.filter((id) => id !== payload.clientId),
          payload.clientId,
        ].slice(-20);
        addLog(
          `Watch food action could not be queued: ${String(error)}`,
          'ERROR'
        );
        await WatchConnectivity.sendAck(payload.clientId, false);
        await pushContextRef.current();
      }
    },
    []
  );

  // A tap accepted while the API was offline stays queued on the Watch. When
  // the app-scope outbox later settles it, deliver the acknowledgement without
  // requiring another Watch tap or a foregrounded water screen.
  useEffect(() => {
    const transport = WatchConnectivity;
    if (!enabled || !transport?.isSupported()) return;
    const inspect = async () => {
      if (
        pendingWaterClientIdsRef.current.size === 0 &&
        pendingFoodClientIdsRef.current.size === 0
      )
        return;
      const identity = await getActiveNutritionIdentity();
      if (!identity) return;
      const actions = await listNutritionActions(identity);
      for (const action of actions) {
        const isWater =
          action.type === 'logContainerWater' &&
          pendingWaterClientIdsRef.current.has(action.clientOperationId);
        const isFood =
          action.type === 'logFoodEntry' &&
          pendingFoodClientIdsRef.current.has(action.clientOperationId);
        if (
          (!isWater && !isFood) ||
          (action.syncState !== 'synced' &&
            action.syncState !== 'attentionRequired')
        ) {
          continue;
        }
        if (
          !(await isCurrentWatchActionScope(
            JSON.stringify([identity.serverConfigId, identity.userId])
          ))
        ) {
          return;
        }
        pendingWaterClientIdsRef.current.delete(action.clientOperationId);
        pendingFoodClientIdsRef.current.delete(action.clientOperationId);
        const success = action.syncState === 'synced';
        if (success) {
          handledWaterClientIdsRef.current.add(action.clientOperationId);
          ackedClientIdsRef.current = [
            ...ackedClientIdsRef.current,
            action.clientOperationId,
          ].slice(-20);
          failedClientIdsRef.current = failedClientIdsRef.current.filter(
            (id) => id !== action.clientOperationId
          );
          void queryClient.invalidateQueries({
            queryKey: dailySummaryQueryKey(action.payload.entry_date),
          });
          if (isWater)
            void queryClient.invalidateQueries({
              queryKey: waterIntakeLogQueryKey(action.payload.entry_date),
            });
        } else {
          ackedClientIdsRef.current = ackedClientIdsRef.current.filter(
            (id) => id !== action.clientOperationId
          );
          failedClientIdsRef.current = [
            ...failedClientIdsRef.current.filter(
              (id) => id !== action.clientOperationId
            ),
            action.clientOperationId,
          ].slice(-20);
        }
        await transport.sendAck(action.clientOperationId, success);
        await pushContextRef.current();
      }
    };
    return subscribeNutritionActions(() => {
      void inspect().catch((error) => {
        addLog(
          `Watch nutrition sync acknowledgement failed: ${String(error)}`,
          'WARNING'
        );
      });
    });
  }, [enabled]);

  /**
   * A delete requested from the watch's water log view. The watch has already
   * removed the row optimistically; the authoritative list arrives in the
   * context push at the end, which restores it if this failed.
   */
  const handleWaterDelete = useCallback(
    async (payload: WatchWaterDeletePayload): Promise<void> => {
      if (!WatchConnectivity) return;
      if (!(await isCurrentWatchActionScope(payload.scope))) return;
      if (
        payload.clientId &&
        handledWaterClientIdsRef.current.has(payload.clientId)
      ) {
        return;
      }
      if (!payload.entryId) return;

      const today = getTodayDate();
      try {
        // The server decrements the day's total as part of this, so there's
        // no separate total adjustment to make here.
        await deleteWaterIntakeLogEntry(payload.entryId);

        handledWaterClientIdsRef.current.add(payload.clientId);
        queryClient.invalidateQueries({
          queryKey: dailySummaryQueryKey(today),
        });
        await queryClient.invalidateQueries({
          queryKey: waterIntakeLogQueryKey(today),
        });

        addLog(`Watch deleted water log entry ${payload.entryId}`, 'INFO');
        await pushContextRef.current();
      } catch (error) {
        addLog(`Watch water delete failed: ${String(error)}`, 'ERROR');
        // Re-push so the watch's optimistically-removed row comes back rather
        // than staying gone on a screen that now disagrees with the server.
        await pushContextRef.current();
      }
    },
    []
  );

  const handleWorkoutSetOperation = useCallback(
    async (operation: WatchWorkoutSetOperationPayload): Promise<void> => {
      if (!WatchConnectivity) return;
      let accepted = false;
      try {
        if (!(await isCurrentWatchActionScope(operation.scope))) {
          throw new Error(
            'Watch action account does not match the active account.'
          );
        }
        if (!useActiveWorkoutStore.persist.hasHydrated()) {
          await useActiveWorkoutStore.persist.rehydrate();
        }
        const activeConfigId = (await getActiveServerConfig())?.id ?? null;
        const result = useActiveWorkoutStore
          .getState()
          .applyWatchSetOperation(operation, activeConfigId);
        if (result === 'applied' || result === 'duplicate') {
          // The screen's autosave hook may be unmounted while the wearer uses
          // the Watch. A success ack means the server save has finished, not
          // merely that the phone accepted a local tap.
          accepted = (await saveActiveWorkoutSession(queryClient)) !== 'failed';
        }
        if (!accepted) {
          addLog(
            `Watch workout action conflicted: ${operation.clientId}`,
            'WARNING'
          );
        }
      } catch (error) {
        addLog(`Watch workout action failed: ${String(error)}`, 'ERROR');
      }

      const currentIds = accepted
        ? ackedClientIdsRef.current
        : failedClientIdsRef.current;
      const oppositeIds = accepted
        ? failedClientIdsRef.current
        : ackedClientIdsRef.current;
      if (!currentIds.includes(operation.clientId)) {
        currentIds.push(operation.clientId);
        if (currentIds.length > 100) currentIds.shift();
      }
      const oppositeIndex = oppositeIds.indexOf(operation.clientId);
      if (oppositeIndex >= 0) oppositeIds.splice(oppositeIndex, 1);

      try {
        await WatchConnectivity.sendAck(operation.clientId, accepted);
      } catch (error) {
        addLog(`Watch workout ack failed: ${String(error)}`, 'WARNING');
      }
      await pushContextRef.current();
    },
    []
  );

  // Latest handlers, read by the subscriptions below.
  //
  // Without this, the subscription effect had to list every handler as a dep,
  // so logging a single meal tore down five native listeners and an AppState
  // listener and rebuilt them. It also conflated two jobs: subscribing, and
  // pushing when the data changed. They're separate effects now.
  // Written in an effect rather than during render: a ref is mutable state, and
  // touching `.current` on the way through render is exactly what
  // `react-hooks/refs` forbids. The one-render lag that introduces is harmless
  // here — these events arrive from the native side long after mount.
  const handlersRef = useRef({
    handleCheckIn,
    handleWaterTap,
    handleWaterDelete,
    handleWorkoutSetOperation,
    handleFoodLog,
    pushContext,
    catchUpToToday,
  });
  useEffect(() => {
    handlersRef.current = {
      handleCheckIn,
      handleWaterTap,
      handleWaterDelete,
      handleWorkoutSetOperation,
      handleFoodLog,
      pushContext,
      catchUpToToday,
    };
  });

  // Subscriptions. Depends on `enabled` alone, so these are set up once.
  useEffect(() => {
    if (!enabled || !WatchConnectivity || !WatchConnectivity.isSupported())
      return;

    // Every inbound event is a chance to notice the day has turned over: each
    // one means the watch is awake and talking to us, which after a night
    // asleep is the first moment anything here runs at all.
    const onEvent =
      <T>(handle: (payload: T) => Promise<void>) =>
      (payload: T) => {
        handlersRef.current.catchUpToToday();
        void handle(payload);
      };

    const checkInSub = WatchConnectivity.addListener('onCheckIn', (payload) => {
      onEvent(handlersRef.current.handleCheckIn)(payload);
    });
    const waterIntakeSub = WatchConnectivity.addListener(
      'onWaterIntake',
      (payload) => {
        onEvent(handlersRef.current.handleWaterTap)(payload);
      }
    );
    const waterDeleteSub = WatchConnectivity.addListener(
      'onWaterDelete',
      (payload) => {
        onEvent(handlersRef.current.handleWaterDelete)(payload);
      }
    );
    const workoutSetSub = WatchConnectivity.addListener(
      'onWorkoutSetOperation',
      (payload) => {
        onEvent(handlersRef.current.handleWorkoutSetOperation)(payload);
      }
    );
    const foodLogSub = WatchConnectivity.addListener('onFoodLog', (payload) => {
      onEvent(handlersRef.current.handleFoodLog)(payload);
    });
    const contextRequestSub = WatchConnectivity.addListener(
      'onContextRequest',
      () => {
        handlersRef.current.catchUpToToday();
        void handlersRef.current.pushContext();
      }
    );
    const reachabilitySub = WatchConnectivity.addListener(
      'onReachabilityChange',
      ({ isReachable }) => {
        if (!isReachable) return;
        handlersRef.current.catchUpToToday();
        void handlersRef.current.pushContext();
      }
    );

    // Coming back to the foreground is the other way a new day first shows up
    // — the app can sit resident for days without re-rendering this hook.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      handlersRef.current.catchUpToToday();
      void handlersRef.current.pushContext();
    });

    return () => {
      checkInSub.remove();
      waterIntakeSub.remove();
      waterDeleteSub.remove();
      workoutSetSub.remove();
      foodLogSub.remove();
      contextRequestSub.remove();
      reachabilitySub.remove();
      appStateSub.remove();
    };
  }, [enabled]);

  // Push whenever what we'd send changes — `pushContext`'s identity tracks
  // every value it reads. This is what makes food logged on the phone reach the
  // watch immediately instead of waiting for the watch to ask, and it also
  // covers the second push after a day rollover, once react-query has fetched
  // the new day.
  useEffect(() => {
    if (!enabled || !WatchConnectivity || !WatchConnectivity.isSupported())
      return;
    void pushContext();
  }, [enabled, pushContext]);
}
