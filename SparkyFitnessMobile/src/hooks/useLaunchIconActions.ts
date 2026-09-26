import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as QuickActions from 'expo-quick-actions';
import { navigationRef } from '../components/ActiveWorkoutBar';
import { getActiveServerConfig } from '../services/storage';
import { addLog } from '../services/LogService';
import {
  getLaunchIconItems,
  parseLaunchIconAction,
  type LaunchIconAction,
} from '../services/launchIconActions';

// The native initial property is a process-lifetime value, not an event. It
// must not replay when AppContent remounts (including after an error recovery).
let initialConsumed = false;

interface Options {
  enabled: boolean;
  onAction: (action: LaunchIconAction) => void | Promise<void>;
}

export function useLaunchIconActions({ enabled, onAction }: Options): void {
  const { t } = useTranslation();
  const [pending, setPending] = useState<LaunchIconAction | null>(null);
  const [navigationRevision, setNavigationRevision] = useState(0);
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active'
  );
  const lastReceived = useRef<{ id: string; time: number } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    let cancelled = false;
    void QuickActions.isSupported()
      .then(async (supported) => {
        if (!supported || cancelled) return;
        const items = getLaunchIconItems(t, Platform.OS);
        await QuickActions.setItems(items.slice(0, QuickActions.maxCount ?? 4));
      })
      .catch(() =>
        addLog('Could not update launch icon shortcuts.', 'WARNING')
      );
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    mounted.current = true;
    const receive = (action: QuickActions.Action) => {
      const id = parseLaunchIconAction(action.id);
      if (!id) return;
      const now = Date.now();
      // Some native launch paths deliver the initial item and an event.
      if (
        lastReceived.current?.id === id &&
        now - lastReceived.current.time < 1000
      )
        return;
      lastReceived.current = { id, time: now };
      setPending(id); // Latest explicit intent wins while setup is pending.
    };
    const listener = QuickActions.addListener(receive);
    if (!initialConsumed) {
      initialConsumed = true;
      if (QuickActions.initial) receive(QuickActions.initial);
    }
    const refresh = () => setNavigationRevision((value) => value + 1);
    const ready = navigationRef.addListener('ready', refresh);
    const state = navigationRef.addListener('state', refresh);
    const appState = AppState.addEventListener('change', (value) =>
      setForeground(value === 'active')
    );
    return () => {
      mounted.current = false;
      listener.remove();
      ready();
      state();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    if (!pending || !enabled || !foreground || !navigationRef.isReady()) return;
    // A retained linking flag alone cannot prove onboarding has finished.
    if (
      !navigationRef
        .getRootState()
        ?.routes.some((route) => route.name === 'Tabs')
    )
      return;
    let cancelled = false;
    void getActiveServerConfig()
      .then(async (config) => {
        if (!config || cancelled) return;
        setPending(null);
        // Clearing the consumed intent cleans up this effect. A later failure
        // from the existing editor/connection guard still needs feedback.
        try {
          await onAction(pending);
        } catch {
          if (mounted.current) {
            Alert.alert(
              t('common.error', { defaultValue: 'Error' }),
              t('common.tryAgain', { defaultValue: 'Please try again.' })
            );
          }
          addLog('Could not open launch icon shortcut.', 'WARNING');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPending(null);
          Alert.alert(
            t('common.error', { defaultValue: 'Error' }),
            t('common.tryAgain', { defaultValue: 'Please try again.' })
          );
        }
        addLog('Could not open launch icon shortcut.', 'WARNING');
      });
    return () => {
      cancelled = true;
    };
  }, [pending, enabled, foreground, navigationRevision, onAction, t]);
}
