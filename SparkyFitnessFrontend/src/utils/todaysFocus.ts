import { addDays } from '@workspace/shared';

/**
 * Consecutive days with logged food ending at `endDay`. An unlogged end day
 * does not break the streak yet (the day may still be in progress), so the
 * count then starts from the previous day. Days are `YYYY-MM-DD` strings.
 */
export function computeLoggingStreak(
  loggedDays: Iterable<string>,
  endDay: string
): number {
  const logged = new Set(loggedDays);
  let cursor = logged.has(endDay) ? endDay : addDays(endDay, -1);
  let streak = 0;
  while (logged.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export type FocusItemKey = 'energy' | 'protein' | 'water' | 'logged';

export interface FocusItem {
  key: FocusItemKey;
  met: boolean;
  current: number;
  goal: number;
}

export interface FocusInputs {
  caloriesEaten: number;
  calorieGoal: number;
  proteinConsumed: number;
  proteinGoal: number;
  waterMl: number | null;
  waterGoalMl: number;
  foodEntryCount: number;
}

/**
 * Read-only checks for the selected day, derived only from goals the user has
 * configured. A goal of zero omits its item instead of inventing a target.
 */
export function buildTodaysFocus(input: FocusInputs): FocusItem[] {
  const items: FocusItem[] = [];
  if (input.calorieGoal > 0) {
    items.push({
      key: 'energy',
      met: input.caloriesEaten > 0 && input.caloriesEaten <= input.calorieGoal,
      current: input.caloriesEaten,
      goal: input.calorieGoal,
    });
  }
  if (input.proteinGoal > 0) {
    items.push({
      key: 'protein',
      met: input.proteinConsumed >= input.proteinGoal,
      current: input.proteinConsumed,
      goal: input.proteinGoal,
    });
  }
  if (input.waterGoalMl > 0 && input.waterMl != null) {
    items.push({
      key: 'water',
      met: input.waterMl >= input.waterGoalMl,
      current: input.waterMl,
      goal: input.waterGoalMl,
    });
  }
  items.push({
    key: 'logged',
    met: input.foodEntryCount > 0,
    current: input.foodEntryCount,
    goal: 1,
  });
  return items;
}
