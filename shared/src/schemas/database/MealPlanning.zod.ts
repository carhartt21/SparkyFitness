import { z } from "zod";
export const mealPlanTemplateVersionDatabaseSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  template_id: z.uuid().nullable(),
  effective_from: z.union([z.iso.date(), z.date()]),
  definition: z.json(),
  created_at: z.date(),
});
export const mealPlanLogReceiptDatabaseSchema = z.object({
  user_id: z.uuid(),
  operation_id: z.uuid(),
  plan_id: z.uuid(),
  request_hash: z.string(),
  result: z.json(),
  created_at: z.date(),
});
export type MealPlanTemplateVersionRow = z.infer<
  typeof mealPlanTemplateVersionDatabaseSchema
>;
export const mealPlanTemplateVersionsSchema =
  mealPlanTemplateVersionDatabaseSchema;
export const mealPlanLogReceiptsSchema = mealPlanLogReceiptDatabaseSchema;
