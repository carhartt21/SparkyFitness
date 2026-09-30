import { addDays, dayOfWeek, daysBetween } from '@workspace/shared';

export type ExerciseReviewWindow = 'day' | 'week' | 'month' | 'year';

interface ExerciseReviewDates {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
}

function calendarStart(
  day: string,
  window: ExerciseReviewWindow,
  offset: number
): string {
  const [year, month] = day.split('-').map(Number);
  if (window === 'day') return addDays(day, -offset);
  if (window === 'week') {
    const mondayOffset = (dayOfWeek(day) + 6) % 7;
    return addDays(day, -mondayOffset - offset * 7);
  }
  if (window === 'year') return `${year - offset}-01-01`;
  const date = new Date(Date.UTC(year, month - 1 - offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function calendarEnd(start: string, window: ExerciseReviewWindow): string {
  if (window === 'day') return start;
  if (window === 'week') return addDays(start, 6);
  if (window === 'year') return `${start.slice(0, 4)}-12-31`;
  return addDays(calendarStart(start, 'month', -1), -1);
}

/** Calendar periods in the device's local day, with an equally elapsed prior period where possible. */
export function exerciseReviewDates(
  today: string,
  window: ExerciseReviewWindow,
  periodsAgo = 0
): ExerciseReviewDates {
  const offset = Math.max(0, Math.floor(periodsAgo));
  const startDate = calendarStart(today, window, offset);
  const endDate = offset === 0 ? today : calendarEnd(startDate, window);
  const previousStartDate = calendarStart(today, window, offset + 1);
  const previousPeriodEnd = calendarEnd(previousStartDate, window);
  const sameElapsedDay = addDays(
    previousStartDate,
    daysBetween(startDate, endDate)
  );
  const previousEndDate =
    offset === 0 && sameElapsedDay < previousPeriodEnd
      ? sameElapsedDay
      : previousPeriodEnd;
  return { startDate, endDate, previousStartDate, previousEndDate };
}
