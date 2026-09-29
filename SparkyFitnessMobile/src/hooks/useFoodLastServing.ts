import { useQuery } from '@tanstack/react-query';
import { fetchFoodLastServing } from '../services/api/foodsApi';
import { foodLastServingQueryKey } from './queryKeys';

/** The amount and unit last logged by hand for a saved food. */
export function useFoodLastServing(
  foodId: string,
  options?: { enabled?: boolean }
) {
  const query = useQuery({
    queryKey: foodLastServingQueryKey(foodId),
    queryFn: () => fetchFoodLastServing(foodId),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5,
  });
  return { lastServing: query.data ?? null };
}
