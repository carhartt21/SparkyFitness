import type { DailySummaryResponse } from '@workspace/shared';
import type { FoodEntry } from '@/types/food';
import type { FoodEntryMeal } from '@/types/meal';
import { calculateDayTotals } from '@/utils/nutritionCalculations';
import { diaryEntryImageSrc, usableFoodImages } from '@/utils/foodImages';

type ExerciseSession = DailySummaryResponse['exerciseSessions'][number];

/** Device-synced energy rows are totals, not workouts the user performed. */
const DEVICE_TOTAL_NAMES = new Set(['Active Calories']);

export interface ActivityItem {
  id: string;
  name: string;
  minutes: number;
  calories: number;
  time: string | null;
}

export interface ActivitySummary {
  minutes: number;
  calories: number;
  workouts: number;
  recent: ActivityItem[];
}

function sessionName(session: ExerciseSession): string {
  if (session.type === 'preset') return session.name;
  return session.name ?? session.exercise_snapshot?.name ?? '';
}

/**
 * Minutes, calories and a newest-first list of the day's logged exercise.
 * Device energy totals count toward calories but are not listed as workouts.
 */
export function summarizeActivity(
  sessions: readonly ExerciseSession[] | undefined
): ActivitySummary {
  const recent: ActivityItem[] = [];
  let minutes = 0;
  let calories = 0;
  for (const session of sessions ?? []) {
    const name = sessionName(session);
    if (session.type === 'preset') {
      const sessionCalories = session.exercises.reduce(
        (sum, entry) => sum + (entry.calories_burned || 0),
        0
      );
      minutes += session.total_duration_minutes || 0;
      calories += sessionCalories;
      recent.push({
        id: session.id,
        name,
        minutes: session.total_duration_minutes || 0,
        calories: sessionCalories,
        time: session.exercises[0]?.entry_time ?? null,
      });
      continue;
    }
    calories += session.calories_burned || 0;
    if (DEVICE_TOTAL_NAMES.has(name)) continue;
    minutes += session.duration_minutes || 0;
    recent.push({
      id: session.id,
      name,
      minutes: session.duration_minutes || 0,
      calories: session.calories_burned || 0,
      time: session.entry_time ?? null,
    });
  }
  recent.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
  return { minutes, calories, workouts: recent.length, recent };
}

export interface DashboardMeal {
  /** Meal type name as stored on entries (e.g. "breakfast"). */
  name: string;
  calories: number;
  itemCount: number;
  image: string | null;
}

/**
 * Logged meals for the day in meal-type order, with calories and the first
 * available photo. Meal types without entries are omitted.
 */
export function groupDashboardMeals(
  entries: readonly FoodEntry[],
  meals: readonly FoodEntryMeal[] | undefined,
  mealOrder: readonly string[]
): DashboardMeal[] {
  const key = (value: string) => value.trim().toLowerCase();
  const names = new Map<string, string>();
  for (const item of [...entries, ...(meals ?? [])]) {
    if (item.meal_type) names.set(key(item.meal_type), item.meal_type);
  }
  const order = (name: string) => {
    const index = mealOrder.findIndex((meal) => key(meal) === key(name));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...names.values()]
    .sort((a, b) => order(a) - order(b))
    .map((name) => {
      const mealEntries = entries.filter(
        (entry) => key(entry.meal_type) === key(name)
      );
      const mealGroups = (meals ?? []).filter(
        (meal) => key(meal.meal_type) === key(name)
      );
      const totals = calculateDayTotals([...mealEntries], [...mealGroups]);
      const image =
        mealEntries.map((entry) => diaryEntryImageSrc(entry)).find(Boolean) ??
        mealGroups
          .map(
            (meal) =>
              usableFoodImages(meal.images)[0] ??
              usableFoodImages(meal.meal_images)[0]
          )
          .find(Boolean) ??
        null;
      return {
        name,
        calories: totals.calories,
        itemCount: mealEntries.length + mealGroups.length,
        image,
      };
    });
}
