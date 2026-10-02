import { nutrientCoverageSchema } from '@workspace/shared';
import { apiFetch } from './apiClient';

export interface NutritionTrendPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat: number;
  polyunsaturated_fat: number;
  monounsaturated_fat: number;
  trans_fat: number;
  cholesterol: number;
  sodium: number;
  potassium: number;
  dietary_fiber: number;
  sugars: number;
  vitamin_a: number;
  vitamin_c: number;
  calcium: number;
  iron: number;
  caffeine_mg: number;
  water_ml: number;
  alcohol_g: number;
  [customNutrient: string]: string | number;
}

export const fetchNutritionTrends = (
  startDate: string,
  endDate: string
): Promise<NutritionTrendPoint[]> =>
  apiFetch<NutritionTrendPoint[]>({
    endpoint: `/api/reports/mini-nutrition-trends?startDate=${encodeURIComponent(
      startDate
    )}&endDate=${encodeURIComponent(endDate)}`,
    serviceName: 'Reports API',
    operation: 'fetch nutrition trends',
  });

export async function fetchNutrientCoverage(date: string) {
  return nutrientCoverageSchema.parse(
    await apiFetch<unknown>({
      endpoint: `/api/reports/nutrient-coverage?startDate=${date}&endDate=${date}`,
      serviceName: 'Reports API',
      operation: 'fetch nutrient coverage',
    })
  );
}
