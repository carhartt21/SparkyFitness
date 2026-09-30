import { format } from 'date-fns';
import {
  instantHourMinuteInZone,
  resolveRecordZone,
  type RecordZone,
} from '@workspace/shared';

/** Legacy stored formats remain valid API values, but the UI uses 24-hour time. */
export function normalizeTimeFormat(_timeFormat: string): string {
  return 'HH:mm';
}

export const formatMinutesToHHMM = (totalMinutes: number): string => {
  const isNegative = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = Math.round(absMinutes % 60);

  if (hours === 0) {
    return isNegative ? `-${minutes}m` : `${minutes}m`;
  }

  const formatted = `${hours}h ${minutes}m`;
  return isNegative ? `-${formatted}` : formatted;
};

export const formatSecondsToHHMM = (totalSeconds: number): string => {
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);
  const totalMinutes = Math.round(absSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return isNegative ? `-${minutes}m` : `${minutes}m`;
  }

  const formatted = `${hours}h ${minutes}m`;
  return isNegative ? `-${formatted}` : formatted;
};

/**
 * Formats a Date or timestamp as a 24-hour time string.
 *
 * @param date - The date to format.
 * @param timeFormat - Legacy account preference (accepted for API compatibility).
 * @returns Formatted time string.
 */
export function formatTimeWithPreference(
  date: Date,
  timeFormat: string
): string {
  if (isNaN(date.getTime())) return '';
  return format(date, normalizeTimeFormat(timeFormat));
}

/**
 * Formats a 'HH:mm' or 'HH:mm:ss' schedule time as a 24-hour clock.
 *
 * @param timeOfDay - Time string such as '14:30' or '14:30:00'.
 * @param timeFormat - Legacy account preference (accepted for API compatibility).
 * @returns Formatted time string.
 */
export function formatTimeOfDayString(
  timeOfDay: string,
  timeFormat: string
): string {
  const parts = timeOfDay.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  if (
    !/^\d{1,2}:\d{1,2}(?::\d{1,2})?$/.test(timeOfDay) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  )
    return '';
  // Use a fixed non-DST calendar date so parsing a schedule time does not
  // shift across DST boundaries and remains consistent regardless of the
  // current date.
  const date = new Date(2000, 0, 1, h, m, 0, 0);
  if (isNaN(date.getTime())) return '';
  return formatTimeWithPreference(date, timeFormat);
}

/**
 * Formats a UTC instant as a time-of-day string in the given record zone
 * (IANA timezone or fixed UTC offset), using the 24-hour clock. Renders from extracted hour/minute rather than a
 * host-local Date so a wall clock that falls inside the browser zone's DST
 * spring-forward gap is not normalized an hour forward. Deliberately
 * independent of PreferencesContext so nothing routes through its
 * literal-date-string heuristics.
 */
export function formatTimeInZone(
  instant: Date | string | number,
  zone: RecordZone,
  timeFormat: string
): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (isNaN(date.getTime())) return '';
  const { hour, minute } = instantHourMinuteInZone(date, zone);
  return formatTimeOfDayString(`${hour}:${minute}`, timeFormat);
}

/**
 * Resolves the display zone for a sleep entry: the entry's recorded IANA
 * timezone, else its recorded UTC offset, else the profile timezone.
 */
export function sleepEntryZone(
  entry: {
    record_timezone?: string | null;
    record_utc_offset_minutes?: number | null;
  },
  fallbackTz: string
): RecordZone {
  return (
    resolveRecordZone(
      entry.record_timezone,
      entry.record_utc_offset_minutes
    ) ?? {
      kind: 'tz',
      tz: fallbackTz,
    }
  );
}

export const formatSecondsClock = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
