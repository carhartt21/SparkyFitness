import { z } from "zod";
import {
  dailyCheckinStateSchema,
  habitTypeSchema,
  healthContextKindSchema,
  mealDayStatusValueSchema,
  measurementKeySchema,
  measurementReminderDaypartSchema,
  weekdaySchema,
} from "../database/DailyTracking.zod.ts";

const day = z.iso.date();
const rating = z.number().int().min(1).max(5);
const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM");
const tag = z.string().trim().min(1).max(40);
const weekdays = z
  .array(weekdaySchema)
  .min(1)
  .max(7)
  .refine((days) => new Set(days).size === days.length, "Duplicate weekday");

// --- Daily check-in -------------------------------------------------------

export const dailyCheckinResponsesSchema = z.object({
  overall_day: rating.nullable().optional(),
  energy: rating.nullable().optional(),
  stress: rating.nullable().optional(),
  sleep_quality: rating.nullable().optional(),
  nutrition_on_track: rating.nullable().optional(),
  activity: rating.nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  tags: z.array(tag).max(20).optional(),
});
export type DailyCheckinResponses = z.infer<typeof dailyCheckinResponsesSchema>;

/**
 * Save a draft or complete the check-in. "skipped" has its own endpoint so a
 * skip can never carry responses.
 */
export const saveDailyCheckinRequestSchema = dailyCheckinResponsesSchema.extend({
  state: z.enum(["draft", "completed"]),
  question_version: z.number().int().min(1).optional(),
});
export type SaveDailyCheckinRequest = z.infer<
  typeof saveDailyCheckinRequestSchema
>;

export const dailyCheckinResponseSchema = z.object({
  id: z.uuid(),
  entry_date: day,
  state: dailyCheckinStateSchema,
  question_version: z.number().int(),
  overall_day: rating.nullable(),
  energy: rating.nullable(),
  stress: rating.nullable(),
  sleep_quality: rating.nullable(),
  nutrition_on_track: rating.nullable(),
  activity: rating.nullable(),
  note: z.string().nullable(),
  tags: z.array(z.string()),
  completed_at: z.string().nullable(),
  skipped_at: z.string().nullable(),
  updated_at: z.string(),
});
export type DailyCheckin = z.infer<typeof dailyCheckinResponseSchema>;

// --- Health context -------------------------------------------------------

const healthContextFields = {
  kind: healthContextKindSchema,
  start_date: day,
  end_date: day.nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  body_area: z.string().trim().max(100).nullable().optional(),
  limitation: z.string().trim().max(500).nullable().optional(),
  pause_discretionary_reminders: z.boolean().optional(),
};

function validPeriod(
  value: {
    kind?: string;
    start_date?: string;
    end_date?: string | null;
    body_area?: string | null;
    limitation?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (value.start_date && value.end_date && value.end_date < value.start_date) {
    ctx.addIssue({
      code: "custom",
      path: ["end_date"],
      message: "End date must not be before the start date.",
    });
  }
  if (
    value.kind &&
    value.kind !== "injury" &&
    (value.body_area || value.limitation)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["body_area"],
      message: "Body area and limitation apply to injuries only.",
    });
  }
}

export const createHealthContextPeriodRequestSchema = z
  .object(healthContextFields)
  .superRefine(validPeriod);
export const updateHealthContextPeriodRequestSchema = z
  .object(healthContextFields)
  .partial()
  .superRefine(validPeriod);
export type CreateHealthContextPeriodRequest = z.infer<
  typeof createHealthContextPeriodRequestSchema
>;
export type UpdateHealthContextPeriodRequest = z.infer<
  typeof updateHealthContextPeriodRequestSchema
>;

export const healthContextPeriodResponseSchema = z.object({
  id: z.uuid(),
  kind: healthContextKindSchema,
  start_date: day,
  end_date: day.nullable(),
  note: z.string().nullable(),
  body_area: z.string().nullable(),
  limitation: z.string().nullable(),
  pause_discretionary_reminders: z.boolean(),
  updated_at: z.string(),
});
export type HealthContextPeriod = z.infer<
  typeof healthContextPeriodResponseSchema
>;

// --- Habits ---------------------------------------------------------------

const habitFields = {
  name: z.string().trim().min(1).max(50),
  habit_type: habitTypeSchema,
  description: z.string().trim().max(300).nullable().optional(),
  unit: z.string().trim().max(50).nullable().optional(),
  target: z.number().positive().nullable().optional(),
  step: z.number().positive().nullable().optional(),
  days: weekdays.nullable().optional(),
  reminder_time: clockTime.nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  icon: z.string().trim().max(50).nullable().optional(),
};

function validHabit(
  value: {
    habit_type?: string;
    target?: number | null;
    step?: number | null;
  },
  ctx: z.RefinementCtx,
) {
  if (
    value.habit_type === "completion" &&
    (value.target != null || value.step != null)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["target"],
      message: "Completion habits have no target or step.",
    });
  }
}

export const createHabitRequestSchema = z
  .object(habitFields)
  .superRefine(validHabit);
/** The habit type is fixed at creation; existing logs depend on it. */
export const updateHabitRequestSchema = z
  .object(habitFields)
  .omit({ habit_type: true })
  .partial();
export type CreateHabitRequest = z.infer<typeof createHabitRequestSchema>;
export type UpdateHabitRequest = z.infer<typeof updateHabitRequestSchema>;

export const habitResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  habit_type: habitTypeSchema,
  description: z.string().nullable(),
  unit: z.string().nullable(),
  target: z.number().nullable(),
  step: z.number().nullable(),
  days: z.array(weekdaySchema).nullable(),
  reminder_time: z.string().nullable(),
  active: z.boolean(),
  sort_order: z.number().int(),
  icon: z.string().nullable(),
});
export type Habit = z.infer<typeof habitResponseSchema>;

/**
 * An explicit log. For completion habits `value` is true/false; for count
 * habits a non-negative number (0 is a real record). `null` deletes the log,
 * returning the day to "not recorded".
 */
export const logHabitRequestSchema = z.object({
  entry_date: day,
  value: z.union([z.boolean(), z.number().min(0).max(1_000_000), z.null()]),
});
export type LogHabitRequest = z.infer<typeof logHabitRequestSchema>;

export const habitLogSchema = z.object({
  habit_id: z.uuid(),
  entry_date: day,
  /** Completion: 1 = done, 0 = explicitly not done. Count: the saved value. */
  value: z.number(),
  recorded_at: z.string(),
});
export type HabitLog = z.infer<typeof habitLogSchema>;

// --- Measurement reminders -------------------------------------------------

export const upsertMeasurementReminderRequestSchema = z.object({
  measurement_key: measurementKeySchema,
  enabled: z.boolean(),
  days: weekdays.nullable().optional(),
  daypart: measurementReminderDaypartSchema.optional(),
  reminder_time: clockTime.optional(),
  include_in_daily_progress: z.boolean().optional(),
});
export type UpsertMeasurementReminderRequest = z.infer<
  typeof upsertMeasurementReminderRequestSchema
>;

export const measurementReminderResponseSchema = z.object({
  id: z.uuid(),
  measurement_key: measurementKeySchema,
  enabled: z.boolean(),
  days: z.array(weekdaySchema).nullable(),
  daypart: measurementReminderDaypartSchema,
  reminder_time: z.string(),
  include_in_daily_progress: z.boolean(),
});
export type MeasurementReminder = z.infer<
  typeof measurementReminderResponseSchema
>;

// --- Meal status ----------------------------------------------------------

export const setMealDayStatusRequestSchema = z.object({
  entry_date: day,
  meal_type_id: z.uuid(),
  /** null clears the explicit status, returning the meal to pending. */
  status: mealDayStatusValueSchema.nullable(),
});
export type SetMealDayStatusRequest = z.infer<
  typeof setMealDayStatusRequestSchema
>;

export const mealTrackingStateSchema = z.enum([
  "complete",
  "skipped",
  "incomplete",
  "pending",
]);
export type MealTrackingState = z.infer<typeof mealTrackingStateSchema>;

export const mealTrackingItemSchema = z.object({
  meal_type_id: z.uuid(),
  name: z.string(),
  state: mealTrackingStateSchema,
  /** Logged food rows. Informational only; never implies completion. */
  logged_item_count: z.number().int().nonnegative(),
  updated_at: z.string().nullable(),
});
export type MealTrackingItem = z.infer<typeof mealTrackingItemSchema>;

export const mealTrackingStatusResponseSchema = z.object({
  entry_date: day,
  meals: z.array(mealTrackingItemSchema),
  coverage: z.object({
    total: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    complete: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    incomplete: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
  }),
});
export type MealTrackingStatus = z.infer<
  typeof mealTrackingStatusResponseSchema
>;

// --- Preferences ----------------------------------------------------------

export const dailyTrackingPreferencesSchema = z.object({
  include_checkin: z.boolean(),
  include_habits: z.boolean(),
  include_supplements: z.boolean(),
  include_meals: z.boolean(),
  checkin_reminder_enabled: z.boolean(),
  checkin_reminder_time: clockTime,
  habit_reminders_enabled: z.boolean(),
});
export type DailyTrackingPreferences = z.infer<
  typeof dailyTrackingPreferencesSchema
>;
export const updateDailyTrackingPreferencesRequestSchema =
  dailyTrackingPreferencesSchema.partial();
export type UpdateDailyTrackingPreferencesRequest = z.infer<
  typeof updateDailyTrackingPreferencesRequestSchema
>;

export const DEFAULT_DAILY_TRACKING_PREFERENCES: DailyTrackingPreferences = {
  include_checkin: true,
  include_habits: true,
  include_supplements: true,
  include_meals: false,
  checkin_reminder_enabled: false,
  checkin_reminder_time: "20:30",
  habit_reminders_enabled: false,
};
