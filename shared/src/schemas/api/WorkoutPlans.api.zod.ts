import { isDayString } from "../../utils/timezone.ts";
import { z } from "zod";
import { exerciseSetTypeRequestSchema } from "./ExerciseSetType.api.zod.ts";

/** Whole sessions, not muscle groups. Rest is an explicit non-training day. */
export const PLANNED_ACTIVITY_TYPES = [
  "running",
  "strength",
  "cycling",
  "walking",
  "hiking",
  "swimming",
  "rowing",
  "soccer",
  "yoga",
  "other",
  "rest",
] as const;
export const plannedActivityTypeSchema = z.enum(PLANNED_ACTIVITY_TYPES);
export type PlannedActivityType = z.infer<typeof plannedActivityTypeSchema>;

export const workoutPlanActivityFieldsSchema = z.object({
  activity_type: plannedActivityTypeSchema.nullish(),
  planned_duration_minutes: z.coerce.number().positive().max(1440).nullish(),
  planned_distance_km: z.coerce.number().positive().max(1000).nullish(),
  planned_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/)
    .nullish(),
  is_optional: z.boolean().optional(),
});
const identity = z
  .union([z.number().int().positive(), z.string().min(1).max(128)])
  .nullish();
export const workoutPlanAssignmentRequestSchema =
  workoutPlanActivityFieldsSchema
    .extend({
      id: identity,
      day_of_week: z.number().int().min(0).max(6).nullish(),
      session_index: z.number().int().min(0).nullish(),
      session_name: z.string().max(160).nullish(),
      workout_preset_id: identity,
      exercise_id: z.string().uuid().nullish(),
      sort_order: z.number().int().min(0).nullish(),
      sets: z
        .array(
          z
            .object({
              set_number: z.number().int().positive(),
              set_type: exerciseSetTypeRequestSchema.nullish(),
              reps: z.number().min(0).nullish(),
              weight: z.number().min(0).nullish(),
              duration: z.number().min(0).nullish(),
              rest_time: z.number().min(0).nullish(),
              notes: z.string().nullish(),
            })
            .passthrough(),
        )
        .nullish(),
    })
    .passthrough()
    .superRefine((a, ctx) => {
      const count = [
        a.activity_type,
        a.exercise_id,
        a.workout_preset_id,
      ].filter(Boolean).length;
      if (count !== 1)
        ctx.addIssue({
          code: "custom",
          message: "Choose one activity, preset or exercise.",
        });
      if (
        a.activity_type === "rest" &&
        (a.planned_duration_minutes || a.planned_distance_km)
      )
        ctx.addIssue({
          code: "custom",
          message: "Rest does not have training targets.",
        });
    });

// Retain legacy response/editor fields, while validating all persisted inputs.
export const workoutPlanWriteSchema = z
  .object({
    plan_name: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(10000).nullish(),
    start_date: z
      .string()
      .refine(isDayString, "Invalid calendar day.")
      .nullish(),
    end_date: z.string().refine(isDayString, "Invalid calendar day.").nullish(),
    schedule_type: z.enum(["weekly", "sequential"]).optional(),
    entry_mode: z.enum(["prompt", "prefill"]).optional(),
    is_active: z.boolean().optional(),
    assignments: z.array(workoutPlanAssignmentRequestSchema).max(200).nullish(),
  })
  .passthrough()
  .superRefine((plan, ctx) => {
    if (plan.start_date && plan.end_date && plan.end_date < plan.start_date)
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "End date must follow start date.",
      });
    if (
      plan.entry_mode === "prefill" &&
      plan.assignments?.some((a) => a.activity_type)
    )
      ctx.addIssue({
        code: "custom",
        message: "Activity plans use prompts, not completed diary entries.",
      });
  });
export type WorkoutPlanActivityFields = z.infer<
  typeof workoutPlanActivityFieldsSchema
>;
