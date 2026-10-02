import { z } from "zod";
import { coachingMealAssignmentSchema } from "./Coaching.api.zod.ts";
export const plannedMealOccurrenceSchema = z.strictObject({
  id: z.uuid(),
  templateVersionId: z.uuid(),
  templateId: z.uuid().nullable(),
  assignmentId: z.uuid(),
  day: z.iso.date(),
  name: z.string(),
  planName: z.string(),
  state: z.enum(["planned", "confirmed", "skipped", "cancelled"]),
  assignment: coachingMealAssignmentSchema,
});
export const plannedMealsSchema = z.array(plannedMealOccurrenceSchema);
export const plannedMealConfirmSchema = z.strictObject({
  operationId: z.uuid(),
  consumedDay: z.iso.date(),
  quantity: z.number().positive().max(100000),
  entryTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  unit: z.string().min(1).max(50),
});
export const plannedMealReceiptSchema = z.strictObject({
  planId: z.uuid(),
  foodEntryIds: z.array(z.uuid()),
  mealEntryId: z.uuid().nullable(),
  consumedDay: z.iso.date(),
});
export type PlannedMealOccurrence = z.infer<typeof plannedMealOccurrenceSchema>;
export type PlannedMealConfirmation = z.infer<typeof plannedMealConfirmSchema>;
