import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailySummary } from '../types/dailySummary';
import type { UserPreferences } from '../types/preferences';
import type { NutritionActionIdentity } from './nutritionActionOutbox';

export interface DashboardSnapshot {
  version: 1;
  date: string;
  savedAt: number;
  summary: DailySummary;
  preferences: UserPreferences;
}
const keyFor = (identity: NutritionActionIdentity) =>
  `@SparkyFitness/dashboard-cache/v1/${encodeURIComponent(identity.serverConfigId)}/${encodeURIComponent(identity.userId)}`;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function valid(value: unknown): value is DashboardSnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<DashboardSnapshot>;
  return (
    s.version === 1 &&
    typeof s.date === 'string' &&
    typeof s.savedAt === 'number' &&
    s.savedAt <= Date.now() &&
    Date.now() - s.savedAt < MAX_AGE &&
    s.summary?.date === s.date &&
    !!s.preferences &&
    typeof s.preferences === 'object' &&
    !!s.summary.calorieBalance &&
    ['eaten', 'burned', 'remaining', 'goal', 'progress'].every((key) =>
      Number.isFinite(s.summary?.calorieBalance[key as 'remaining'])
    ) &&
    [
      'calorieGoal',
      'caloriesConsumed',
      'caloriesBurned',
      'activeCalories',
      'otherExerciseCalories',
      'netCalories',
      'remainingCalories',
      'stepCalories',
      'exerciseMinutes',
      'exerciseMinutesGoal',
      'exerciseCaloriesGoal',
      'waterConsumed',
      'waterGoal',
      'waterFromFood',
    ].every((key) => Number.isFinite(s.summary?.[key as 'calorieGoal'])) &&
    !!s.summary.goals &&
    typeof s.summary.goals === 'object' &&
    !!s.summary.supplementTotals &&
    typeof s.summary.supplementTotals === 'object' &&
    !!s.summary.customNutrientTotals &&
    typeof s.summary.customNutrientTotals === 'object' &&
    !!s.summary.customNutrientGoals &&
    typeof s.summary.customNutrientGoals === 'object' &&
    ['protein', 'carbs', 'fat', 'fiber'].every((key) => {
      const metric = s.summary?.[key as 'protein'];
      return (
        metric &&
        Number.isFinite(metric.consumed) &&
        Number.isFinite(metric.goal)
      );
    }) &&
    Array.isArray(s.summary.foodEntries) &&
    Array.isArray(s.summary.exerciseEntries)
  );
}

export async function readDashboardSnapshot(
  identity: NutritionActionIdentity,
  date: string
): Promise<DashboardSnapshot | null> {
  try {
    const values: unknown = JSON.parse(
      (await AsyncStorage.getItem(keyFor(identity))) ?? '[]'
    );
    return Array.isArray(values)
      ? (values.filter(valid).find((s) => s.date === date) ?? null)
      : null;
  } catch {
    return null;
  }
}
let tail: Promise<void> = Promise.resolve();
export function saveDashboardSnapshot(
  identity: NutritionActionIdentity,
  snapshot: DashboardSnapshot
): Promise<void> {
  const work = async () => {
    let raw: unknown = [];
    try {
      raw = JSON.parse((await AsyncStorage.getItem(keyFor(identity))) ?? '[]');
    } catch {
      /* Replace a damaged cache with this successful live response. */
    }
    const current = Array.isArray(raw) ? raw.filter(valid) : [];
    const next = [
      snapshot,
      ...current.filter((s) => s.date !== snapshot.date),
    ].slice(0, 7);
    await AsyncStorage.setItem(keyFor(identity), JSON.stringify(next));
  };
  const result = tail.then(work, work);
  tail = result.catch(() => {});
  return result;
}
