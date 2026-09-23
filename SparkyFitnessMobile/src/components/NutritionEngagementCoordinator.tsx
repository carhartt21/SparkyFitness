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
  nutritionReminderCandidates,
} from '../services/healthEngagementPolicy';
import { reconcileNutritionEngagementReminders } from '../services/nutritionEngagementReminders';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { getTodayDate } from '../utils/dateUtils';
import { addLog } from '../services/LogService';

const WIDGET_KEY = 'nutritionEngagementSnapshot';
const WIDGET_KIND = 'nutritionEngagement';
const iosAppGroup = (
  Constants.expoConfig?.extra as { iosAppGroup?: string } | undefined
)?.iosAppGroup;

/** App-scope owner: local action changes repair reminder and widget state. */
export default function NutritionEngagementCoordinator() {
  const [day, setDay] = useState(getTodayDate);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const lastWidgetKey = useRef<string | null>(null);
  const widgetInitialized = useRef(false);
  const { isConnected } = useServerConnection();
  const { summary } = useDailySummary({ date: day, enabled: isConnected });
  const { captures, hasData: hasCaptures } = useNutritionCapturesByDate(
    day,
    isConnected
  );
  const { allActions, identity, storageError } = useNutritionDiaryActions(
    day,
    summary?.foodEntries ?? []
  );
  const notificationsEnabled = useAppPreferencesStore(
    (s) => s.notificationsEnabled
  );
  const enabled = useAppPreferencesStore((s) => s.mealCaptureReminderEnabled);
  const start = useAppPreferencesStore((s) => s.mealCaptureWindowStart);
  const end = useAppPreferencesStore((s) => s.mealCaptureWindowEnd);
  const prompt = useAppPreferencesStore((s) => s.mealCapturePromptTime);

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

  const state = useMemo(
    () =>
      deriveNutritionEngagementState({
        day,
        remoteEntries: isConnected ? (summary?.foodEntries ?? null) : null,
        remoteCaptures: isConnected && hasCaptures ? captures : null,
        localActions: allActions,
        knownRemoteCalories: isConnected
          ? (summary?.caloriesConsumed ?? null)
          : null,
        now: clockMs,
      }),
    [day, isConnected, summary, captures, hasCaptures, allActions, clockMs]
  );

  useEffect(() => {
    const candidates =
      identity && !storageError && enabled && notificationsEnabled
        ? nutritionReminderCandidates({
            state,
            windows: [{ id: 'selected', start, end, prompt, enabled: true }],
            reviewTime: null,
            now: Date.now(),
          })
        : [];
    const plan = arbitrateDiscretionaryCandidates({
      candidates,
      dailyCap: 1,
      domainCaps: { nutrition: 1 },
      collisionMinutes: 0,
      reservedTimes: [],
      now: Date.now(),
    });
    void reconcileNutritionEngagementReminders({
      identity,
      enabled: !storageError && enabled && notificationsEnabled,
      candidates: plan,
    }).catch(() => undefined);
  }, [
    identity,
    storageError,
    enabled,
    notificationsEnabled,
    start,
    end,
    prompt,
    state,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !iosAppGroup) return;
    try {
      const storage = new ExtensionStorage(iosAppGroup);
      if (identity && !storageError) {
        const widgetKey = JSON.stringify([
          identity.serverConfigId,
          identity.userId,
          state.day,
          state.capturedCount,
          state.incompleteCount,
          state.pendingSyncCount,
          state.remoteKnown,
          state.knownCalories,
        ]);
        if (lastWidgetKey.current === widgetKey) return;
        const payload: Record<string, string | number> = {
          version: 1,
          serverConfigId: identity.serverConfigId,
          userId: identity.userId,
          day: state.day,
          capturedCount: state.capturedCount,
          incompleteCount: state.incompleteCount,
          pendingSyncCount: state.pendingSyncCount,
          remoteKnown: state.remoteKnown ? 1 : 0,
          generatedAt: Math.floor(Date.now() / 1000),
        };
        if (state.knownCalories !== null)
          payload.knownCalories = state.knownCalories;
        storage.set(WIDGET_KEY, payload);
        lastWidgetKey.current = widgetKey;
        widgetInitialized.current = true;
      } else {
        if (widgetInitialized.current && lastWidgetKey.current === null) return;
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
  }, [identity, storageError, state]);

  return null;
}
