import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import {
  saveDraft,
  loadDraft,
  clearDraft,
  getActiveDraftIdentity,
} from '../services/workoutDraftService';
import type { DraftIdentity } from '../services/workoutDraftService';
import { subscribeNutritionIdentity } from '../services/nutritionIdentity';
import type { FormDraft } from '../types/drafts';

interface UseDraftPersistenceOptions<T extends FormDraft> {
  state: T;
  draftType: T['type'];
  isEditMode: boolean;
  skipDraftLoad: boolean;
  onDraftLoaded: (draft: T) => void;
  onInitialDate?: () => void;
}

interface DraftPersistenceControls {
  clearPersistedDraft: () => Promise<void>;
  clearCurrentDraft: () => Promise<void>;
}

export function useDraftPersistence<T extends FormDraft>(
  options: UseDraftPersistenceOptions<T>
): DraftPersistenceControls {
  const {
    state,
    draftType,
    isEditMode,
    skipDraftLoad,
    onDraftLoaded,
    onInitialDate,
  } = options;

  const isDraftLoadedRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistenceEnabledRef = useRef(true);
  const draftIdentityRef = useRef<DraftIdentity | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const isEditModeRef = useRef(isEditMode);
  isEditModeRef.current = isEditMode;

  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const disablePersistence = useCallback(() => {
    persistenceEnabledRef.current = false;
    cancelPendingSave();
  }, [cancelPendingSave]);

  const clearCurrentDraft = useCallback(async () => {
    if (draftIdentityRef.current) {
      await clearDraft(draftIdentityRef.current);
    }
  }, []);

  const clearPersistedDraft = useCallback(async () => {
    disablePersistence();
    await clearCurrentDraft();
  }, [clearCurrentDraft, disablePersistence]);

  useEffect(() => {
    if (isEditMode) {
      isDraftLoadedRef.current = true;
      return;
    }
    if (skipDraftLoad) {
      onInitialDate?.();
      skipNextSaveRef.current = true;
      isDraftLoadedRef.current = true;
      let cancelled = false;
      const bindIdentity = async () => {
        const identity = await getActiveDraftIdentity();
        if (!cancelled) draftIdentityRef.current = identity;
      };
      void bindIdentity();
      const unsubscribe = subscribeNutritionIdentity(() => {
        if (draftIdentityRef.current) {
          disablePersistence();
        } else {
          void bindIdentity();
        }
      });
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }
    let cancelled = false;
    let generation = 0;
    const initialize = async () => {
      const currentGeneration = ++generation;
      const identity = await getActiveDraftIdentity();
      if (cancelled || currentGeneration !== generation) return;
      draftIdentityRef.current = identity;
      const draft = identity ? await loadDraft(identity) : null;
      if (cancelled || currentGeneration !== generation) return;
      if (draft && draft.type === draftType) {
        skipNextSaveRef.current = true;
        onDraftLoaded(draft as T);
      } else {
        onInitialDate?.();
      }
      isDraftLoadedRef.current = true;
    };
    void initialize();
    const unsubscribe = subscribeNutritionIdentity(() => {
      if (draftIdentityRef.current) {
        disablePersistence();
      } else {
        void initialize();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, skipDraftLoad, draftType]);

  useEffect(() => {
    if (isEditMode) return;
    if (!isDraftLoadedRef.current) return;
    if (!persistenceEnabledRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    cancelPendingSave();
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      if (draftIdentityRef.current) {
        void saveDraft(state, draftIdentityRef.current);
      }
    }, 300);

    return () => {
      cancelPendingSave();
    };
  }, [state, isEditMode, cancelPendingSave]);

  // Flush unsaved changes on unmount. This must NOT depend on saveTimeoutRef
  // because React cleans up effects in declaration order — the debounced save
  // effect above clears the ref before this cleanup runs.
  useEffect(() => {
    return () => {
      cancelPendingSave();
      if (!isEditModeRef.current && persistenceEnabledRef.current) {
        if (draftIdentityRef.current) {
          void saveDraft(stateRef.current, draftIdentityRef.current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEditMode) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        cancelPendingSave();
        if (!persistenceEnabledRef.current) return;
        if (draftIdentityRef.current) {
          void saveDraft(stateRef.current, draftIdentityRef.current);
        }
      }
    });
    return () => subscription.remove();
  }, [isEditMode, cancelPendingSave]);

  return {
    clearPersistedDraft,
    clearCurrentDraft,
  };
}
