import type { PendingPhotoCompletionAction } from '../services/nutritionActionOutbox';
import type { FoodEntry } from '../types/foodEntries';
import type { MealType } from '../types/mealTypes';

/** Project an unacknowledged completion as one diary row without changing its capture. */
export function projectPhotoCompletions(
  completions: PendingPhotoCompletionAction[],
  serverEntries: FoodEntry[],
  mealTypes: MealType[]
): FoodEntry[] {
  const visibleCaptures = new Set(
    serverEntries.flatMap((entry) =>
      entry.nutrition_capture_id ? [entry.nutrition_capture_id] : []
    )
  );
  return completions
    .filter((action) => !visibleCaptures.has(action.payload.captureId))
    .map((action) => {
      const food = action.payload.food;
      const mealType = mealTypes.find((type) => type.id === food.meal_type_id);
      return {
        id: `local-photo:${action.payload.captureId}`,
        client_operation_id: action.clientOperationId,
        nutrition_capture_id: action.payload.captureId,
        isPendingNutrition: true,
        food_id: food.food_id,
        variant_id: food.variant_id,
        food_name: food.food_name,
        brand_name: food.brand_name,
        meal_type_id: food.meal_type_id,
        meal_type: mealType?.name ?? '',
        quantity: food.quantity,
        unit: food.unit,
        entry_date: action.payload.entryDate,
        entry_time: null,
        serving_size: food.serving_size,
        serving_unit: food.serving_unit,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        dietary_fiber: food.dietary_fiber,
        saturated_fat: food.saturated_fat,
        sodium: food.sodium,
        sugars: food.sugars,
        trans_fat: food.trans_fat,
        potassium: food.potassium,
        calcium: food.calcium,
        iron: food.iron,
        caffeine_mg: food.caffeine_mg,
        water_ml: food.water_ml,
        alcohol_g: food.alcohol_g,
        cholesterol: food.cholesterol,
        vitamin_a: food.vitamin_a,
        vitamin_c: food.vitamin_c,
        custom_nutrients: food.custom_nutrients ?? undefined,
      };
    });
}
