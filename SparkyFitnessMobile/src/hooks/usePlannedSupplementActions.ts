import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { MedicationEntry } from '@workspace/shared';
import {
  acknowledgeNutritionActionVisible,
  listNutritionActions,
  subscribeNutritionActions,
  type NutritionActionIdentity,
  type PendingPlannedSupplementAction,
} from '../services/nutritionActionOutbox';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';

/** Project a saved reminder response until the matching server entry is visible. */
export function usePlannedSupplementActions(
  day: string,
  remoteEntries: MedicationEntry[] | undefined
) {
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  const [actions, setActions] = useState<PendingPlannedSupplementAction[]>([]);
  const [storageError, setStorageError] = useState(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    try {
      const current = await getActiveNutritionIdentity();
      const stored = current ? await listNutritionActions(current) : [];
      if (currentGeneration !== generation.current) return;
      setIdentity(current);
      setActions(
        stored.filter(
          (action): action is PendingPlannedSupplementAction =>
            action.type === 'logPlannedSupplement'
        )
      );
      setStorageError(false);
    } catch {
      if (currentGeneration !== generation.current) return;
      setIdentity(null);
      setActions([]);
      setStorageError(true);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const stopActions = subscribeNutritionActions(() => void refresh());
    const stopIdentity = subscribeNutritionIdentity(() => {
      generation.current += 1;
      setIdentity(null);
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

  useEffect(() => {
    if (!identity || !remoteEntries) return;
    for (const action of actions) {
      if (action.syncState !== 'synced' || !action.serverIdentity) continue;
      const matchingEntry = remoteEntries.find(
        (entry) =>
          entry.id === action.serverIdentity &&
          entry.user_id === identity.userId &&
          entry.schedule_id === action.payload.schedule_id &&
          entry.entry_date === action.payload.entry_date
      );
      if (matchingEntry) {
        void acknowledgeNutritionActionVisible(
          identity,
          action.clientOperationId,
          matchingEntry.id
        ).catch(() => setStorageError(true));
      }
    }
  }, [actions, identity, remoteEntries]);

  const bySchedule = useMemo(
    () =>
      new Map(
        actions
          .filter((action) => {
            if (action.payload.entry_date !== day) return false;
            if (
              !identity ||
              action.syncState !== 'synced' ||
              !action.serverIdentity
            )
              return true;
            return !remoteEntries?.some(
              (entry) =>
                entry.id === action.serverIdentity &&
                entry.user_id === identity.userId &&
                entry.schedule_id === action.payload.schedule_id &&
                entry.entry_date === action.payload.entry_date
            );
          })
          .map((action) => [action.payload.schedule_id, action])
      ),
    [actions, day, identity, remoteEntries]
  );
  return { bySchedule, identity, storageError };
}
