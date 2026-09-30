import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useServerConnection } from './useServerConnection';
import { subscribeNutritionActions } from '../services/nutritionActionOutbox';
import { subscribeNutritionIdentity } from '../services/nutritionIdentity';
import { reconcileNutritionActions } from '../services/nutritionActionSync';

/** Foreground fallback for nutrition writes; no background execution required. */
export function useNutritionActionSync() {
  const queryClient = useQueryClient();
  const { isConnected, refetch } = useServerConnection({
    enablePolling: true,
  });
  const active = useRef(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const run = useCallback(async () => {
    if (!isConnected || !mounted.current) return;
    if (active.current) {
      dirty.current = true;
      return;
    }
    active.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    try {
      const result = await reconcileNutritionActions(queryClient);
      if (!mounted.current) return;
      if (dirty.current) {
        dirty.current = false;
        // A newly enqueued action during the pass must not wait for a later
        // foreground event. Store transitions may also cause this one check.
        timer.current = setTimeout(() => void run(), 0);
      } else if (result.nextDelayMs !== null) {
        timer.current = setTimeout(() => void run(), result.nextDelayMs);
      }
    } catch {
      // Storage errors remain visible in the diary. Retry at a bounded pace.
      if (mounted.current) timer.current = setTimeout(() => void run(), 60_000);
    } finally {
      active.current = false;
    }
  }, [isConnected, queryClient]);

  useEffect(() => {
    mounted.current = true;
    if (isConnected) void run();
    const stopActions = subscribeNutritionActions(() => void run());
    const stopIdentity = subscribeNutritionIdentity(() => void run());
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refetch().then((connection) => {
          if (connection.data) void run();
        });
      }
    });
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      stopActions();
      stopIdentity();
      appState.remove();
    };
  }, [isConnected, refetch, run]);
}
