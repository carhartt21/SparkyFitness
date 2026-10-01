import { z } from "zod";
import { activityPrescriptionSchema } from "../api/ActivityPlanning.api.zod.ts";

export const workoutPlanVersionAssignmentSchema = z.object({
  id: z.number().int(),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  activityType: z.string().nullable().optional(),
  sessionName: z.string().nullable().optional(),
  plannedDurationMinutes: z.number().nullable().optional(),
  plannedDistanceKm: z.number().nullable().optional(),
  plannedTime: z.string().nullable().optional(),
  isOptional: z.boolean().optional(),
  label: z.string().optional(),
  exercises: activityPrescriptionSchema.shape.exercises,
  expectedSetCount: z.number().int().nonnegative().optional(),
  workoutPresetId: z.number().int().nullable(),
  exerciseId: z.string().uuid().nullable(),
  sortOrder: z.number().int().nullable(),
  sets: z.array(z.record(z.string(), z.unknown())),
});

export const workoutPlanTemplateVersionsSchema = z.object({
  id: z.string().regex(/^\d+$/),
  user_id: z.string().uuid(),
  template_id: z.number().int(),
  effective_from: z.date(),
  captured_at: z.date(),
  plan_name: z.string(),
  start_date: z.date().nullable(),
  end_date: z.date().nullable(),
  is_active: z.boolean(),
  assignments: z.array(workoutPlanVersionAssignmentSchema),
});

export type WorkoutPlanTemplateVersions = z.infer<
  typeof workoutPlanTemplateVersionsSchema
>;
