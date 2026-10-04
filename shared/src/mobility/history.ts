import { instantToDay } from "../utils/timezone.ts";
import type { MobilitySession } from "../schemas/api/Mobility.api.zod.ts";

/** A recorded workout needs explicitly confirmed movement, not just a timer. */
export function isRecordedMobilitySession(session: MobilitySession): boolean {
  return (
    (session.state === "finished" || session.state === "cancelled") &&
    session.outcomes.some((outcome) => outcome.result === "completed")
  );
}

export function recordedMobilitySessionsOn(
  sessions: MobilitySession[],
  day: string,
  timezone: string,
): MobilitySession[] {
  return sessions
    .filter(
      (session) =>
        isRecordedMobilitySession(session) &&
        instantToDay(new Date(session.startedAt), timezone) === day,
    )
    .sort(
      (a, b) =>
        b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id),
    );
}
