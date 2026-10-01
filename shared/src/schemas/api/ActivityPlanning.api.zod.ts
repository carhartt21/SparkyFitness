import { z } from "zod";
import { ACTIVITY_SPORTS } from "../../utils/activitySport.ts";

export const activityTypeSchema = z.enum(ACTIVITY_SPORTS);
export const activityPlanningRangeSchema = z
  .object({
    start_date: z.iso.date(),
    end_date: z.iso.date(),
  })
  .refine(
    (range) =>
      range.start_date <= range.end_date &&
      (Date.parse(range.end_date) - Date.parse(range.start_date)) / 86400000 <
        42,
    "Choose at most 42 calendar days.",
  );
export const activityOccurrenceSchema = z.object({
  id: z.string(),
  date: z.iso.date(),
  source: z.enum(["workout", "mobility"]),
  source_id: z.string(),
  assignment_id: z.number().int().nullable(),
  revision: z.number().int().nonnegative(),
  label: z.string(),
  plan_label: z.string(),
  activity_type: activityTypeSchema,
  state: z.enum(["pending", "started", "complete", "excluded"]),
  reason: z.string(),
  recorded_at: z.iso.datetime({ offset: true }).nullable(),
  evidence_ids: z.array(z.uuid()),
  expected_sets: z.number().int().nullable(),
  completed_sets: z.number().int().nonnegative(),
});
export const activityRecordSchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  label: z.string(),
  activity_type: activityTypeSchema,
  entry_ids: z.array(z.uuid()),
  origin_assignment_ids: z.array(z.number().int()),
  confirmed: z.boolean(),
  linked_occurrence_id: z.string().nullable(),
});
export const activitySummarySchema = z.object({
  activity_type: activityTypeSchema,
  scheduled: z.number().int(),
  completed: z.number().int(),
  started: z.number().int(),
  pending: z.number().int(),
  unknown: z.number().int(),
  excluded: z.number().int(),
});
export const activityPrescriptionSchema = z.object({
  id: z.number().int(),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  workoutPresetId: z.number().int().nullable(),
  exerciseId: z.uuid().nullable(),
  label: z.string().optional(),
  expectedSetCount: z.number().int().nonnegative().optional(),
  sets: z.array(z.record(z.string(), z.unknown())),
  exercises: z
    .array(
      z.object({
        exerciseId: z.uuid(),
        name: z.string(),
        expectedSets: z.number().int().positive(),
        sets: z.array(z.record(z.string(), z.unknown())),
      }),
    )
    .optional(),
});
export const activityWorkoutPlanSchema = z.object({
  id: z.number().int(),
  plan_name: z.string(),
  schedule_type: z.enum(["weekly", "sequential"]),
  is_active: z.boolean(),
  start_date: z.iso.date().nullable(),
  end_date: z.iso.date().nullable(),
  assignments: z.array(activityPrescriptionSchema),
});
export const activityPlanningResponseSchema = z.object({
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  timezone: z.string(),
  occurrences: z.array(activityOccurrenceSchema),
  records: z.array(activityRecordSchema),
  summary: z.array(activitySummarySchema),
  workout_plans: z.array(activityWorkoutPlanSchema),
  note: z.string(),
});
const workoutOccurrenceId = z
  .string()
  .regex(/^workout:\d+:\d+:\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => z.iso.date().safeParse(value.split(":").at(-1)).success,
    "Use a valid calendar date.",
  );
export const activityResolutionRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    occurrence_id: workoutOccurrenceId,
    expected_revision: z.number().int().nonnegative(),
    action: z.literal("skip"),
  }),
  z.strictObject({
    occurrence_id: workoutOccurrenceId,
    expected_revision: z.number().int().nonnegative(),
    action: z.literal("undo"),
  }),
  z.strictObject({
    occurrence_id: workoutOccurrenceId,
    expected_revision: z.number().int().nonnegative(),
    action: z.literal("link"),
    record_id: z.uuid(),
  }),
]);
export type ActivityOccurrence = z.infer<typeof activityOccurrenceSchema>;
export type ActivityRecord = z.infer<typeof activityRecordSchema>;
export type ActivityWorkoutPlan = z.infer<typeof activityWorkoutPlanSchema>;
export type ActivityPlanningResponse = z.infer<
  typeof activityPlanningResponseSchema
>;
export type ActivityResolutionRequest = z.infer<
  typeof activityResolutionRequestSchema
>;
