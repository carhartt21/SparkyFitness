import {
  instantHourMinute,
  instantToDay,
  localDateTimeToUtc,
} from "../utils/timezone.ts";
import type {
  EngagementReminderKindV2,
  EngagementSettingsV2,
} from "../schemas/api/Engagement.api.zod.ts";
export interface OptionalReminderSlot {
  id: string;
  preferredAt: number;
  earliestAt: number;
  expiresAt: number;
  flexibilityMinutes: number;
}
export function engagementQuietAt(
  at: number,
  timezone: string,
  start: string,
  end: string,
): boolean {
  const clock = instantHourMinute(new Date(at), timezone);
  const time = `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`;
  return (
    start !== end &&
    (start < end ? time >= start && time < end : time >= start || time < end)
  );
}
/** Same clock-injected spacing/quiet-hours/cap policy for native and server. */
export function selectOptionalReminderSlots<
  T extends OptionalReminderSlot,
>(input: {
  candidates: readonly T[];
  now: number;
  dailyLimit: number | null;
  occupied: readonly number[];
  timezone: string;
  quietStart: string;
  quietEnd: string;
  spacingMinutes?: number;
}): T[] {
  const result: T[] = [];
  const spacing = (input.spacingMinutes ?? 20) * 60_000;
  for (const candidate of [...input.candidates].sort(
    (a, b) => a.preferredAt - b.preferredAt || a.id.localeCompare(b.id),
  )) {
    if (input.dailyLimit !== null && result.length >= input.dailyLimit) break;
    let at = Math.max(candidate.preferredAt, candidate.earliestAt, input.now);
    const latest = Math.min(
      candidate.expiresAt,
      candidate.preferredAt + candidate.flexibilityMinutes * 60_000,
    );
    while (at <= latest) {
      const clash = [
        ...input.occupied,
        ...result.map((item) => item.preferredAt),
      ].find((time) => Math.abs(time - at) < spacing);
      if (clash !== undefined) {
        at = clash + spacing;
        continue;
      }
      if (
        engagementQuietAt(at, input.timezone, input.quietStart, input.quietEnd)
      ) {
        at += 60_000;
        continue;
      }
      break;
    }
    if (at <= latest) result.push({ ...candidate, preferredAt: at });
  }
  return result;
}
export interface EngagementSubject {
  kind: EngagementReminderKindV2;
  id: string;
  time: string;
  resolved: boolean | null;
  enabled: boolean;
  expires?: string;
}
export interface EngagementFacts {
  paused: boolean;
  capturedTimes: string[] | null;
  resolvedMealTimes: string[] | null;
  pendingPhotoCount: number | null;
  water: { latestAt: string | null; goalMet: boolean | null } | null;
  movementStarted: boolean | null;
  subjects: EngagementSubject[];
}
export interface EngagementPlanSlot extends OptionalReminderSlot {
  kind: EngagementReminderKindV2;
  subjectId: string;
  localDay: string;
}
export interface EngagementDiagnostic {
  kind: EngagementReminderKindV2;
  reason: string;
  next_at: string | null;
}
export function deriveEngagementPlan(input: {
  now: Date;
  timezone: string;
  settings: EngagementSettingsV2;
  facts: EngagementFacts;
}): {
  candidates: EngagementPlanSlot[];
  diagnostics: EngagementDiagnostic[];
  unresolvedSubjects: Array<{
    kind: EngagementReminderKindV2;
    subjectId: string;
  }>;
} {
  const { now, timezone, settings, facts } = input;
  const day = instantToDay(now, timezone);
  const at = (time: string) =>
    localDateTimeToUtc(`${day}T${time.slice(0, 5)}`, timezone).getTime();
  const end = at("23:59");
  const candidates: EngagementPlanSlot[] = [];
  const diagnostics: EngagementDiagnostic[] = [];
  const unresolvedSubjects: Array<{
    kind: EngagementReminderKindV2;
    subjectId: string;
  }> = [];
  const add = (
    kind: EngagementReminderKindV2,
    subjectId: string,
    time: number,
    expires: number,
    resolved: boolean | null,
    enabled: boolean,
  ) => {
    if (enabled && !facts.paused && resolved === false)
      unresolvedSubjects.push({ kind, subjectId });
    const reason = !enabled
      ? "disabled"
      : facts.paused
        ? "paused"
        : resolved === null
          ? "data_unavailable"
          : resolved
            ? "resolved"
            : time < now.getTime() - 20 * 60_000 || expires < now.getTime()
              ? "expired"
              : "scheduled";
    diagnostics.push({
      kind,
      reason,
      next_at: reason === "scheduled" ? new Date(time).toISOString() : null,
    });
    if (reason === "scheduled")
      candidates.push({
        id: `${kind}:${subjectId}:${day}:${time}`,
        kind,
        subjectId,
        localDay: day,
        preferredAt: time,
        earliestAt: time,
        expiresAt: Math.min(expires, time + 20 * 60_000),
        flexibilityMinutes: 20,
      });
  };
  const start = at(settings.meal_capture_start),
    finish = at(settings.meal_capture_end);
  const captured = facts.capturedTimes?.some((time) => {
    const value = Date.parse(time);
    return value >= start && value < finish;
  });
  const explicit = facts.resolvedMealTimes?.some(
    (time) => at(time) >= start && at(time) < finish,
  );
  add(
    "meal_capture",
    "selected",
    at(settings.meal_capture_time),
    finish,
    facts.capturedTimes === null || facts.resolvedMealTimes === null
      ? null
      : !!captured || !!explicit,
    settings.meal_capture_enabled && start < finish,
  );
  add(
    "meal_review",
    "photos",
    at(settings.meal_review_time),
    end,
    facts.pendingPhotoCount === null ? null : facts.pendingPhotoCount === 0,
    settings.meal_review_enabled,
  );
  add(
    "movement_break",
    "movement",
    at(settings.movement_break_time),
    end,
    facts.movementStarted,
    settings.movement_break_enabled,
  );
  for (const subject of facts.subjects)
    add(
      subject.kind,
      subject.id,
      at(subject.time),
      subject.expires ? at(subject.expires) : end,
      subject.resolved,
      subject.enabled &&
        (subject.kind !== "mobility" || settings.mobility_enabled),
    );
  // Hydration fills remaining slots after explicit timed tasks. Cadence is
  // anchored to the latest real drink, never to the cron's current minute.
  const hydrationStart = at(settings.hydration_start),
    hydrationEnd = at(settings.hydration_end);
  if (
    settings.hydration_enabled &&
    !facts.paused &&
    facts.water &&
    facts.water.goalMet !== null &&
    !facts.water.goalMet &&
    hydrationStart < hydrationEnd
  ) {
    const interval = settings.hydration_interval_hours * 3600_000;
    const latest = facts.water.latestAt
      ? Date.parse(facts.water.latestAt)
      : hydrationStart - interval;
    for (
      let time = Math.max(hydrationStart, latest + interval), n = 0;
      time < hydrationEnd && n < 24;
      time += interval, n++
    )
      add(
        "hydration",
        "water",
        time,
        Math.min(time + 20 * 60_000, hydrationEnd),
        false,
        true,
      );
  } else
    diagnostics.push({
      kind: "hydration",
      reason: !settings.hydration_enabled
        ? "disabled"
        : facts.paused
          ? "paused"
          : facts.water?.goalMet
            ? "resolved"
            : "data_unavailable",
      next_at: null,
    });
  return { candidates, diagnostics, unresolvedSubjects };
}
