import { addDays, localDateTimeToUtc } from "../utils/timezone.ts";
import type {
  MobilityRoutine,
  MobilitySchedule,
  MobilitySession,
} from "../schemas/api/Mobility.api.zod.ts";

/** Calendar weekdays (Sunday = 0), independent of the host's timezone/DST. */
export function mobilityScheduleDays(
  schedule: MobilitySchedule,
  from: string,
  to: string,
): string[] {
  const result: string[] = [];
  if (!schedule.enabled) return result;
  for (
    let day = from, count = 0;
    day <= to && count < 93;
    day = addDays(day, 1), count++
  ) {
    if (day < schedule.startDay || (schedule.endDay && day > schedule.endDay))
      continue;
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (schedule.weekdays.includes(weekday)) result.push(day);
  }
  return result;
}
export function mobilityScheduledAt(
  day: string,
  time: string,
  timezone: string,
): Date {
  return localDateTimeToUtc(`${day}T${time}`, timezone);
}
export function mobilitySnapshotUnchanged(
  before: MobilitySession,
  after: MobilitySession,
): boolean {
  return (
    before.startedAt === after.startedAt &&
    before.planId === after.planId &&
    JSON.stringify(before.routine) === JSON.stringify(after.routine)
  );
}
export function mobilityOutcomeIdsValid(
  routine: MobilityRoutine,
  outcomes: MobilitySession["outcomes"],
): boolean {
  const ids = new Set(routine.steps.map((step) => step.id));
  return (
    outcomes.every((outcome) => ids.has(outcome.stepId)) &&
    new Set(outcomes.map((outcome) => outcome.stepId)).size === outcomes.length
  );
}
