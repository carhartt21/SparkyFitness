import type {
  WatchFoodServingPayload,
  WatchFoodShortcutPayload,
  WatchMealTypePayload,
} from '../../modules/watch-connectivity';
import type { TFunction } from 'i18next';
import type { FoodLastServing } from '@workspace/shared';
import type { FoodItem, FoodVariantDetail } from '../types/foods';
import type { MealType } from '../types/mealTypes';
import { getMealTypeDisplayLabel } from './mealNutrition';
import { primaryImageOf } from './foodImages';
import {
  buildQuickAddServings,
  buildServingOptions,
  type ServingOption,
} from './servingOptions';
import { formatLocalizedUnitQuantity } from './foodUnitLocalization';
import i18n from '../localization/i18n';

/** Amount offered by default for a food measured in grams or millilitres. */
export const WATCH_DEFAULT_METRIC_AMOUNT = 100;
/** The Watch's second step lists at most this many servings. */
const MAX_WATCH_SERVINGS = 4;

type ShortcutGroup = WatchFoodShortcutPayload['group'];

/** Present the same labels as Diary; logging continues to use the original IDs. */
export function buildWatchMealTypes(
  mealTypes: readonly Pick<
    MealType,
    'id' | 'name' | 'user_id' | 'display_name'
  >[],
  t: TFunction
): WatchMealTypePayload[] {
  return mealTypes.map((meal) => ({
    id: meal.id,
    name: getMealTypeDisplayLabel(meal, t),
  }));
}

export interface WatchFoodCandidate {
  food: FoodItem;
  group: ShortcutGroup;
}

/** What the phone knows about one food beyond its list row. */
export interface WatchFoodDetails {
  variants?: FoodVariantDetail[] | null;
  lastServing?: FoodLastServing | null;
}

/** Keep the Watch catalogue small and deterministic; a favorite wins over a recent duplicate. */
export function watchFoodCandidates(
  favoriteFoods: FoodItem[],
  recentFoods: FoodItem[]
): WatchFoodCandidate[] {
  const seen = new Set<string>();
  const candidates = [
    ...favoriteFoods
      .slice(0, 8)
      .map((food) => ({ food, group: 'favorite' as const })),
    ...recentFoods
      .slice(0, 8)
      .map((food) => ({ food, group: 'recent' as const })),
  ];
  return candidates.filter(({ food }) => {
    const variant = food.default_variant;
    if (
      !variant?.id ||
      !food.id ||
      !food.name.trim() ||
      seen.has(food.id) ||
      !Number.isFinite(variant.serving_size) ||
      variant.serving_size <= 0 ||
      !variant.serving_unit.trim() ||
      !Number.isFinite(variant.calories) ||
      variant.calories < 0
    ) {
      return false;
    }
    seen.add(food.id);
    return true;
  });
}

/**
 * A short, stable key for a food's thumbnail: it changes when the image does,
 * so the Watch can tell a cached picture from one it still needs.
 */
export function watchThumbnailKey(imagePath: string): string {
  let hash = 5381;
  for (let i = 0; i < imagePath.length; i++) {
    hash = ((hash << 5) + hash + imagePath.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function toServing(
  key: string,
  kind: WatchFoodServingPayload['kind'],
  option: ServingOption,
  quantity: number,
  title: string
): WatchFoodServingPayload {
  const servings = option.servingSize > 0 ? quantity / option.servingSize : 0;
  return {
    key,
    kind,
    title,
    quantity: Math.round(quantity * 100) / 100,
    unit: option.servingUnit,
    variantId: option.variantId,
    calories: Math.round(option.calories * servings),
    ...(option.servingOverride
      ? {
          servingSize: option.servingOverride.serving_size,
          servingUnit: option.servingOverride.serving_unit,
        }
      : {}),
  };
}

/**
 * The servings the Watch offers in its second step, in order: the amount last
 * logged for this food, then 100 g (or ml) when the food can be weighed, then
 * its saved portions. Built with the same option and quick-add rules as the
 * phone's food screen, so both offer the same choices.
 */
export function buildWatchServings(
  food: FoodItem,
  details: WatchFoodDetails = {}
): WatchFoodServingPayload[] {
  const defaultVariant = food.default_variant;
  const variants: FoodVariantDetail[] = details.variants?.length
    ? details.variants
    : defaultVariant.id
      ? [
          {
            ...defaultVariant,
            id: defaultVariant.id,
            food_id: food.id,
            is_default: true,
          },
        ]
      : [];
  const options = buildServingOptions(variants);
  const rows: WatchFoodServingPayload[] = [];
  const seen = new Set<string>();
  const push = (row: WatchFoodServingPayload) => {
    const identity = `${row.variantId}:${row.unit}:${row.quantity}`;
    if (seen.has(identity) || rows.length >= MAX_WATCH_SERVINGS) return;
    seen.add(identity);
    rows.push(row);
  };

  const quickAdd = buildQuickAddServings(options, details.lastServing);
  const last = quickAdd.find((row) => row.kind === 'last');
  if (last) {
    push(toServing('last', 'last', last.option, last.quantity, last.title));
  }
  const metric = options.find((option) => option.kind === 'metric');
  if (metric) {
    push(
      toServing(
        'default',
        'default',
        metric,
        WATCH_DEFAULT_METRIC_AMOUNT,
        formatLocalizedUnitQuantity(
          WATCH_DEFAULT_METRIC_AMOUNT,
          metric.servingUnit,
          i18n.t
        )
      )
    );
  }
  for (const row of quickAdd) {
    if (row.kind !== 'portion') continue;
    push(toServing(row.key, 'portion', row.option, row.quantity, row.title));
  }
  if (rows.length === 0 && options[0]) {
    push(
      toServing(
        'default',
        'default',
        options[0],
        options[0].servingSize,
        options[0].label
      )
    );
  }
  return rows;
}

/** Image path behind each thumbnail key the Watch may ask for. */
export function watchThumbnailPaths(
  favoriteFoods: FoodItem[],
  recentFoods: FoodItem[]
): Record<string, string> {
  const paths: Record<string, string> = {};
  for (const { food } of watchFoodCandidates(favoriteFoods, recentFoods)) {
    const image = primaryImageOf(food);
    if (image) paths[watchThumbnailKey(image)] = image;
  }
  return paths;
}

export function buildWatchFoodShortcuts(
  favoriteFoods: FoodItem[],
  recentFoods: FoodItem[],
  detailsByFoodId: Record<string, WatchFoodDetails> = {}
): WatchFoodShortcutPayload[] {
  return watchFoodCandidates(favoriteFoods, recentFoods).flatMap(
    ({ food, group }) => {
      const variant = food.default_variant;
      const servings = buildWatchServings(food, detailsByFoodId[food.id]);
      if (!variant.id || servings.length === 0) return [];
      const image = primaryImageOf(food);
      return [
        {
          foodId: food.id,
          variantId: variant.id,
          name: food.name,
          brand: food.brand,
          servingSize: variant.serving_size,
          servingUnit: variant.serving_unit,
          calories: variant.calories,
          group,
          servings,
          thumbnailKey: image ? watchThumbnailKey(image) : null,
        },
      ];
    }
  );
}
