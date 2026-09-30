import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  acknowledgeNutritionActionVisible,
  listNutritionActions,
  subscribeNutritionActions,
  type NutritionActionIdentity,
  type PendingNutritionAction,
  type PendingPhotoAction,
  type PendingPhotoCompletionAction,
} from '../services/nutritionActionOutbox';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { FoodEntry } from '../types/foodEntries';
import {
  projectLocalFoodActions,
  reconciledFoodActions,
} from '../utils/nutritionDiaryProjection';

const EMPTY_REMOTE: FoodEntry[] = [];

/** Reads durable actions independently of server connection or React Query. */
export function useNutritionDiaryActions(
  day: string,
  remote: FoodEntry[],
  remoteScope?: string | null
) {
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  const [actions, setActions] = useState<PendingNutritionAction[]>([]);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const remoteMatchesIdentity =
    remoteScope === undefined ||
    (identity !== null &&
      remoteScope ===
        JSON.stringify([identity.serverConfigId, identity.userId]));
  const scopedRemote = remoteMatchesIdentity ? remote : EMPTY_REMOTE;

  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    try {
      const current = await getActiveNutritionIdentity();
      const stored = current ? await listNutritionActions(current) : [];
      if (currentGeneration !== generation.current) return;
      setIdentity(current);
      setActions(stored);
      setError(false);
    } catch {
      if (currentGeneration !== generation.current) return;
      // The active identity may have changed while storage failed. Keep the
      // actions on disk for recovery, but never show the previous account's
      // rows under an unverified identity.
      setIdentity(null);
      setActions([]);
      setError(true);
    }
  }, []);

  useEffect(() => {
    // Defer the initial read until after the subscription is installed; the
    // asynchronous callback also avoids a render cascade in this effect.
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

  const visible = useMemo(
    () => projectLocalFoodActions(day, actions, scopedRemote),
    [day, actions, scopedRemote]
  );
  const photoActions = useMemo(
    () =>
      actions.filter(
        (action): action is PendingPhotoAction =>
          action.type === 'createPhotoEntry' && action.payload.entryDate === day
      ),
    [actions, day]
  );
  const photoCompletionActions = useMemo(
    () =>
      actions.filter(
        (action): action is PendingPhotoCompletionAction =>
          action.type === 'completePhotoEntry' &&
          action.payload.entryDate === day
      ),
    [actions, day]
  );

  useEffect(() => {
    if (!identity) return;
    for (const action of reconciledFoodActions(actions, scopedRemote)) {
      if (action.serverIdentity) {
        void acknowledgeNutritionActionVisible(
          identity,
          action.clientOperationId,
          action.serverIdentity
        ).catch(() => setError(true));
      }
    }
  }, [identity, actions, scopedRemote]);

  useEffect(() => {
    if (!identity) return;
    for (const action of photoCompletionActions) {
      if (action.syncState !== 'synced' || !action.serverIdentity) continue;
      const linked = scopedRemote.find(
        (entry) =>
          entry.id === action.serverIdentity &&
          entry.nutrition_capture_id === action.payload.captureId &&
          entry.client_operation_id === action.clientOperationId
      );
      if (linked) {
        void acknowledgeNutritionActionVisible(
          identity,
          action.clientOperationId,
          linked.id
        ).catch(() => setError(true));
      }
    }
  }, [identity, photoCompletionActions, scopedRemote]);

  return {
    allActions: actions,
    actions: visible,
    photoActions,
    photoCompletionActions,
    identity,
    storageError: error,
  };
}
