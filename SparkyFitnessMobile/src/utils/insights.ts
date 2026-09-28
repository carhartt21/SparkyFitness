import type { NutritionTrendPoint } from '../services/api/reportsApi';

export interface NutritionInsights {
  /** Days in the window that have any logged nutrition. */
  loggedDays: number;
  totalDays: number;
  /** Averages over logged days only; null when nothing was logged. */
  averageCalories: number | null;
  averageProtein: number | null;
  averageCarbs: number | null;
  averageFat: number | null;
  /** Energy share of each macro (0–1), from 4/4/9 kcal per gram. */
  macroShares: { protein: number; carbs: number; fat: number } | null;
}

const toNumber = (value: string | number | undefined): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

/**
 * Summarizes a padded nutrition-trend window. Days the server did not return
 * are unknown rather than zero, so averages cover logged days only.
 */
export function summarizeNutritionTrends(
  points: NutritionTrendPoint[],
  recordedDates: ReadonlySet<string>
): NutritionInsights {
  const logged = points.filter((point) => recordedDates.has(point.date));
  const loggedDays = logged.length;
  if (loggedDays === 0) {
    return {
      loggedDays: 0,
      totalDays: points.length,
      averageCalories: null,
      averageProtein: null,
      averageCarbs: null,
      averageFat: null,
      macroShares: null,
    };
  }

  const sum = (key: 'calories' | 'protein' | 'carbs' | 'fat') =>
    logged.reduce((total, point) => total + toNumber(point[key]), 0);
  const averageProtein = sum('protein') / loggedDays;
  const averageCarbs = sum('carbs') / loggedDays;
  const averageFat = sum('fat') / loggedDays;

  const proteinKcal = averageProtein * 4;
  const carbsKcal = averageCarbs * 4;
  const fatKcal = averageFat * 9;
  const macroKcal = proteinKcal + carbsKcal + fatKcal;

  return {
    loggedDays,
    totalDays: points.length,
    averageCalories: sum('calories') / loggedDays,
    averageProtein,
    averageCarbs,
    averageFat,
    macroShares:
      macroKcal > 0
        ? {
            protein: proteinKcal / macroKcal,
            carbs: carbsKcal / macroKcal,
            fat: fatKcal / macroKcal,
          }
        : null,
  };
}

export interface WeightChange {
  latest: number;
  change: number | null;
}

/** Latest recorded weight and its change since the first reading in range. */
export function summarizeWeight(
  data: readonly { day: string; weight: number }[]
): WeightChange | null {
  if (data.length === 0) return null;
  const first = data[0];
  const last = data[data.length - 1];
  if (!first || !last) return null;
  return {
    latest: last.weight,
    change: data.length > 1 ? last.weight - first.weight : null,
  };
}
