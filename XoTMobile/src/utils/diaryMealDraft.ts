import type { FoodEntry } from '../types/foodEntries';
import type { MealIngredientDraft } from '../types/meals';

/** Reuse the recorded per-serving snapshot, never today's library nutrition. */
export function diaryMealDraft(entries: readonly FoodEntry[]) {
  const unresolved: FoodEntry[] = [];
  const ingredients: MealIngredientDraft[] = [];
  for (const entry of entries) {
    if (
      !entry.food_id ||
      !entry.variant_id ||
      entry.isPendingNutrition ||
      ![entry.calories, entry.protein, entry.carbs, entry.fat].every(
        (value) => typeof value === 'number' && Number.isFinite(value)
      ) ||
      !(entry.quantity > 0) ||
      !(entry.serving_size > 0)
    ) {
      unresolved.push(entry);
      continue;
    }
    const {
      id: _id,
      entry_date: _date,
      entry_time: _time,
      meal_type: _type,
      meal_type_id: _typeId,
      user_id: _user,
      images: _images,
      food_images: _foodImages,
      source: _source,
      provider_verified: _verified,
      food_entry_meal_id: _group,
      meal_id: _meal,
      meal_plan_template_id: _plan,
      client_operation_id: _operation,
      nutrition_capture_id: _capture,
      isPendingNutrition: _pending,
      brand_name,
      ...snapshot
    } = entry;
    ingredients.push({
      ...snapshot,
      brand: brand_name ?? null,
      serving_unit: entry.serving_unit ?? entry.unit,
      protein: entry.protein!,
      carbs: entry.carbs!,
      fat: entry.fat!,
    });
  }
  return { ingredients, unresolved };
}
