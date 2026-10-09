import { localDateTimeToUtc, utcToLocalDateTimeInput } from '@workspace/shared';

/** Reject nonexistent DST times and future intakes before any mutation. */
export function supplementIntakeTimestamp(
  date: string,
  time: string,
  timezone: string,
  now = new Date()
): string | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return null;
  const local = `${date}T${time}`;
  const instant = localDateTimeToUtc(local, timezone);
  if (!Number.isFinite(instant.getTime()) || instant.getTime() > now.getTime())
    return null;
  const iso = instant.toISOString();
  return utcToLocalDateTimeInput(iso, timezone) === local ? iso : null;
}
