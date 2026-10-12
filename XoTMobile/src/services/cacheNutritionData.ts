import type { FoodItem } from '../types/foods';
import type { Meal } from '../types/meals';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from './nutritionIdentity';
import { cacheSavedFoods, cacheOfflineMeals } from './nutritionFavoriteCache';
import { snapshotOfflineMeals } from './offlineMealSnapshot';
import { fetchProfile } from './api/profileApi';

/** Cache only a result read under the same authenticated server/account. */
export async function fetchAndCacheNutritionData<T>(
  fetch: () => Promise<T>,
  persist: (
    result: T,
    identity: NutritionActionIdentity,
    scopeUnchanged: () => boolean
  ) => Promise<unknown>
): Promise<T> {
  let switched = false;
  const stop = subscribeNutritionIdentity(() => {
    switched = true;
  });
  try {
    const identity = await getActiveNutritionIdentity().catch(() => null);
    const result = await fetch();
    if (identity) {
      try {
        const profile = await fetchProfile();
        const active = await getActiveNutritionIdentity();
        if (
          !switched &&
          profile.id === identity.userId &&
          active?.userId === identity.userId &&
          active.serverConfigId === identity.serverConfigId
        )
          await persist(result, identity, () => !switched);
      } catch {
        // A failed local snapshot must not hide a successful online result.
      }
    }
    return result;
  } finally {
    stop();
  }
}

export function fetchAndCacheNutritionFoods<T>(
  fetch: () => Promise<T>,
  foods: (result: T) => FoodItem[]
) {
  return fetchAndCacheNutritionData(fetch, (result, identity) =>
    cacheSavedFoods(identity, foods(result))
  );
}

export function fetchAndCacheNutritionMeals<T>(
  fetch: () => Promise<T>,
  meals: (result: T) => Meal[]
) {
  return fetchAndCacheNutritionData(
    fetch,
    async (result, identity, scopeUnchanged) => {
      const snapshots = await snapshotOfflineMeals(meals(result));
      const active = await getActiveNutritionIdentity();
      if (
        scopeUnchanged() &&
        active?.userId === identity.userId &&
        active.serverConfigId === identity.serverConfigId
      )
        await cacheOfflineMeals(identity, snapshots);
    }
  );
}
