import { z } from "zod";

// Row mirrors for the daily tracking tables
// (migration 20260928120000_add_daily_tracking.sql).

const day = z.iso.date();
const rating = z.number().int().min(1).max(5);

export const dailyCheckinStateSchema = z.enum(["draft", "completed", "skipped"]);
export type DailyCheckinState = z.infer<typeof dailyCheckinStateSchema>;

export const dailyCheckinDatabaseSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  entry_date: day,
  state: dailyCheckinStateSchema,
  question_version: z.number().int().min(1),
  overall_day: rating.nullable(),
  energy: rating.nullable(),
  stress: rating.nullable(),
  sleep_quality: rating.nullable(),
  nutrition_on_track: rating.nullable(),
  activity: rating.nullable(),
  note: z.string().nullable(),
  tags: z.array(z.string()),
  completed_at: z.coerce.date().nullable(),
  skipped_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  created_by_user_id: z.uuid().nullable(),
  updated_by_user_id: z.uuid().nullable(),
});

export const healthContextKindSchema = z.enum(["injury", "illness", "vacation"]);
export type HealthContextKind = z.infer<typeof healthContextKindSchema>;

export const healthContextPeriodDatabaseSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  kind: healthContextKindSchema,
  start_date: day,
  end_date: day.nullable(),
  note: z.string().nullable(),
  body_area: z.string().nullable(),
  limitation: z.string().nullable(),
  pause_discretionary_reminders: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const habitTypeSchema = z.enum(["completion", "count"]);
export type HabitType = z.infer<typeof habitTypeSchema>;

/** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
export const weekdaySchema = z.number().int().min(0).max(6);

/** Habit configuration columns added to custom_categories. */
export const habitColumnsDatabaseSchema = z.object({
  habit_type: habitTypeSchema.nullable(),
  habit_description: z.string().nullable(),
  habit_target: z.coerce.number().nullable(),
  habit_step: z.coerce.number().nullable(),
  habit_days: z.array(weekdaySchema).nullable(),
  habit_reminder_time: z.string().nullable(),
  habit_active: z.boolean(),
  habit_sort_order: z.number().int(),
  habit_icon: z.string().nullable(),
});

export const measurementReminderDaypartSchema = z.enum([
  "morning",
  "midday",
  "evening",
]);
export type MeasurementReminderDaypart = z.infer<
  typeof measurementReminderDaypartSchema
>;

export const measurementKeySchema = z.union([
  z.literal("weight"),
  z.string().regex(/^custom:[0-9a-f-]{36}$/),
]);

export const measurementReminderDatabaseSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  measurement_key: measurementKeySchema,
  enabled: z.boolean(),
  days: z.array(weekdaySchema).nullable(),
  daypart: measurementReminderDaypartSchema,
  reminder_time: z.string(),
  include_in_daily_progress: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const mealDayStatusValueSchema = z.enum([
  "complete",
  "skipped",
  "incomplete",
]);
export type MealDayStatusValue = z.infer<typeof mealDayStatusValueSchema>;

export const mealDayStatusDatabaseSchema = z.object({
  user_id: z.uuid(),
  entry_date: day,
  meal_type_id: z.uuid(),
  status: mealDayStatusValueSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  created_by_user_id: z.uuid().nullable(),
  updated_by_user_id: z.uuid().nullable(),
});

export const dailyTrackingPreferencesDatabaseSchema = z.object({
  user_id: z.uuid(),
  include_checkin: z.boolean(),
  include_habits: z.boolean(),
  include_supplements: z.boolean(),
  include_meals: z.boolean(),
  checkin_reminder_enabled: z.boolean(),
  checkin_reminder_time: z.string(),
  habit_reminders_enabled: z.boolean(),
  updated_at: z.coerce.date(),
});
