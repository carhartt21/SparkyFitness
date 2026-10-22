import type { DateType } from 'react-native-ui-datepicker';
import {
  dayToPickerDate,
  isDayString,
  localDateToDay,
} from '@workspace/shared';

/** Convert the incumbent calendar's value without shifting calendar-day strings. */
export function selectedCalendarDay(date: DateType): string | null {
  if (!date) return null;
  if (typeof date === 'string') return isDayString(date) ? date : null;
  const value =
    date instanceof Date
      ? date
      : typeof date === 'object' && 'toDate' in date
        ? date.toDate()
        : new Date(date);
  return Number.isFinite(value.getTime()) ? localDateToDay(value) : null;
}

export function calendarDayValue(day: string): Date {
  return dayToPickerDate(day);
}
