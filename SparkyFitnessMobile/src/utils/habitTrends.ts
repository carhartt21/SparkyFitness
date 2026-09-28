import {
  habitDayState,
  isHabitDue,
  type Habit,
  type HabitDayState,
  type HabitLog,
} from '@workspace/shared';
import { addDays } from './dateUtils';

export interface HabitTrendDay {
  date: string;
  scheduled: boolean;
  state: HabitDayState;
  /** The saved value, or null when nothing was recorded. */
  value: number | null;
}

export interface HabitTrend {
  days: HabitTrendDay[];
  scheduledDays: number;
  /** Days with any explicit record (including an explicit 0 or "not done"). */
  loggedDays: number;
  completedDays: number;
  /** Mean of recorded count values; null without a record. */
  average: number | null;
  best: number | null;
  /**
   * Completed scheduled days in a row, ending today or, while today is still
   * unrecorded, yesterday. Unscheduled days neither extend nor break it.
   */
  currentStreak: number;
}

/** Oldest-first day list for `rangeDays` days ending on `endDate`. */
export function trendDates(endDate: string, rangeDays: number): string[] {
  return Array.from({ length: rangeDays }, (_, index) =>
    addDays(endDate, index - rangeDays + 1)
  );
}

export function computeHabitTrend(
  habit: Habit,
  logs: readonly HabitLog[],
  endDate: string,
  rangeDays: number
): HabitTrend {
  const byDate = new Map(
    logs
      .filter((log) => log.habit_id === habit.id)
      .map((log) => [log.entry_date, log])
  );
  const days = trendDates(endDate, rangeDays).map((date) => {
    const log = byDate.get(date);
    return {
      date,
      scheduled: isHabitDue({ active: true, days: habit.days }, date),
      state: habitDayState(habit, log),
      value: log ? log.value : null,
    };
  });
  const recorded = days.filter((day) => day.value !== null);
  const values = recorded.map((day) => day.value as number);

  let currentStreak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (!day.scheduled) continue;
    if (day.state === 'complete') {
      currentStreak += 1;
      continue;
    }
    // Today may still be logged later; it does not break the streak yet.
    if (index === days.length - 1 && day.state === 'not_recorded') continue;
    break;
  }

  return {
    days,
    scheduledDays: days.filter((day) => day.scheduled).length,
    loggedDays: recorded.length,
    completedDays: days.filter((day) => day.state === 'complete').length,
    average:
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null,
    best: values.length > 0 ? Math.max(...values) : null,
    currentStreak,
  };
}
