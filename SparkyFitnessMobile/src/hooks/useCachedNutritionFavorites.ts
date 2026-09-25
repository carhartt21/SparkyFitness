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

export function useCachedNutritionFavorites() {
  const [cache, setCache] = useState<NutritionFavoriteCache | null>(null);
  const [storageError, setStorageError] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    try {
      const identity = await getActiveNutritionIdentity();
      const next = identity ? await readNutritionFavoriteCache(identity) : null;
      if (currentGeneration !== generation.current) return;
      setCache(next);
      setStorageError(false);
    } catch {
      if (currentGeneration !== generation.current) return;
      setCache(null);
      setStorageError(true);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const stopCache = subscribeNutritionFavoriteCache(() => void refresh());
    const stopIdentity = subscribeNutritionIdentity(() => {
      generation.current += 1;
      setCache(null);
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

  return { cache, storageError };
}
