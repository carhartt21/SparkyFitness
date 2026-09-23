import { useQuery } from '@tanstack/react-query';
import { fetchNutritionCapturesByDate } from '../services/api/nutritionCaptureApi';

export const nutritionCapturesQueryKey = (date: string) =>
  ['nutritionCaptures', date] as const;

export function useNutritionCapturesByDate(date: string, enabled: boolean) {
  const query = useQuery({
    queryKey: nutritionCapturesQueryKey(date),
    queryFn: () => fetchNutritionCapturesByDate(date),
    enabled,
  });
  return { captures: query.data ?? [], isLoading: query.isLoading };
}
