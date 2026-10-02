import { z } from "zod";

/** Semantic keys, rendered by each platform's existing icon adapter. */
export const MEAL_TYPE_ICON_KEYS = [
  "meal-breakfast",
  "meal-lunch",
  "meal-dinner",
  "meal-snack",
  "food",
  "water",
  "meal",
] as const;
export const mealTypeIconSchema = z.enum(MEAL_TYPE_ICON_KEYS);
export type MealTypeIcon = z.infer<typeof mealTypeIconSchema>;
export const mealTypeIconSettingSchema = z.object({
  /** null resets to the system/default icon; omission preserves the setting. */
  icon_key: mealTypeIconSchema.nullable().optional(),
});
