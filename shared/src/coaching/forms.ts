import type { CoachingAction } from "../schemas/api/Coaching.api.zod.ts";
import { coachingPlanningItemSchema } from "../schemas/api/Coaching.api.zod.ts";
import type { z } from "zod";
import { coachingMetricUnits } from "../schemas/api/Coaching.api.zod.ts";

export type CoachingReferenceKind = z.infer<
  typeof coachingPlanningItemSchema
>["kind"];
export const coachingReferenceFields: Record<string, CoachingReferenceKind> = {
  habitId: "habit",
  routineId: "mobility_routine",
  scheduleId: "mobility_schedule",
  food_id: "food",
  variant_id: "variant",
  meal_id: "meal",
  meal_type_id: "meal_type",
  exercise_id: "exercise",
  exerciseId: "exercise",
  workout_preset_id: "workout_preset",
};
export const coachingFieldOptions: Record<string, readonly string[]> = {
  direction: ["minimum", "maximum", "exact"],
  habit_type: ["completion", "count"],
  cue: ["off", "haptic", "sound", "both"],
  side: ["both", "left", "right"],
  item_type: ["food", "meal"],
  schedule_type: ["weekly", "sequential"],
  set_type: ["working", "warmup", "dropset", "failure"],
  kind: ["timed", "repetitions"],
};
type Json = z.infer<ReturnType<typeof z.json>>;
export const coachingWeekdayFields = new Set([
  "days",
  "weekdays",
  "habit_days",
  "reminder_days",
]);
/** Nullable schedules mean every day; never let a review create zero weekdays. */
export function coachingSelectedWeekdays(value: Json): number[] {
  return value === null
    ? [0, 1, 2, 3, 4, 5, 6]
    : Array.isArray(value)
      ? value.filter((day): day is number => typeof day === "number")
      : [];
}
export function coachingToggleWeekday(value: Json, day: number): number[] {
  const selected = coachingSelectedWeekdays(value);
  return selected.includes(day)
    ? selected.length === 1
      ? selected
      : selected.filter((item) => item !== day)
    : [...selected, day].sort((a, b) => a - b);
}
/** Keep dependent fields valid when either review editor changes a discriminator. */
export function coachingChangeField(
  value: Record<string, Json>,
  field: string,
  next: Json,
  reference?: Json,
): Record<string, Json> {
  if (
    field === "habitId" &&
    next &&
    reference &&
    typeof reference === "object" &&
    !Array.isArray(reference) &&
    (reference["habit_type"] === "completion" ||
      reference["habit_type"] === "count")
  ) {
    const previous = value["definition"];
    const definition =
      previous && typeof previous === "object" && !Array.isArray(previous)
        ? previous
        : {};
    return {
      ...value,
      habitId: next,
      definition: { ...definition, ...reference },
    };
  }
  if (
    (field === "metric" || field === "field") &&
    typeof next === "string" &&
    next in coachingMetricUnits
  )
    return {
      ...value,
      [field]: next,
      unit: coachingMetricUnits[next as keyof typeof coachingMetricUnits],
    };
  if (field === "habit_type")
    return {
      ...value,
      [field]: next,
      target: next === "count" ? 1 : null,
      step: next === "count" ? 1 : null,
    };
  if (field === "kind" && (next === "timed" || next === "repetitions")) {
    const { durationSeconds, repetitions, ...common } = value;
    return next === "timed"
      ? {
          ...common,
          kind: next,
          durationSeconds:
            typeof durationSeconds === "number" ? durationSeconds : 30,
        }
      : {
          ...common,
          kind: next,
          repetitions: typeof repetitions === "number" ? repetitions : 10,
        };
  }
  if (field === "item_type" && next !== value[field]) {
    const common = {
      item_type: next,
      day_of_week: value["day_of_week"] ?? 0,
      meal_type_id: value["meal_type_id"] ?? "",
      quantity: next === "meal" ? 1 : 100,
      unit: next === "meal" ? "serving" : "g",
    };
    return next === "meal"
      ? { ...common, meal_id: "" }
      : { ...common, food_id: "", variant_id: null };
  }
  if (field === "schedule_type" && Array.isArray(value["assignments"])) {
    return {
      ...value,
      [field]: next,
      assignments: value["assignments"].map((assignment, index) => {
        if (
          !assignment ||
          typeof assignment !== "object" ||
          Array.isArray(assignment)
        )
          return assignment;
        return {
          ...assignment,
          day_of_week:
            next === "weekly" ? (assignment["day_of_week"] ?? index % 7) : null,
          session_index:
            next === "sequential"
              ? (assignment["session_index"] ?? index)
              : null,
        };
      }),
    };
  }
  if (field === "exercise_id" && "workout_preset_id" in value && next)
    return { ...value, [field]: next, workout_preset_id: null };
  if (field === "workout_preset_id" && "exercise_id" in value && next)
    return { ...value, [field]: next, exercise_id: null };
  return { ...value, [field]: next };
}
export function coachingTemplateReference(
  action: CoachingAction,
): CoachingReferenceKind | null {
  return action.kind === "meal_plan"
    ? "meal_plan"
    : action.kind === "workout_plan"
      ? "workout_plan"
      : null;
}
export const coachingFieldLabels: Record<string, string> = {
  title: "Title",
  kind: "Step type",
  step: "Count increment",
  icon: "Icon",
  description: "Description",
  dueDay: "Due date",
  reminderTime: "Reminder time",
  success: "Success measure",
  metric: "Metric",
  subjectId: "Tracked item",
  unit: "Unit",
  baseline: "Baseline",
  target: "Target",
  direction: "Direction",
  minimumCoverage: "Minimum data coverage (0–1)",
  reviewDay: "Review date",
  habitId: "Habit to update",
  definition: "Details",
  name: "Name",
  habit_type: "Habit type",
  target_value: "Target",
  days: "Weekdays",
  reminder_time: "Reminder time",
  active: "Active",
  measurement_key: "Measurement",
  enabled: "Enabled",
  changes: "Changes",
  effectiveDay: "Effective date",
  field: "Target",
  before: "Current value",
  after: "New value",
  templateId: "Plan to revise",
  plan_name: "Plan name",
  start_date: "Start date",
  end_date: "End date",
  is_active: "Active",
  assignments: "Scheduled items",
  item_type: "Item type",
  day_of_week: "Weekday (Sunday = 0)",
  meal_type_id: "Diary section",
  food_id: "Food",
  variant_id: "Serving option",
  quantity: "Quantity",
  meal_id: "Meal",
  session_index: "Session number",
  session_name: "Session name",
  workout_preset_id: "Workout preset",
  exercise_id: "Exercise",
  sort_order: "Order",
  sets: "Sets",
  set_number: "Set number",
  set_type: "Set type",
  reps: "Repetitions",
  weight: "Weight (kg)",
  duration: "Duration (seconds)",
  rest_time: "Rest (seconds)",
  notes: "Notes",
  routineId: "Routine to revise",
  scheduleId: "Schedule to revise",
  repetitions: "Repetitions",
  steps: "Steps",
  instructions: "Instructions",
  side: "Side",
  durationSeconds: "Duration (seconds)",
  transitionSeconds: "Transition (seconds)",
  exerciseId: "Linked exercise",
  cue: "Cue",
  schedule: "Schedule",
  weekdays: "Weekdays",
  time: "Time",
  startDay: "Start date",
  endDay: "End date",
  remote_enabled: "Remote delivery",
  quiet_start: "Quiet hours start",
  quiet_end: "Quiet hours end",
  daily_limit: "Daily notification limit",
  hydration_enabled: "Hydration reminders",
  meal_capture_enabled: "Meal reminders",
  meal_review_enabled: "Photo review reminders",
  movement_break_enabled: "Movement reminders",
  mobility_enabled: "Mobility reminders",
  hydration_interval_hours: "Drink interval (hours)",
  hydration_start: "Drink window start",
  hydration_end: "Drink window end",
  meal_capture_start: "Meal window start",
  meal_capture_end: "Meal window end",
  meal_capture_time: "Meal reminder time",
  meal_review_time: "Photo review time",
  movement_break_time: "Movement reminder time",
  habit_days: "Weekdays",
  habit_target: "Target",
  habit_active: "Active",
  measurement_type: "Unit",
  reminder_enabled: "Reminder enabled",
  reminder_days: "Weekdays",
};
/** Credentials, internal IDs and fixed action discriminators are never editable. */
export const coachingHiddenFields = new Set([
  "kind",
  "table",
  "id",
  "entry_mode",
  "created_at",
  "updated_at",
  "user_id",
  "revision",
  "created_by_user_id",
  "template_id",
  "assignment_id",
]);

/** Typed editor defaults allow adding a first set or re-enabling a schedule. */
export function coachingNewArrayItem(
  field: string,
  action: CoachingAction | undefined,
  uuid: () => string,
): z.infer<ReturnType<typeof z.json>> | null {
  if (field === "sets")
    return {
      set_number: 1,
      set_type: "working",
      reps: null,
      weight: null,
      duration: null,
      rest_time: null,
      notes: null,
    };
  if (field === "steps")
    return {
      id: uuid(),
      kind: "timed",
      name: "",
      instructions: "",
      side: "both",
      exerciseId: null,
      durationSeconds: 30,
      transitionSeconds: 5,
    };
  if (field === "changes" && action?.kind === "goals")
    return { field: "protein", before: null, after: 0, unit: "g" };
  if (field === "assignments" && action?.kind === "meal_plan")
    return {
      item_type: "food",
      day_of_week: 0,
      meal_type_id: "",
      food_id: "",
      variant_id: null,
      quantity: 100,
      unit: "g",
    };
  if (field === "assignments" && action?.kind === "workout_plan")
    return {
      day_of_week: action.definition.schedule_type === "weekly" ? 0 : null,
      session_index:
        action.definition.schedule_type === "sequential" ? 0 : null,
      session_name: null,
      workout_preset_id: null,
      exercise_id: null,
      sort_order: 0,
      sets: [],
    };
  return null;
}
