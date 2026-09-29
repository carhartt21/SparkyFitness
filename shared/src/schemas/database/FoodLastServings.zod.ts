import { z } from "zod";

// One row per user and food: the amount and unit last logged by hand. Written
// only by user-initiated single-food logging (never bulk, meal or sync paths).

export const foodLastServingsSchema = z.object({
  user_id: z.string(),
  food_id: z.string(),
  quantity: z.number(),
  unit: z.string(),
  variant_id: z.string().nullable(),
  serving_size: z.number().nullable(),
  serving_label: z.string().nullable(),
  metric_amount: z.number().nullable(),
  metric_unit: z.enum(["g", "ml"]).nullable(),
  used_at: z.date(),
});

export const foodLastServingsInitializerSchema = foodLastServingsSchema.extend({
  variant_id: z.string().optional().nullable(),
  serving_size: z.number().optional().nullable(),
  serving_label: z.string().optional().nullable(),
  metric_amount: z.number().optional().nullable(),
  metric_unit: z.enum(["g", "ml"]).optional().nullable(),
  used_at: z.date().optional(),
});

export type FoodLastServings = z.infer<typeof foodLastServingsSchema>;
export type FoodLastServingsInitializer = z.infer<
  typeof foodLastServingsInitializerSchema
>;
