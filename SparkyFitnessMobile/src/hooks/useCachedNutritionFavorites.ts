import { useCallback, useEffect, useState } from 'react';
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
  const refresh = useCallback(async () => {
    try {
      const identity = await getActiveNutritionIdentity();
      const next = identity ? await readNutritionFavoriteCache(identity) : null;
      setCache(next);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const stopCache = subscribeNutritionFavoriteCache(() => void refresh());
    const stopIdentity = subscribeNutritionIdentity(() => void refresh());
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      stopCache();
      stopIdentity();
      appState.remove();
    };
  }, [refresh]);

  return { cache, storageError };
}
