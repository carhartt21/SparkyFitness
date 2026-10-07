import { instantHourMinuteInZone, resolveRecordZone } from "./timezone.ts";

/** Source time only: a date or import/sync time cannot establish a workout clock. */
export function importedWorkoutClock(
  record: Readonly<Record<string, unknown>>,
  timezone: string,
): string | null {
  const instant = [
    record["startDate"],
    record["startTime"],
    record["start_time"],
    record["timestamp"],
  ].find(
    (value): value is string =>
      typeof value === "string" &&
      /T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value) &&
      Number.isFinite(Date.parse(value)),
  );
  if (!instant) return null;
  const zone = resolveRecordZone(
    typeof record["record_timezone"] === "string"
      ? record["record_timezone"]
      : null,
    typeof record["record_utc_offset_minutes"] === "number"
      ? record["record_utc_offset_minutes"]
      : null,
  ) ?? { kind: "tz" as const, tz: timezone };
  const { hour, minute } = instantHourMinuteInZone(instant, zone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
