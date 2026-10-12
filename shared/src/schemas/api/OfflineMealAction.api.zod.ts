import { z } from "zod";

const amount = z.number().finite().nonnegative();
export const offlineMealFoodSchema = z
  .strictObject({
    food_name: z.string().min(1).max(255),
    brand_name: z.string().nullable().optional(),
    quantity: z.number().finite().positive(),
    unit: z.string().min(1).max(50),
    serving_size: z.number().finite().positive(),
    serving_unit: z.string().min(1).max(50),
    calories: amount,
    protein: amount,
    carbs: amount,
    fat: amount,
    saturated_fat: amount.optional(),
    polyunsaturated_fat: amount.optional(),
    monounsaturated_fat: amount.optional(),
    trans_fat: amount.optional(),
    cholesterol: amount.optional(),
    sodium: amount.optional(),
    potassium: amount.optional(),
    dietary_fiber: amount.optional(),
    sugars: amount.optional(),
    vitamin_a: amount.optional(),
    vitamin_c: amount.optional(),
    calcium: amount.optional(),
    iron: amount.optional(),
    caffeine_mg: amount.optional(),
    water_ml: amount.optional(),
    alcohol_g: amount.optional(),
    glycemic_index: z.string().optional(),
    custom_nutrients: z
      .record(z.string(), z.union([z.string(), amount]))
      .optional(),
  })
  .refine((food) => food.unit === food.serving_unit, {
    message: "Ingredient units must use their saved nutrition basis.",
    path: ["unit"],
  });

/** Leaf ingredients of the complete recipe, before the consumed portion scales it. */
export const offlineMealSnapshotSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(10000).nullable().optional(),
  notes: z.string().max(50000).nullable().optional(),
  serving_size: z.number().finite().positive(),
  serving_unit: z.string().min(1).max(50),
  total_servings: z.number().finite().positive(),
  foods: z.array(offlineMealFoodSchema).min(1).max(200),
});

export const offlineMealActionBodySchema = z.strictObject({
  client_operation_id: z.uuid(),
  entry_date: z.iso.date(),
  entry_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/),
  meal_type_id: z.uuid(),
  quantity: z.number().finite().positive(),
  meal: offlineMealSnapshotSchema,
});
export const offlineMealActionResponseSchema = z.strictObject({
  mealEntryId: z.uuid().nullable(),
  alreadyApplied: z.boolean(),
});
export type OfflineMealSnapshot = z.infer<typeof offlineMealSnapshotSchema>;
export type OfflineMealFood = z.infer<typeof offlineMealFoodSchema>;
export type OfflineMealActionBody = z.infer<typeof offlineMealActionBodySchema>;
export type OfflineMealActionResponse = z.infer<
  typeof offlineMealActionResponseSchema
>;
