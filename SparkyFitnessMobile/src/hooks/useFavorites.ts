import { useQuery } from '@tanstack/react-query';
import { fetchFavorites } from '../services/api/favoritesApi';
import { favoritesQueryKey } from './queryKeys';
import { fetchProfile } from '../services/api/profileApi';
import { getActiveNutritionIdentity } from '../services/nutritionIdentity';
import { cacheFavoriteFoods } from '../services/nutritionFavoriteCache';

export function useFavorites(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};

  const query = useQuery({
    queryKey: favoritesQueryKey,
    queryFn: async () => {
      const favorites = await fetchFavorites();
      try {
        const profile = await fetchProfile();
        const identity = await getActiveNutritionIdentity();
        if (identity?.userId === profile.id)
          await cacheFavoriteFoods(identity, favorites.favoriteFoods);
      } catch {
        // Online favorites still render when device storage is unavailable.
        // No cached data is overwritten by a failed write.
      }
      return favorites;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled,
  });

  return {
    favoriteFoods: query.data?.favoriteFoods ?? [],
    favoriteMeals: query.data?.favoriteMeals ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
