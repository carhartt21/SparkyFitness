import { useQuery } from '@tanstack/react-query';
import { fetchMealTypes } from '../services/api/mealTypesApi';
import { getDefaultMealTypeId } from '../constants/meals';
import { mealTypesQueryKey } from './queryKeys';
import { getActiveNutritionIdentity } from '../services/nutritionIdentity';
import { cacheQuickMealTypes } from '../services/nutritionFavoriteCache';

export function useMealTypes(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};

  const query = useQuery({
    queryKey: mealTypesQueryKey,
    queryFn: async () => {
      const mealTypes = await fetchMealTypes();
      try {
        const identity = await getActiveNutritionIdentity();
        if (identity) await cacheQuickMealTypes(identity, mealTypes);
      } catch {
        // Keep online meal-type display independent of local cache availability.
      }
      return mealTypes;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled,
    select: (data) => {
      const mealTypes = data
        .filter((mt) => mt.is_visible)
        .sort((a, b) => a.sort_order - b.sort_order);
      return {
        mealTypes,
        defaultMealTypeId: getDefaultMealTypeId(mealTypes),
      };
    },
  });

  return {
    mealTypes: query.data?.mealTypes ?? [],
    defaultMealTypeId: query.data?.defaultMealTypeId ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
