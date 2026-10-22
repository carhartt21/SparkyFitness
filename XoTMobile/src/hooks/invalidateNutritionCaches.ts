import type { QueryClient } from '@tanstack/react-query';
import {
  customNutrientsQueryKey,
  nutrientDisplayPreferencesQueryKey,
  dailyProgressRootQueryKey,
  mealFoodHistoryRootQueryKey,
} from './queryKeys';

/** Imports can provision definitions as well as change diary/report totals. */
export function invalidateNutritionCaches(queryClient: QueryClient) {
  for (const queryKey of [
    customNutrientsQueryKey,
    nutrientDisplayPreferencesQueryKey,
    dailyProgressRootQueryKey,
    mealFoodHistoryRootQueryKey,
    ['nutritionTrends'],
    ['goals'],
  ]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}
