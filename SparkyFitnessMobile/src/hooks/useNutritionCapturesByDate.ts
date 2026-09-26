import { useQuery } from '@tanstack/react-query';
import { fetchNutritionCapturesByDate } from '../services/api/nutritionCaptureApi';

export const nutritionCapturesQueryKey = (date: string) =>
  ['nutritionCaptures', date] as const;

export function useNutritionCapturesByDate(
  date: string,
  enabled: boolean,
  scope?: string | null
) {
  const query = useQuery({
    queryKey: scope
      ? [...nutritionCapturesQueryKey(date), scope]
      : nutritionCapturesQueryKey(date),
    queryFn: () => fetchNutritionCapturesByDate(date),
    enabled,
  });
  return {
    captures: query.data ?? [],
    hasData: query.data !== undefined,
    isLoading: query.isLoading,
  };
}
