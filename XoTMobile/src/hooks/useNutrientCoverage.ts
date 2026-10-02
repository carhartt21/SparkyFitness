import { useQuery } from '@tanstack/react-query';
import { fetchNutrientCoverage } from '../services/api/reportsApi';
import { nutritionTrendsQueryKey } from './queryKeys';
export function useNutrientCoverage(date: string, enabled: boolean) {
  return useQuery({
    queryKey: [...nutritionTrendsQueryKey(date, date), 'coverage'],
    enabled,
    queryFn: () => fetchNutrientCoverage(date),
  });
}
