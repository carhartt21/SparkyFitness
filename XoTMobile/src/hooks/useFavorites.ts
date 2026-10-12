import { useFavoriteDayRefresh } from './useFavoriteDayRefresh';
import { usePreferences } from './usePreferences';
import { useQuery } from '@tanstack/react-query';
import { fetchFavorites } from '../services/api/favoritesApi';
import { favoritesQueryKey } from './queryKeys';
import {
  cacheFavoriteFoods,
  cacheOfflineMeals,
} from '../services/nutritionFavoriteCache';
import { fetchAndCacheNutritionData } from '../services/cacheNutritionData';
import { snapshotOfflineMeals } from '../services/offlineMealSnapshot';

export function useFavorites(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};

  const query = useQuery({
    queryKey: favoritesQueryKey,
    queryFn: () =>
      fetchAndCacheNutritionData(
        fetchFavorites,
        async (favorites, identity, scopeUnchanged) => {
          await cacheFavoriteFoods(identity, favorites.favoriteFoods);
          const meals = await snapshotOfflineMeals(favorites.favoriteMeals);
          if (scopeUnchanged())
            await cacheOfflineMeals(
              identity,
              meals,
              favorites.favoriteMeals.map((meal) => meal.id)
            );
        }
      ),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled,
  });

  const { preferences } = usePreferences({ enabled });
  useFavoriteDayRefresh(query.refetch, enabled, preferences?.timezone);

  return {
    favoriteFoods: query.data?.favoriteFoods ?? [],
    favoriteMeals: query.data?.favoriteMeals ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
