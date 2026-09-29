import { z } from "zod";

// Saved serving portions of a food (PUT /api/foods/:foodId/servings) and the
// per-user last-used serving (GET /api/foods/:foodId/last-serving). Consumed
// by the mobile Edit Food and food details screens and by web variant lists.

export const SERVING_LABEL_MAX_LENGTH = 40;
export const MAX_SERVING_PORTIONS = 20;

const uuidSchema = z.string().uuid();

export const servingPortionInputSchema = z.object({
  /** Omitted for a new portion. */
  id: uuidSchema.optional(),
  serving_label: z
    .string()
    .trim()
    .max(SERVING_LABEL_MAX_LENGTH)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  serving_size: z.number().positive().max(100000),
  serving_unit: z.string().trim().min(1).max(50),
  /**
   * Weight of one serving in the basis's metric unit (g or ml). Required for
   * a new portion; a portion in g/ml takes its weight from its own amount.
   */
  metric_amount: z.number().positive().max(1000000).nullable().optional(),
  sort_order: z.number().int().min(0).max(1000),
  /**
   * Recalculate this row's nutrition from the basis. The client sends false
   * for a row that carries its own nutrition and was not re-weighed.
   */
  derive: z.boolean().default(true),
});
export type ServingPortionInput = z.input<typeof servingPortionInputSchema>;

export const saveFoodServingsBodySchema = z.object({
  servings: z.array(servingPortionInputSchema).max(MAX_SERVING_PORTIONS),
  deleted_ids: z.array(uuidSchema).max(100).default([]),
  /**
   * Weight of the nutrition basis when its own unit is not metric ("1 bar").
   * null clears a stated weight; omit to leave it unchanged.
   */
  basis_metric_amount: z.number().positive().max(1000000).nullable().optional(),
  /** Unit of basis_metric_amount; grams unless the food is a liquid. */
  basis_metric_unit: z.enum(["g", "ml"]).optional(),
  /** Confirms deleting portions that meal-plan templates still use. */
  confirm_cascade: z.boolean().optional(),
});
export type SaveFoodServingsBody = z.input<typeof saveFoodServingsBodySchema>;

export const servingDeleteConflictSchema = z.object({
  error: z.string(),
  code: z.literal("SERVING_IN_USE"),
  /** Meal-plan template assignments that would be removed. */
  template_assignments: z.number().int(),
});
export type ServingDeleteConflict = z.infer<typeof servingDeleteConflictSchema>;

const numeric = z.union([z.number(), z.string()]);

export const foodLastServingSchema = z.object({
  food_id: z.string(),
  variant_id: z.string().nullable(),
  quantity: numeric,
  unit: z.string(),
  /** Serving size of the logged row, so the amount reads in portions. */
  serving_size: numeric.nullable(),
  serving_label: z.string().nullable(),
  metric_amount: numeric.nullable(),
  metric_unit: z.string().nullable(),
  used_at: z.string(),
});
export type FoodLastServing = z.infer<typeof foodLastServingSchema>;

export const foodLastServingResponseSchema = foodLastServingSchema.nullable();
