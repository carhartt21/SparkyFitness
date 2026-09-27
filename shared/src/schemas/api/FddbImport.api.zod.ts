import { z } from "zod";

const amount = z.number().finite().nonnegative().max(1_000_000);
const positiveAmount = amount.positive();
const name = z.string().trim().min(1).max(500);
const sourceKey = z.string().min(1).max(1_000);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const fddbDiaryRowSchema = z.object({
  sourceKey,
  date: z.iso.date(),
  time,
  foodName: name,
  quantity: positiveAmount,
  unit: z.string().trim().min(1).max(30),
  calories: amount,
  protein: amount,
  carbs: amount,
  fat: amount,
});

export const fddbDiaryBatchSchema = z.object({
  rows: z.array(fddbDiaryRowSchema).min(1).max(100),
});

export const fddbActivityRowSchema = z.object({
  sourceKey,
  date: z.iso.date(),
  time,
  name,
  durationMinutes: positiveAmount,
  caloriesBurned: amount,
});

export const fddbCustomFoodSchema = z.object({
  sourceKey,
  name,
  brand: z.string().max(500),
  articleNumber: z.string().max(100),
  portions: z.string().max(2_000),
  calories: amount,
  protein: amount,
  carbs: amount,
  fat: amount,
  dietaryFiber: amount.optional(),
  sugars: amount.optional(),
  saturatedFat: amount.optional(),
  cholesterol: amount.optional(),
  sodium: amount.optional(),
  potassium: amount.optional(),
  calcium: amount.optional(),
  iron: amount.optional(),
  vitaminC: amount.optional(),
  caffeine: amount.optional(),
  alcoholG: amount.optional(),
});

export const fddbRecipeSchema = z.object({
  sourceKey,
  name,
  servings: positiveAmount,
  preparationMinutes: amount,
  cookingMinutes: amount,
  ingredientsText: z.string().trim().min(1).max(10_000),
});

export const fddbMeasurementSchema = z.object({
  date: z.iso.date(),
  weightKg: positiveAmount.max(1_000),
});

export const fddbExtrasSchema = z.object({
  customFoods: z.array(fddbCustomFoodSchema).max(100).default([]),
  recipes: z.array(fddbRecipeSchema).max(200).default([]),
  favorites: z.array(name).max(1_000).default([]),
  measurements: z.array(fddbMeasurementSchema).max(100).default([]),
  activities: z.array(fddbActivityRowSchema).max(200).default([]),
});

export type FddbDiaryRow = z.infer<typeof fddbDiaryRowSchema>;
export type FddbActivityRow = z.infer<typeof fddbActivityRowSchema>;
export type FddbCustomFood = z.infer<typeof fddbCustomFoodSchema>;
export type FddbRecipe = z.infer<typeof fddbRecipeSchema>;
export type FddbMeasurement = z.infer<typeof fddbMeasurementSchema>;
export type FddbExtras = z.infer<typeof fddbExtrasSchema>;

export interface FddbImportResult {
  imported: number;
  alreadyPresent: number;
  unmatched?: string[];
  errors?: Array<{ item: string; message: string }>;
}
