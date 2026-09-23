import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import type { FoodItem } from '../types/foods';
import type { MealType } from '../types/mealTypes';
import type { NutritionActionIdentity } from './nutritionActionOutbox';

const PREFIX = '@SparkyFitness/nutrition-favorites/v1/';
const keyFor = (identity: NutritionActionIdentity) =>
  `${PREFIX}${encodeURIComponent(identity.serverConfigId)}/${encodeURIComponent(identity.userId)}`;

const nutrient = z.number().finite();
const variantSchema = z.strictObject({
  id: z.string().optional(),
  serving_size: nutrient.positive(),
  serving_unit: z.string().min(1),
  calories: nutrient,
  protein: nutrient,
  carbs: nutrient,
  fat: nutrient,
  saturated_fat: nutrient.optional(),
  sodium: nutrient.optional(),
  dietary_fiber: nutrient.optional(),
  sugars: nutrient.optional(),
  trans_fat: nutrient.optional(),
  potassium: nutrient.optional(),
  calcium: nutrient.optional(),
  iron: nutrient.optional(),
  caffeine_mg: nutrient.optional(),
  water_ml: nutrient.optional(),
  alcohol_g: nutrient.optional(),
  cholesterol: nutrient.optional(),
  vitamin_a: nutrient.optional(),
  vitamin_c: nutrient.optional(),
  custom_nutrients: z
    .record(z.string(), z.union([z.string(), nutrient]))
    .optional(),
});
const cachedFoodSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().nullable(),
  provider_type: z.string().nullable().optional(),
  provider_external_id: z.string().nullable().optional(),
  default_variant: variantSchema,
});
const cachedMealTypeSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  sort_order: z.number().int(),
  is_visible: z.boolean(),
  show_in_quick_log: z.boolean(),
  default_time: z.string().nullable().optional(),
});
const cacheSchema = z.strictObject({
  version: z.literal(1),
  updatedAt: z.iso.datetime({ offset: true }),
  foods: z.array(cachedFoodSchema),
  mealTypes: z.array(cachedMealTypeSchema),
});

export type CachedFavoriteFood = z.infer<typeof cachedFoodSchema>;
export type CachedMealType = z.infer<typeof cachedMealTypeSchema>;
export type NutritionFavoriteCache = z.infer<typeof cacheSchema>;

const emptyCache = (): NutritionFavoriteCache => ({
  version: 1,
  updatedAt: new Date(0).toISOString(),
  foods: [],
  mealTypes: [],
});

export async function readNutritionFavoriteCache(
  identity: NutritionActionIdentity
): Promise<NutritionFavoriteCache> {
  const raw = await AsyncStorage.getItem(keyFor(identity));
  if (raw === null) return emptyCache();
  try {
    return cacheSchema.parse(JSON.parse(raw));
  } catch {
    // Never replace an unknown future version or damaged cache with empty data.
    throw new Error('Saved nutrition favorites could not be read.');
  }
}

let tail: Promise<void> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = tail.then(work, work);
  tail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function update(
  identity: NutritionActionIdentity,
  transform: (current: NutritionFavoriteCache) => NutritionFavoriteCache
) {
  return serialized(async () => {
    const next = cacheSchema.parse(
      transform(await readNutritionFavoriteCache(identity))
    );
    await AsyncStorage.setItem(keyFor(identity), JSON.stringify(next));
    return next;
  });
}

/** Keep a logging-time snapshot, not just IDs needing an online lookup. */
export function cacheFavoriteFoods(
  identity: NutritionActionIdentity,
  foods: FoodItem[]
): Promise<NutritionFavoriteCache> {
  const snapshots = foods.map((food) =>
    cachedFoodSchema.parse({
      id: food.id,
      name: food.name,
      brand: food.brand,
      provider_type: food.provider_type,
      provider_external_id: food.provider_external_id,
      default_variant: {
        id: food.default_variant.id,
        serving_size: food.default_variant.serving_size,
        serving_unit: food.default_variant.serving_unit,
        calories: food.default_variant.calories,
        protein: food.default_variant.protein,
        carbs: food.default_variant.carbs,
        fat: food.default_variant.fat,
        saturated_fat: food.default_variant.saturated_fat,
        sodium: food.default_variant.sodium,
        dietary_fiber: food.default_variant.dietary_fiber,
        sugars: food.default_variant.sugars,
        trans_fat: food.default_variant.trans_fat,
        potassium: food.default_variant.potassium,
        calcium: food.default_variant.calcium,
        iron: food.default_variant.iron,
        caffeine_mg: food.default_variant.caffeine_mg,
        water_ml: food.default_variant.water_ml,
        alcohol_g: food.default_variant.alcohol_g,
        cholesterol: food.default_variant.cholesterol,
        vitamin_a: food.default_variant.vitamin_a,
        vitamin_c: food.default_variant.vitamin_c,
        custom_nutrients: food.default_variant.custom_nutrients,
      },
    })
  );
  return update(identity, (current) => ({
    ...current,
    updatedAt: new Date().toISOString(),
    foods: snapshots,
  }));
}

export function cacheQuickMealTypes(
  identity: NutritionActionIdentity,
  mealTypes: MealType[]
): Promise<NutritionFavoriteCache> {
  const categories = mealTypes.map((mealType) =>
    cachedMealTypeSchema.parse({
      id: mealType.id,
      name: mealType.name,
      sort_order: mealType.sort_order,
      is_visible: mealType.is_visible,
      show_in_quick_log: mealType.show_in_quick_log,
      default_time: mealType.default_time,
    })
  );
  return update(identity, (current) => ({
    ...current,
    updatedAt: new Date().toISOString(),
    mealTypes: categories,
  }));
}
