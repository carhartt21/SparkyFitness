import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { ExtensionStorage } from '@bacons/apple-targets';
import { usePreferences } from '../hooks/usePreferences';
import { useDailySummary } from '../hooks/useDailySummary';
import { useNutritionCapturesByDate } from '../hooks/useNutritionCapturesByDate';
import { useNutritionDiaryActions } from '../hooks/useNutritionDiaryActions';
import { useServerConnection } from '../hooks/useServerConnection';
import {
  arbitrateDiscretionaryCandidates,
  deriveNutritionEngagementState,
  movementBreakReminderCandidate,
  mobilityReminderCandidates,
  nutritionReminderCandidates,
  trackingReminderCandidates,
} from '../services/healthEngagementPolicy';
import { reconcileTrackingEngagementReminders } from '../services/trackingEngagementReminders';
import {
  discretionaryRemindersPaused,
  instantToDay,
  isValidTimeZone,
  habitDayState,
  isHabitDue,
  isMeasurementReminderDue,
} from '@workspace/shared';
import {
  useDailyCheckin,
  useDailyTrackingPreferences,
  useHabitLogs,
  useHabits,
  useHealthContextPeriods,
  useMealTrackingStatus,
  useMeasurementReminders,
} from '../hooks/useDailyTracking';
import { useMealTypes } from '../hooks/useMealTypes';
import { useMeasurements } from '../hooks/useMeasurements';
import { reconcileNutritionEngagementReminders } from '../services/nutritionEngagementReminders';
import { reconcileMovementEngagementReminders } from '../services/movementEngagementReminders';
import { reconcileMobilityEngagementReminders } from '../services/mobilityEngagementReminders';
import {
  getMobilityState,
  synchronizeMobility,
  subscribeMobilityState,
  type MobilityState,
} from '../services/mobilityRoutineStore';
import { getMedicationReminderReservations } from '../services/medicationReminderReservations';
import { getSpentDiscretionaryPromptCounts } from '../services/discretionaryPromptLedger';
import {
  getWellbeingSession,
  subscribeWellbeingSession,
  type WellbeingSession,
} from '../services/wellbeingSessionStore';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { getTodayDate, toLocalDateString } from '../utils/dateUtils';
import { addLog } from '../services/LogService';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import HydrationReminderReconciler from './HydrationReminderReconciler';
import {
  readCachedRemoteEngagement,
  refreshRemoteEngagement,
  renewRemoteEngagementDevice,
  syncMovementTimerStart,
  subscribeRemoteEngagement,
  flushNotificationDeviceOff,
  notificationDeviceOffPending,
} from '../services/remoteEngagement';
import { flushRemoteEngagementActions } from '../services/remoteEngagementActions';

const WIDGET_KEY = 'nutritionEngagementSnapshot';
const WIDGET_SCOPE_KEY = 'nutritionEngagementScope';
const WIDGET_KIND = 'nutritionEngagement';
const iosAppGroup = (
  Constants.expoConfig?.extra as { iosAppGroup?: string } | undefined
)?.iosAppGroup;

/** App-scope owner: local action changes repair reminder and widget state. */
export default function NutritionEngagementCoordinator() {
  const { preferences } = usePreferences();
  const timezone =
    preferences?.timezone && isValidTimeZone(preferences.timezone)
      ? preferences.timezone
      : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [day, setDay] = useState(getTodayDate);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [wellbeingSession, setWellbeingSession] =
    useState<WellbeingSession | null>(null);
  const [sessionReadable, setSessionReadable] = useState(false);
  const [mobilityData, setMobilityData] = useState<{
    scope: string;
    state: MobilityState;
  } | null>(null);
  const [coordination, setCoordination] = useState<{
    clockMs: number;
    identityKey: string;
    medicationReservedTimes: number[];
    spentByDay: Record<string, number>;
  } | null>(null);
  const lastWidgetKey = useRef<string | null>(null);
  const widgetInitialized = useRef(false);
  const activeWidgetScope = useRef<string | null>(null);
  const [activeScope, setActiveScope] = useState<string | null>(null);
  const { isConnected } = useServerConnection();
  const remoteEnabled = isConnected && activeScope !== null;
  const { summary } = useDailySummary({
    date: day,
    enabled: remoteEnabled,
    scope: activeScope,
  });
  const { captures, hasData: hasCaptures } = useNutritionCapturesByDate(
    day,
    remoteEnabled,
    activeScope
  );
  const { allActions, identity, storageError } = useNutritionDiaryActions(
    day,
    remoteEnabled ? (summary?.foodEntries ?? []) : [],
    activeScope
  );
  // Tracking reminders resolve from the same cached records the screens
  // update, so a check-in, habit value or weight saved in the app cancels its
  // reminder before any sync round-trip.
  const trackingEnabled = remoteEnabled;
  const trackingPreferences = useDailyTrackingPreferences({
    enabled: trackingEnabled,
  });
  const todaysCheckin = useDailyCheckin(day, { enabled: trackingEnabled });
  const habitsQuery = useHabits({ enabled: trackingEnabled });
  const habitLogsQuery = useHabitLogs(day, day, { enabled: trackingEnabled });
  const measurementRemindersQuery = useMeasurementReminders({
    enabled: trackingEnabled,
  });
  const { measurements: todaysMeasurements, isLoading: measurementsLoading } =
    useMeasurements({ date: day, enabled: trackingEnabled });
  const contextQuery = useHealthContextPeriods({ enabled: trackingEnabled });
  const mealStatusQuery = useMealTrackingStatus(day, {
    enabled: trackingEnabled,
  });
  const { mealTypes } = useMealTypes({ enabled: trackingEnabled });
  const resolvedMealTimes = useMemo(() => {
    const resolved = new Set(
      (mealStatusQuery.data?.meals ?? [])
        .filter((meal) => meal.state === 'complete' || meal.state === 'skipped')
        .map((meal) => meal.meal_type_id)
    );
    return (mealTypes ?? [])
      .filter((type) => resolved.has(type.id) && type.default_time)
      .map((type) => type.default_time as string);
  }, [mealStatusQuery.data, mealTypes]);
  const serverConfigId = identity?.serverConfigId ?? null;
  const userId = identity?.userId ?? null;
  const identityKey = JSON.stringify([serverConfigId, userId]);
  const identityReady = identity !== null && identityKey === activeScope;
  const [remoteOwnership, setRemoteOwnership] = useState<{
    scope: string;
    enabled: boolean;
    quietStart: string;
    quietEnd: string;
  } | null>(null);
  const localRemindersAllowed =
    identityReady &&
    remoteOwnership?.scope === identityKey &&
    remoteOwnership.enabled === false;

  useEffect(() => {
    let alive = true;
    const scopedIdentity =
      identityReady && serverConfigId && userId
        ? { serverConfigId, userId }
        : null;
    setRemoteOwnership(null);
    if (!scopedIdentity) return;
    const refresh = async () => {
      try {
        const cached = await readCachedRemoteEngagement(scopedIdentity);
        if (alive && cached) {
          useAppPreferencesStore
            .getState()
            .setOptionalReminderDailyLimit(cached.daily_limit);
          setRemoteOwnership({
            scope: identityKey,
            enabled: cached.remote_enabled,
            quietStart: cached.quiet_start,
            quietEnd: cached.quiet_end,
          });
        }
        await flushNotificationDeviceOff(scopedIdentity).catch(() => undefined);
        const current = await refreshRemoteEngagement(scopedIdentity);
        useAppPreferencesStore
          .getState()
          .setOptionalReminderDailyLimit(current.daily_limit);
        void syncMovementTimerStart(scopedIdentity).catch(() => undefined);
        void synchronizeMobility(scopedIdentity).catch(() => undefined);
        void flushRemoteEngagementActions(scopedIdentity).catch(
          () => undefined
        );
        if (alive) {
          setRemoteOwnership({
            scope: identityKey,
            enabled: current.remote_enabled,
            quietStart: current.quiet_start,
            quietEnd: current.quiet_end,
          });
          if (
            current.remote_enabled &&
            useAppPreferencesStore.getState().notificationsEnabled &&
            !(await notificationDeviceOffPending(scopedIdentity))
          ) {
            void renewRemoteEngagementDevice(scopedIdentity).catch(
              () => undefined
            );
          }
        }
      } catch {
        // An unknown owner never schedules both local and remote reminders.
      }
    };
    void refresh();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const unsubscribe = subscribeRemoteEngagement(() => {
      void readCachedRemoteEngagement(scopedIdentity).then((cached) => {
        if (alive && cached)
          setRemoteOwnership({
            scope: identityKey,
            enabled: cached.remote_enabled,
            quietStart: cached.quiet_start,
            quietEnd: cached.quiet_end,
          });
      });
    });
    return () => {
      alive = false;
      appState.remove();
      unsubscribe();
    };
  }, [identityKey, identityReady, serverConfigId, userId]);

  useEffect(() => {
    let generation = 0;
    const storage =
      Platform.OS === 'ios' && iosAppGroup
        ? new ExtensionStorage(iosAppGroup)
        : null;
    const refreshScope = () => {
      const current = ++generation;
      // Clear before the asynchronous identity read. The extension compares
      // this marker to the payload, so it cannot display the departed
      // account's count while React Query and the outbox rehydrate.
      activeWidgetScope.current = null;
      setActiveScope(null);
      lastWidgetKey.current = null;
      if (storage) {
        try {
          storage.remove(WIDGET_SCOPE_KEY);
          storage.remove(WIDGET_KEY);
          ExtensionStorage.reloadWidget(WIDGET_KIND);
        } catch (error) {
          addLog(
            `[NutritionEngagement] Widget clearing failed: ${error instanceof Error ? error.name : 'unknown'}`,
            'ERROR'
          );
        }
      }
      void getActiveNutritionIdentity()
        .then((next) => {
          if (current !== generation) return;
          const scope = next
            ? JSON.stringify([next.serverConfigId, next.userId])
            : null;
          activeWidgetScope.current = scope;
          setActiveScope(scope);
        })
        .catch(() => {
          if (current === generation) setActiveScope(null);
        });
    };
    refreshScope();
    const unsubscribe = subscribeNutritionIdentity(refreshScope);
    return () => {
      generation += 1;
      unsubscribe();
    };
  }, []);
  const notificationsEnabled = useAppPreferencesStore(
    (s) => s.notificationsEnabled
  );
  const enabled = useAppPreferencesStore((s) => s.mealCaptureReminderEnabled);
  const start = useAppPreferencesStore((s) => s.mealCaptureWindowStart);
  const end = useAppPreferencesStore((s) => s.mealCaptureWindowEnd);
  const prompt = useAppPreferencesStore((s) => s.mealCapturePromptTime);
  const reviewEnabled = useAppPreferencesStore((s) => s.mealPhotoReviewEnabled);
  const reviewTime = useAppPreferencesStore((s) => s.mealPhotoReviewTime);
  const movementEnabled = useAppPreferencesStore(
    (s) => s.movementBreakReminderEnabled
  );
  const movementTime = useAppPreferencesStore(
    (s) => s.movementBreakReminderTime
  );

  useEffect(() => {
    const refresh = () => {
      void getActiveNutritionIdentity()
        .then((current) =>
          current ? syncMovementTimerStart(current) : undefined
        )
        .catch(() => undefined);
      void getWellbeingSession()
        .then((session) => {
          setWellbeingSession(session);
          setSessionReadable(true);
        })
        .catch(() => {
          setSessionReadable(false);
          setWellbeingSession(null);
        });
    };
    refresh();
    return subscribeWellbeingSession(refresh);
  }, []);

  useEffect(() => {
    let generation = 0;
    const scopedIdentity =
      identityReady && serverConfigId && userId
        ? { serverConfigId, userId }
        : null;
    setMobilityData(null);
    if (!scopedIdentity) return;
    const refresh = () => {
      const current = ++generation;
      void getMobilityState(scopedIdentity)
        .then((state) => {
          if (current === generation)
            setMobilityData({ scope: identityKey, state });
        })
        .catch(() => {
          if (current === generation) setMobilityData(null);
        });
    };
    refresh();
    const unsubscribe = subscribeMobilityState(refresh);
    return () => {
      generation += 1;
      unsubscribe();
    };
  }, [identityKey, identityReady, serverConfigId, userId]);

  useEffect(() => {
    const update = () => {
      setDay(instantToDay(new Date(), timezone));
      setClockMs(Date.now());
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    update();
    const interval = setInterval(update, 60_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [timezone]);

  useEffect(() => {
    if (!notificationsEnabled) return;
    let active = true;
    const scopedIdentity =
      serverConfigId && userId ? { serverConfigId, userId } : null;
    void Promise.all([
      getMedicationReminderReservations(),
      getSpentDiscretionaryPromptCounts(scopedIdentity, clockMs),
    ])
      .then(([medicationReservedTimes, spentByDay]) => {
        if (!active) return;
        setCoordination({
          clockMs,
          identityKey,
          medicationReservedTimes,
          spentByDay,
        });
      })
      .catch(() => {
        if (active) setCoordination(null);
      });
    return () => {
      active = false;
    };
  }, [clockMs, notificationsEnabled, serverConfigId, userId, identityKey]);

  const coordinationReady =
    coordination?.clockMs === clockMs &&
    coordination.identityKey === identityKey;
  const medicationReservedTimes = coordinationReady
    ? coordination.medicationReservedTimes
    : null;
  const spentByDay = coordinationReady ? coordination.spentByDay : null;

  const state = useMemo(
    () =>
      deriveNutritionEngagementState({
        day,
        remoteEntries:
          remoteEnabled && identityReady
            ? (summary?.foodEntries ?? null)
            : null,
        remoteCaptures:
          remoteEnabled && identityReady && hasCaptures ? captures : null,
        localActions: identityReady ? allActions : [],
        knownRemoteCalories:
          remoteEnabled && identityReady
            ? (summary?.caloriesConsumed ?? null)
            : null,
        now: clockMs,
      }),
    [
      day,
      remoteEnabled,
      identityReady,
      summary,
      captures,
      hasCaptures,
      allActions,
      clockMs,
    ]
  );

  const remindersPaused =
    contextQuery.isSuccess &&
    discretionaryRemindersPaused(contextQuery.data, day);

  const tracking = useMemo(() => {
    const preferences = trackingPreferences.data;
    const names = new Map<string, string>();
    if (!preferences || !trackingEnabled) return { candidates: [], names };
    const habits = habitsQuery.isSuccess ? habitsQuery.data : null;
    const logs = habitLogsQuery.isSuccess ? habitLogsQuery.data : null;
    const habitInputs =
      preferences.habit_reminders_enabled && habits && logs
        ? habits
            .filter((habit) => habit.reminder_time && isHabitDue(habit, day))
            .map((habit) => {
              names.set(`tracking:habit:${day}:${habit.id}`, habit.name);
              return {
                id: habit.id,
                time: habit.reminder_time!,
                resolved:
                  habitDayState(
                    habit,
                    logs.find((log) => log.habit_id === habit.id)
                  ) !== 'not_recorded',
              };
            })
        : [];
    const measurementInputs =
      measurementRemindersQuery.isSuccess && !measurementsLoading
        ? measurementRemindersQuery.data
            .filter(
              (reminder) =>
                reminder.measurement_key === 'weight' &&
                isMeasurementReminderDue(reminder, day)
            )
            .map((reminder) => ({
              key: reminder.measurement_key,
              time: reminder.reminder_time,
              resolved:
                todaysMeasurements?.weight !== null &&
                todaysMeasurements?.weight !== undefined,
            }))
        : [];
    const checkinState = todaysCheckin.isSuccess
      ? (todaysCheckin.data?.state ?? null)
      : undefined;
    return {
      names,
      candidates: trackingReminderCandidates({
        timezone,
        day,
        now: clockMs,
        checkin:
          checkinState === undefined
            ? null
            : {
                enabled: preferences.checkin_reminder_enabled,
                time: preferences.checkin_reminder_time,
                resolved:
                  checkinState === 'completed' || checkinState === 'skipped',
              },
        habits: habitInputs,
        measurements: measurementInputs,
      }),
    };
  }, [
    trackingPreferences.data,
    trackingEnabled,
    habitsQuery.isSuccess,
    habitsQuery.data,
    habitLogsQuery.isSuccess,
    habitLogsQuery.data,
    measurementRemindersQuery.isSuccess,
    measurementRemindersQuery.data,
    measurementsLoading,
    todaysMeasurements,
    todaysCheckin.isSuccess,
    todaysCheckin.data,
    day,
    clockMs,
    timezone,
  ]);

  const dailyLimit = useAppPreferencesStore(
    (s) => s.optionalReminderDailyLimit
  );
  const plan = useMemo(() => {
    // A context period that pauses optional reminders removes every
    // discretionary candidate; scheduled intakes are never in this plan.
    if (remindersPaused) return [];
    const nutritionCandidates =
      identityReady &&
      !storageError &&
      notificationsEnabled &&
      localRemindersAllowed
        ? nutritionReminderCandidates({
            timezone,
            state,
            windows: [{ id: 'selected', start, end, prompt, enabled }],
            reviewTime: reviewEnabled ? reviewTime : null,
            now: clockMs,
            resolvedMealTimes,
          })
        : [];
    const scopedSession =
      identityReady &&
      wellbeingSession?.serverConfigId === identity.serverConfigId &&
      wellbeingSession.userId === identity.userId
        ? wellbeingSession
        : null;
    const movementCandidate =
      identityReady &&
      sessionReadable &&
      notificationsEnabled &&
      localRemindersAllowed
        ? movementBreakReminderCandidate({
            timezone,
            day,
            time: movementTime,
            enabled: movementEnabled,
            alreadyStartedToday:
              scopedSession !== null &&
              toLocalDateString(scopedSession.startedAt) === day,
            activeSession:
              scopedSession?.state === 'active' &&
              Date.parse(scopedSession.endsAt) > clockMs,
            now: clockMs,
          })
        : null;
    const mobilityCandidates =
      identityReady &&
      notificationsEnabled &&
      localRemindersAllowed &&
      mobilityData?.scope === identityKey
        ? mobilityReminderCandidates({
            timezone,
            plans: mobilityData.state.imported
              ? mobilityData.state.plans
              : undefined,
            day,
            routines: mobilityData.state.routines,
            activeSession: mobilityData.state.activeSession,
            history: mobilityData.state.history,
            now: clockMs,
          })
        : [];
    return arbitrateDiscretionaryCandidates({
      candidates: [
        ...nutritionCandidates,
        ...(movementCandidate ? [movementCandidate] : []),
        ...mobilityCandidates,
        ...(identityReady && notificationsEnabled && localRemindersAllowed
          ? tracking.candidates
          : []),
      ],
      dailyCap:
        dailyLimit === null
          ? null
          : Math.max(0, dailyLimit - (spentByDay?.[day] ?? 0)),
      domainCaps: {},
      timezone,
      quietStart: remoteOwnership?.quietStart,
      quietEnd: remoteOwnership?.quietEnd,
      collisionMinutes: 20,
      reservedTimes: medicationReservedTimes ?? [],
      now: clockMs,
    });
  }, [
    dailyLimit,
    timezone,
    remoteOwnership,
    day,
    clockMs,
    identity,
    identityReady,
    storageError,
    enabled,
    notificationsEnabled,
    localRemindersAllowed,
    start,
    end,
    prompt,
    reviewEnabled,
    reviewTime,
    movementEnabled,
    movementTime,
    mobilityData,
    identityKey,
    wellbeingSession,
    sessionReadable,
    state,
    medicationReservedTimes,
    spentByDay,
    remindersPaused,
    tracking,
    resolvedMealTimes,
  ]);

  useEffect(() => {
    if (notificationsEnabled && !coordinationReady) return;
    void reconcileTrackingEngagementReminders({
      identity,
      enabled:
        identityReady &&
        notificationsEnabled &&
        localRemindersAllowed &&
        trackingPreferences.isSuccess,
      candidates: plan,
      habitNames: tracking.names,
    }).catch(() => undefined);
    void reconcileNutritionEngagementReminders({
      identity,
      enabled:
        identityReady &&
        !storageError &&
        (enabled || reviewEnabled) &&
        notificationsEnabled &&
        localRemindersAllowed,
      candidates: plan,
    }).catch(() => undefined);
    void reconcileMovementEngagementReminders({
      identity,
      enabled:
        identityReady &&
        movementEnabled &&
        notificationsEnabled &&
        localRemindersAllowed &&
        sessionReadable,
      candidates: plan,
    }).catch(() => undefined);
    void reconcileMobilityEngagementReminders({
      identity,
      enabled:
        identityReady &&
        notificationsEnabled &&
        localRemindersAllowed &&
        mobilityData?.scope === identityKey,
      candidates: plan,
    }).catch(() => undefined);
  }, [
    identity,
    identityReady,
    storageError,
    enabled,
    notificationsEnabled,
    localRemindersAllowed,
    reviewEnabled,
    movementEnabled,
    mobilityData,
    identityKey,
    sessionReadable,
    plan,
    medicationReservedTimes,
    coordinationReady,
    trackingPreferences.isSuccess,
    tracking.names,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !iosAppGroup) return;
    try {
      const storage = new ExtensionStorage(iosAppGroup);
      const scope = identity
        ? JSON.stringify([identity.serverConfigId, identity.userId])
        : null;
      if (
        identity &&
        scope &&
        scope === activeScope &&
        scope === activeWidgetScope.current &&
        !storageError
      ) {
        const widgetKey = JSON.stringify([
          scope,
          state.day,
          state.capturedCount,
          state.incompleteCount,
          state.pendingSyncCount,
          state.remoteKnown,
        ]);
        if (lastWidgetKey.current === widgetKey) return;
        const payload: Record<string, string | number> = {
          version: 1,
          scope,
          serverConfigId: identity.serverConfigId,
          userId: identity.userId,
          day: state.day,
          capturedCount: state.capturedCount,
          incompleteCount: state.incompleteCount,
          pendingSyncCount: state.pendingSyncCount,
          remoteKnown: state.remoteKnown ? 1 : 0,
          generatedAt: Math.floor(Date.now() / 1000),
        };
        storage.set(WIDGET_SCOPE_KEY, scope);
        storage.set(WIDGET_KEY, payload);
        lastWidgetKey.current = widgetKey;
        widgetInitialized.current = true;
      } else {
        if (widgetInitialized.current && lastWidgetKey.current === null) return;
        storage.remove(WIDGET_SCOPE_KEY);
        storage.remove(WIDGET_KEY);
        lastWidgetKey.current = null;
        widgetInitialized.current = true;
      }
      ExtensionStorage.reloadWidget(WIDGET_KIND);
    } catch (error) {
      addLog(
        `[NutritionEngagement] Widget publication failed: ${error instanceof Error ? error.name : 'unknown'}`,
        'ERROR'
      );
    }
  }, [identity, storageError, state, activeScope]);

  return (
    <HydrationReminderReconciler
      sharedPlan={plan}
      nowMs={clockMs}
      medicationReservedTimes={medicationReservedTimes}
      spentByDay={spentByDay}
      localRemindersAllowed={localRemindersAllowed && !remindersPaused}
      timezone={timezone}
      quietStart={remoteOwnership?.quietStart}
      quietEnd={remoteOwnership?.quietEnd}
    />
  );
}
