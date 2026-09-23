import { getActiveNutritionIdentity } from './nutritionIdentity';
import { readNutritionFavoriteCache } from './nutritionFavoriteCache';
import { enqueuePhotoCompletion } from './nutritionActionOutbox';

export interface CompleteMealPhotoInput {
  captureId: string;
  consumedAt: string;
  entryDate: string;
  mealTypeId?: string | null;
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/** Persist the reviewed snapshot before attempting a server request. */
export async function completeMealPhotoLocally(input: CompleteMealPhotoInput) {
  const identity = await getActiveNutritionIdentity();
  if (!identity)
    throw new Error(
      'Sign in once while online before completing meals offline.'
    );
  const cache = await readNutritionFavoriteCache(identity);
  const mealType =
    input.mealTypeId ?? cache.mealTypes.find((type) => type.is_visible)?.id;
  if (!mealType) throw new Error('No cached meal category is available.');
  return enqueuePhotoCompletion({
    ...identity,
    occurredAt: input.consumedAt,
    payload: {
      captureId: input.captureId,
      entryDate: input.entryDate,
      food: {
        meal_type_id: mealType,
        quantity: 1,
        unit: 'serving',
        food_name: input.name.trim(),
        serving_size: 1,
        serving_unit: 'serving',
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
      },
    },
  });
}
