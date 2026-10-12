import { getActiveNutritionIdentity } from './nutritionIdentity';
import {
  enqueueFoodEntry,
  enqueueMealEntry,
  type PendingNutritionAction,
  type NutritionActionIdentity,
} from './nutritionActionOutbox';
import {
  readNutritionFavoriteCache,
  type CachedFavoriteFood,
} from './nutritionFavoriteCache';
import type { CreateFoodEntryPayload } from './api/foodEntriesApi';
import {
  offlineMealSnapshotSchema,
  type OfflineMealSnapshot,
} from '@workspace/shared';

export interface QuickLogTime {
  occurredAt?: string;
  mealTypeId?: string;
}

export interface CachedFoodLogOptions extends QuickLogTime {
  entryDate?: string;
  quantity?: number;
  /** Identity that owned the visible snapshot when the picker opened. */
  identity?: NutritionActionIdentity;
  /** Keep the exact nutrient basis reviewed in the portion sheet. */
  snapshot?: CachedFavoriteFood;
}

function dateFields(occurredAt: string) {
  const instant = new Date(occurredAt);
  if (Number.isNaN(instant.getTime())) throw new Error('Invalid meal time.');
  const two = (value: number) => String(value).padStart(2, '0');
  return {
    entry_date: `${instant.getFullYear()}-${two(instant.getMonth() + 1)}-${two(instant.getDate())}`,
    entry_time: `${two(instant.getHours())}:${two(instant.getMinutes())}:${two(instant.getSeconds())}`,
  };
}

function chooseMealType(
  mealTypes: {
    id: string;
    is_visible: boolean;
    show_in_quick_log: boolean;
    sort_order: number;
  }[],
  requested?: string
) {
  const visible = mealTypes.filter((type) => type.is_visible);
  if (requested) {
    if (!visible.some((type) => type.id === requested)) {
      throw new Error('Selected meal category is unavailable.');
    }
    return requested;
  }
  const quick = visible.filter((type) => type.show_in_quick_log);
  const chosen = (quick.length > 0 ? quick : visible).sort(
    (a, b) => a.sort_order - b.sort_order
  )[0];
  if (!chosen) throw new Error('No cached meal category is available.');
  return chosen.id;
}

async function saveAction(
  payload: CreateFoodEntryPayload,
  occurredAt: string
): Promise<PendingNutritionAction> {
  const identity = await getActiveNutritionIdentity();
  if (!identity) {
    throw new Error(
      'Sign in once while online before logging nutrition offline.'
    );
  }
  return enqueueFoodEntry({ ...identity, occurredAt, payload });
}

/** Persist the selected favorite's snapshot before returning to the UI. */
export async function logFavoriteFood(
  favoriteId: string,
  options: QuickLogTime = {}
): Promise<PendingNutritionAction> {
  return queueCachedFood(favoriteId, options, true);
}

export async function logCachedFood(
  foodId: string,
  options: CachedFoodLogOptions = {}
): Promise<PendingNutritionAction> {
  return queueCachedFood(foodId, options, false);
}

export async function logCachedMeal(
  meal: OfflineMealSnapshot,
  options: CachedFoodLogOptions
) {
  const identity = await getActiveNutritionIdentity();
  if (
    !identity ||
    !options.identity ||
    identity.serverConfigId !== options.identity.serverConfigId ||
    identity.userId !== options.identity.userId
  )
    throw new Error('The nutrition account changed.');
  const cache = await readNutritionFavoriteCache(identity);
  const occurredAt = options.occurredAt ?? new Date().toISOString();
  const snapshot = offlineMealSnapshotSchema.parse(meal);
  const active = await getActiveNutritionIdentity();
  if (
    active?.userId !== identity.userId ||
    active.serverConfigId !== identity.serverConfigId
  )
    throw new Error('The nutrition account changed.');
  return enqueueMealEntry({
    ...identity,
    occurredAt,
    payload: {
      ...dateFields(occurredAt),
      entry_date: options.entryDate ?? dateFields(occurredAt).entry_date,
      meal_type_id: chooseMealType(cache.mealTypes, options.mealTypeId),
      quantity: options.quantity ?? meal.serving_size,
      meal: snapshot,
    },
  });
}

async function queueCachedFood(
  favoriteId: string,
  options: CachedFoodLogOptions,
  favoritesOnly: boolean
): Promise<PendingNutritionAction> {
  const identity = await getActiveNutritionIdentity();
  if (!identity) {
    throw new Error(
      'Sign in once while online before logging nutrition offline.'
    );
  }
  if (
    (options.snapshot && !options.identity) ||
    (options.identity &&
      (options.identity.userId !== identity.userId ||
        options.identity.serverConfigId !== identity.serverConfigId))
  )
    throw new Error('The nutrition account changed.');
  const cache = await readNutritionFavoriteCache(identity);
  const foods = favoritesOnly
    ? cache.foods
    : [...(cache.savedFoods ?? []), ...cache.foods];
  const food =
    options.snapshot?.id === favoriteId
      ? options.snapshot
      : foods.find((item) => item.id === favoriteId);
  if (!food) throw new Error('Favorite is not cached on this device.');
  const variant = food.default_variant;
  const occurredAt = options.occurredAt ?? new Date().toISOString();
  const payload: CreateFoodEntryPayload = {
    meal_type_id: chooseMealType(cache.mealTypes, options.mealTypeId),
    quantity: options.quantity ?? variant.serving_size,
    unit: variant.serving_unit,
    ...dateFields(occurredAt),
    ...(options.entryDate ? { entry_date: options.entryDate } : {}),
    // A standalone snapshot remains loggable after a favorite is removed or
    // its source food/variant changes while this device is offline.
    food_name: food.name,
    brand_name: food.brand ?? undefined,
    serving_size: variant.serving_size,
    serving_unit: variant.serving_unit,
    calories: variant.calories,
    protein: variant.protein,
    carbs: variant.carbs,
    fat: variant.fat,
    saturated_fat: variant.saturated_fat,
    polyunsaturated_fat: variant.polyunsaturated_fat,
    monounsaturated_fat: variant.monounsaturated_fat,
    sodium: variant.sodium,
    dietary_fiber: variant.dietary_fiber,
    sugars: variant.sugars,
    trans_fat: variant.trans_fat,
    potassium: variant.potassium,
    calcium: variant.calcium,
    iron: variant.iron,
    caffeine_mg: variant.caffeine_mg,
    water_ml: variant.water_ml,
    alcohol_g: variant.alcohol_g,
    cholesterol: variant.cholesterol,
    vitamin_a: variant.vitamin_a,
    vitamin_c: variant.vitamin_c,
    glycemic_index: variant.glycemic_index,
    custom_nutrients: variant.custom_nutrients,
  };
  const active = await getActiveNutritionIdentity();
  if (
    active?.userId !== identity.userId ||
    active.serverConfigId !== identity.serverConfigId
  )
    throw new Error('The nutrition account changed.');
  return enqueueFoodEntry({ ...identity, occurredAt, payload });
}

export interface QuickNutritionValues extends QuickLogTime {
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  notes?: string;
}

export async function logQuickNutrition(
  values: QuickNutritionValues
): Promise<PendingNutritionAction> {
  if (!Number.isFinite(values.calories) || values.calories < 0) {
    throw new Error('Calories must be a nonnegative number.');
  }
  for (const value of [values.protein, values.carbs, values.fat]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error('Macros must be nonnegative numbers.');
    }
  }
  const identity = await getActiveNutritionIdentity();
  if (!identity) {
    throw new Error(
      'Sign in once while online before logging nutrition offline.'
    );
  }
  const cache = await readNutritionFavoriteCache(identity);
  const occurredAt = values.occurredAt ?? new Date().toISOString();
  return saveAction(
    {
      meal_type_id: chooseMealType(cache.mealTypes, values.mealTypeId),
      quantity: 1,
      unit: 'serving',
      ...dateFields(occurredAt),
      food_name: 'Quick nutrition',
      serving_size: 1,
      serving_unit: 'serving',
      calories: values.calories,
      protein: values.protein,
      carbs: values.carbs,
      fat: values.fat,
      notes: values.notes ?? null,
    },
    occurredAt
  );
}
