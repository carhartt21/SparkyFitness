import { localDateTimeToUtc, utcToLocalDateTimeInput } from '@workspace/shared';

export interface DiaryTimelineItem {
  id: string;
  timestamp: number | null;
}

/** Occurrence times only: never substitute creation/sync times for missing times. */
export function diaryTimestamp(
  day: string,
  value: string | null | undefined,
  timezone: string
): number | null {
  if (!value) return null;
  const clock = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (clock) {
    if (
      Number(clock[1]) > 23 ||
      Number(clock[2]) > 59 ||
      Number(clock[3] ?? 0) > 59
    )
      return null;
    try {
      const date = localDateTimeToUtc(
        `${day}T${clock[1]}:${clock[2]}`,
        timezone
      );
      const timestamp = date.getTime() + Number(clock[3] ?? 0) * 1000;
      return Number.isFinite(timestamp) ? timestamp : null;
    } catch {
      return null;
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** A backfilled wellness log's recording instant is not its occurrence time. */
export function wellnessTimestamp(
  day: string,
  recordedAt: string,
  timezone: string
): number | null {
  return utcToLocalDateTimeInput(recordedAt, timezone).slice(0, 10) === day
    ? diaryTimestamp(day, recordedAt, timezone)
    : null;
}

export function sortDiaryTimeline<T extends DiaryTimelineItem>(
  entries: readonly T[]
): T[] {
  return [...entries].sort((a, b) => {
    if (a.timestamp === null && b.timestamp !== null) return 1;
    if (b.timestamp === null && a.timestamp !== null) return -1;
    return (a.timestamp ?? 0) - (b.timestamp ?? 0) || a.id.localeCompare(b.id);
  });
}
