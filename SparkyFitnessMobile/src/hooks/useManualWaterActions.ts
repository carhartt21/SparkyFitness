import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { WaterIntakeLogEntry } from '@workspace/shared';
import {
  listNutritionActions,
  subscribeNutritionActions,
  type PendingContainerWaterAction,
  type PendingManualWaterAction,
  type PendingNutritionAction,
} from '../services/nutritionActionOutbox';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import { deriveHydrationEngagementState } from '../services/hydrationEngagementState';

/** Project account-scoped water actions into the dashboard and reminder state. */
export function useManualWaterActions(
  day: string,
  remoteLog: WaterIntakeLogEntry[] | null = null
) {
  const [actions, setActions] = useState<PendingNutritionAction[]>([]);
  const [storageError, setStorageError] = useState(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    try {
      const identity = await getActiveNutritionIdentity();
      const stored = identity ? await listNutritionActions(identity) : [];
      if (currentGeneration !== generation.current) return;
      setActions(stored);
      setStorageError(false);
    } catch {
      if (currentGeneration !== generation.current) return;
      // A failed identity or outbox read cannot prove the saved rows still
      // belong to the active account.
      setActions([]);
      setStorageError(true);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const stopActions = subscribeNutritionActions(() => void refresh());
    const stopIdentity = subscribeNutritionIdentity(() => {
      generation.current += 1;
      setActions([]);
      void refresh();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      generation.current += 1;
      stopActions();
      stopIdentity();
      appState.remove();
    };
  }, [refresh]);

  return useMemo(() => {
    const manualActions = actions.filter(
      (action): action is PendingManualWaterAction =>
        action.type === 'logManualWater'
    );
    const containerActions = actions.filter(
      (action): action is PendingContainerWaterAction =>
        action.type === 'logContainerWater'
    );
    const state = deriveHydrationEngagementState({
      day,
      remoteLog,
      localActions: manualActions,
      containerActions,
    });
    return {
      ...state,
      storageError,
    };
  }, [actions, day, remoteLog, storageError]);
}
