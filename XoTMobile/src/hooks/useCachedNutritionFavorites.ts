import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  readNutritionFavoriteCache,
  subscribeNutritionFavoriteCache,
  type NutritionFavoriteCache,
} from '../services/nutritionFavoriteCache';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';

export function useCachedNutritionFavorites() {
  const [cache, setCache] = useState<NutritionFavoriteCache | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    try {
      const identity = await getActiveNutritionIdentity();
      const next = identity ? await readNutritionFavoriteCache(identity) : null;
      if (currentGeneration !== generation.current) return;
      setCache(next);
      setIdentity(identity);
      setStorageError(false);
    } catch {
      if (currentGeneration !== generation.current) return;
      setCache(null);
      setIdentity(null);
      setStorageError(true);
    } finally {
      if (currentGeneration === generation.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const stopCache = subscribeNutritionFavoriteCache(() => void refresh());
    const stopIdentity = subscribeNutritionIdentity(() => {
      generation.current += 1;
      setCache(null);
      setIdentity(null);
      setIsLoading(true);
      void refresh();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      generation.current += 1;
      stopCache();
      stopIdentity();
      appState.remove();
    };
  }, [refresh]);

  return { cache, identity, storageError, isLoading };
}
