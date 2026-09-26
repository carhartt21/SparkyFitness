import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { ExtensionStorage } from '@bacons/apple-targets';
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
} from '../services/healthEngagementPolicy';
import { reconcileNutritionEngagementReminders } from '../services/nutritionEngagementReminders';
import { reconcileMovementEngagementReminders } from '../services/movementEngagementReminders';
import { reconcileMobilityEngagementReminders } from '../services/mobilityEngagementReminders';
import {
  getMobilityState,
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

const WIDGET_KEY = 'nutritionEngagementSnapshot';
const WIDGET_SCOPE_KEY = 'nutritionEngagementScope';
const WIDGET_KIND = 'nutritionEngagement';
const iosAppGroup = (
  Constants.expoConfig?.extra as { iosAppGroup?: string } | undefined
)?.iosAppGroup;

/** App-scope owner: local action changes repair reminder and widget state. */
export default function NutritionEngagementCoordinator() {
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
  const serverConfigId = identity?.serverConfigId ?? null;
  const userId = identity?.userId ?? null;
  const identityKey = JSON.stringify([serverConfigId, userId]);
  const identityReady = identity !== null && identityKey === activeScope;

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
      setDay(getTodayDate());
      setClockMs(Date.now());
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    const interval = setInterval(update, 60_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

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

  const plan = useMemo(() => {
    const nutritionCandidates =
      identityReady && !storageError && notificationsEnabled
        ? nutritionReminderCandidates({
            state,
            windows: [{ id: 'selected', start, end, prompt, enabled }],
            reviewTime: reviewEnabled ? reviewTime : null,
            now: clockMs,
          })
        : [];
    const scopedSession =
      identityReady &&
      wellbeingSession?.serverConfigId === identity.serverConfigId &&
      wellbeingSession.userId === identity.userId
        ? wellbeingSession
        : null;
    const movementCandidate =
      identityReady && sessionReadable && notificationsEnabled
        ? movementBreakReminderCandidate({
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
      mobilityData?.scope === identityKey
        ? mobilityReminderCandidates({
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
      ],
      dailyCap: Math.max(0, 3 - (spentByDay?.[day] ?? 0)),
      domainCaps: { nutrition: 2, movement: 1 },
      collisionMinutes: 20,
      reservedTimes: medicationReservedTimes ?? [],
      now: clockMs,
    });
  }, [
    day,
    clockMs,
    identity,
    identityReady,
    storageError,
    enabled,
    notificationsEnabled,
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
  ]);

  useEffect(() => {
    if (notificationsEnabled && !coordinationReady) return;
    void reconcileNutritionEngagementReminders({
      identity,
      enabled:
        identityReady &&
        !storageError &&
        (enabled || reviewEnabled) &&
        notificationsEnabled,
      candidates: plan,
    }).catch(() => undefined);
    void reconcileMovementEngagementReminders({
      identity,
      enabled:
        identityReady &&
        movementEnabled &&
        notificationsEnabled &&
        sessionReadable,
      candidates: plan,
    }).catch(() => undefined);
    void reconcileMobilityEngagementReminders({
      identity,
      enabled:
        identityReady &&
        notificationsEnabled &&
        mobilityData?.scope === identityKey,
      candidates: plan,
    }).catch(() => undefined);
  }, [
    identity,
    identityReady,
    storageError,
    enabled,
    notificationsEnabled,
    reviewEnabled,
    movementEnabled,
    mobilityData,
    identityKey,
    sessionReadable,
    plan,
    medicationReservedTimes,
    coordinationReady,
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
    />
  );
}
