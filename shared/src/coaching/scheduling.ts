import {
  addDays,
  instantToDay,
  localDateTimeToUtc,
} from "../utils/timezone.ts";
import type { CoachingSettings } from "../schemas/api/Coaching.api.zod.ts";

export interface CoachingDueSlot {
  kind: "daily" | "weekly";
  slotKey: string;
  from: string;
  to: string;
  scheduledAt: Date;
}
/** Choose the most recent eligible window. Missed windows never become a queue. */
export function dueCoachingSlot(input: {
  now: Date;
  timezone: string;
  settings: CoachingSettings;
  lastCompletedAt: Date | null;
  lastWeeklyCompletedAt: Date | null;
}): CoachingDueSlot | null {
  if (!input.settings.enabled) return null;
  const today = instantToDay(input.now, input.timezone);
  const daily: CoachingDueSlot[] = [];
  const weekly: CoachingDueSlot[] = [];
  for (let ago = 0; ago < 8; ago += 1) {
    const day = addDays(today, -ago);
    const at = (time: string) =>
      localDateTimeToUtc(`${day}T${time}`, input.timezone);
    if (ago < 2)
      for (const [period, time] of [
        ["morning", input.settings.morningTime],
        ["evening", input.settings.eveningTime],
      ] as const) {
        const scheduledAt = at(time);
        if (
          scheduledAt <= input.now &&
          (!input.lastCompletedAt || scheduledAt > input.lastCompletedAt)
        )
          daily.push({
            kind: "daily",
            slotKey: `daily:${day}:${period}`,
            from: addDays(today, -6),
            to: today,
            scheduledAt,
          });
      }
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === input.settings.weeklyDay) {
      const scheduledAt = at(input.settings.weeklyTime);
      if (
        scheduledAt <= input.now &&
        (!input.lastWeeklyCompletedAt ||
          scheduledAt > input.lastWeeklyCompletedAt)
      )
        weekly.push({
          kind: "weekly",
          slotKey: `weekly:${day}`,
          from: addDays(today, -27),
          to: today,
          scheduledAt,
        });
    }
  }
  const newest = (slots: CoachingDueSlot[]) =>
    slots.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())[0];
  return newest(weekly) ?? newest(daily) ?? null;
}

export function coachingActionDomain(
  kind: string,
): "nutrition" | "activity" | "habits" | "measurements" | null {
  if (kind === "meal_plan" || kind === "goals") return "nutrition";
  if (kind === "workout_plan" || kind === "mobility") return "activity";
  if (kind === "habit") return "habits";
  if (kind === "measurement_reminder") return "measurements";
  return null;
}

export function coachingMetricDomain(
  metric: string,
): "nutrition" | "activity" | "recovery" | "habits" | "measurements" {
  if (metric === "sleep_minutes") return "recovery";
  if (metric === "habit_completion") return "habits";
  if (metric === "weight") return "measurements";
  if (
    metric === "steps" ||
    metric === "workout_completion" ||
    metric === "mobility_completion" ||
    metric.startsWith("target_exercise_")
  )
    return "activity";
  return "nutrition";
}
