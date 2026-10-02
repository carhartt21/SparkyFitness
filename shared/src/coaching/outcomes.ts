import type {
  CoachingEvidenceRow,
  CoachingCommitment,
} from "../schemas/api/Coaching.api.zod.ts";
import { addDays } from "../utils/timezone.ts";

const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" &&
        value.trim() &&
        Number.isFinite(Number(value))
      ? Number(value)
      : null;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Recorded evidence only. Missing days never enter an average as zero. */
export function evaluateCoachingOutcome(input: {
  rows: readonly CoachingEvidenceRow[];
  success: CoachingCommitment["success"];
  from: string;
  to: string;
  today: string;
  now: Date;
}): NonNullable<CoachingCommitment["outcome"]> {
  const values = new Map<string, number>();
  const { success } = input;
  const metric = success.metric;
  const scheduledValues = new Map<
    string,
    { confirmed: number; total: number }
  >();
  let unknownScheduled = 0;
  const end = input.to < input.today ? input.to : input.today;
  const habit = input.rows.find(
    (row) =>
      row.kind === "habit_definition" &&
      String(object(row.value)["id"]) === success.subjectId,
  );
  const weekdays = habit ? object(habit.value)["days"] : null;
  let days = 0;
  for (let day = input.from; day <= end; day = addDays(day, 1)) {
    if (
      metric !== "habit_completion" ||
      !Array.isArray(weekdays) ||
      weekdays.includes(new Date(`${day}T12:00:00Z`).getUTCDay())
    )
      days++;
  }
  for (const row of input.rows) {
    if (
      row.day &&
      row.day >= input.from &&
      row.day <= end &&
      row.day < input.today &&
      metric === "workout_completion" &&
      row.kind === "workout_adherence" &&
      String(object(row.value)["templateId"]) === success.subjectId &&
      object(row.value)["completionBasis"] === "saved_prescription"
    )
      unknownScheduled += number(object(row.value)["unknown"]) ?? 0;
    if (
      !row.day ||
      row.day < input.from ||
      row.day > end ||
      row.confirmation !== "confirmed"
    )
      continue;
    const data = object(row.value);
    let value: number | null = null;
    if (row.kind === "nutrition_day") {
      if (
        metric === "calories" &&
        data["knownCalorieEntries"] === data["confirmedEntryCount"]
      )
        value = number(data["calories"]);
      else {
        const nutrient = object(object(data["nutrients"])[metric]);
        if (nutrient["knownEntries"] === nutrient["totalEntries"])
          value = number(nutrient["value"]);
      }
      if (success.direction !== "minimum" && data["completeDay"] !== true)
        value = null;
    } else if (
      metric.startsWith("target_exercise_") &&
      row.kind === "exercise" &&
      data["exercise_name"] !== "Active Calories"
    ) {
      value = number(
        data[
          metric === "target_exercise_duration_minutes"
            ? "duration_minutes"
            : "calories_burned"
        ],
      );
      if (success.direction !== "minimum") value = null;
      if (value !== null) value += values.get(row.day) ?? 0;
    } else if (metric === "water_goal_ml" && row.kind === "hydration_day")
      value = number(data["effectiveWaterMl"]);
    else if (metric === "steps" && row.kind === "daily_activity")
      value = number(data["total_steps"]);
    else if (metric === "sleep_minutes" && row.kind === "sleep") {
      const seconds = number(data["time_asleep_in_seconds"]);
      if (seconds !== null) value = seconds / 60;
    } else if (metric === "weight" && row.kind === "measurement")
      value = number(data["weight"]);
    else if (
      metric === "habit_completion" &&
      row.kind === "habit_log" &&
      String(data["category_id"]) === success.subjectId
    ) {
      const target = number(data["target"]),
        logged = number(data["value"]);
      if (logged !== null && target !== null && target > 0)
        value = logged >= target ? 1 : 0;
    } else if (
      metric === "workout_completion" &&
      row.kind === "workout_adherence" &&
      String(data["templateId"]) === success.subjectId &&
      data["completionBasis"] === "saved_prescription"
    ) {
      const scheduled = number(data["eligible"]),
        completed = number(data["completed"]);
      if (scheduled !== null && completed !== null && scheduled > 0)
        scheduledValues.set(row.id, { confirmed: completed, total: scheduled });
      value = number(data["ratio"]);
    } else if (
      metric === "mobility_completion" &&
      row.kind === "mobility_session" &&
      String(object(data["routine"])["id"]) === success.subjectId
    ) {
      const steps = object(data["routine"])["steps"],
        outcomes = data["outcomes"];
      // A timer ending is not confirmation. Every step needs an explicit outcome.
      if (
        Array.isArray(steps) &&
        steps.length > 0 &&
        Array.isArray(outcomes) &&
        outcomes.length === steps.length
      ) {
        const completed = outcomes.filter(
          (outcome) => object(outcome)["result"] === "completed",
        ).length;
        value = completed / steps.length;
        scheduledValues.set(row.id, {
          confirmed: completed,
          total: steps.length,
        });
      }
    } else if (
      metric === "meal_confirmation" &&
      row.kind === "meal_occurrence" &&
      (success.subjectId === null ||
        String(data["template_id"]) === success.subjectId) &&
      ["planned", "skipped", "confirmed"].includes(String(data["state"])) &&
      row.day < input.today
    ) {
      value = data["state"] === "confirmed" ? 1 : 0;
      scheduledValues.set(row.id, { confirmed: value, total: 1 });
    }
    if (value !== null)
      values.set(row.day, Math.max(values.get(row.day) ?? -Infinity, value));
  }
  const recorded = [...values.values()];
  const eligible = [...scheduledValues.values()];
  const knownScheduled = eligible.reduce((sum, item) => sum + item.total, 0);
  const coverage = eligible.length
    ? knownScheduled / (knownScheduled + unknownScheduled)
    : days
      ? Math.min(1, values.size / days)
      : 0;
  const value = eligible.length
    ? eligible.reduce((sum, item) => sum + item.confirmed, 0) /
      eligible.reduce((sum, item) => sum + item.total, 0)
    : !recorded.length
      ? null
      : metric === "weight"
        ? (values.get([...values.keys()].sort().at(-1) ?? "") ?? null)
        : recorded.reduce((sum, item) => sum + item, 0) / recorded.length;
  const enough = value !== null && coverage >= success.minimumCoverage;
  const met =
    enough &&
    (success.direction === "minimum"
      ? value >= success.target
      : success.direction === "maximum"
        ? value <= success.target
        : Math.abs(value - success.target) <=
          Math.max(0.01, Math.abs(success.target) * 0.01));
  return {
    value,
    coverage,
    evaluatedAt: input.now.toISOString(),
    interpretation: !enough
      ? "insufficient_data"
      : met
        ? input.today >= success.reviewDay
          ? "met"
          : "on_track"
        : "below_target",
  };
}
