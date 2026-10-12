import type { DateType } from 'react-native-ui-datepicker';

/** Normalizes the picker's 6-way `DateType` into a JS `Date`. */
export function dateTypeToDate(date: DateType): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date === 'object' && 'toDate' in date) return date.toDate();
  if (typeof date === 'string') return new Date(date);
  return new Date(date);
}

/** Builds a `Date` seeded with today's date and the given 'HH:MM' (or now if empty/invalid).
 * Shared by phone clock fields and dated fasting editors. */
export function timeStringToDate(value: string): Date {
  const now = new Date();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return now;
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** Formats a `Date` as canonical 'HH:MM'. Exported for the shared time wheel. */
export function dateToTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Changes only the local clock, preserving the selected calendar day. */
export function withLocalTime(date: Date, time: string): Date {
  const next = new Date(date);
  const [hours, minutes] = time.split(':').map(Number);
  next.setHours(hours, minutes, 0, 0);
  return next;
}
