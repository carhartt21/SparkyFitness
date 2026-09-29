import { toHourMinute } from '@workspace/shared';

/** Legacy account values are accepted, but X on Track displays 24-hour time. */
export type EntryTimeFormat = 'HH:mm' | 'h:mm A' | 'h:mm a';

/**
 * Formats stored wall-clock time as HH:mm, independent of legacy account
 * preferences and locale. Returns null for missing or invalid values.
 */
export function formatTimeLabel(
  time: string | null | undefined,
  _timeFormat?: EntryTimeFormat | null,
  _locale?: string
): string | null {
  return toHourMinute(time);
}

/** Formats a whole hour for a compact chart axis, e.g. "22". */
export function formatHourLabel(
  hour24: number,
  _timeFormat?: EntryTimeFormat | null,
  _locale?: string
): string {
  return String(hour24).padStart(2, '0');
}

/** Legacy picker callers use this; all app time pickers now use 24 hours. */
export function is12HourTimeFormat(
  _timeFormat?: EntryTimeFormat | null,
  _locale?: string
): boolean {
  return false;
}

/** Formats a Date instance as a local HH:mm clock time. */
export function formatDateToTimeLabel(
  date: Date,
  _timeFormat?: EntryTimeFormat | null,
  _locale?: string
): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
