import type { WatchFoodShortcutPayload } from '../../modules/watch-connectivity';
import type { FoodItem } from '../types/foods';

/** Keep the Watch catalogue small and deterministic; a favorite wins over a recent duplicate. */
export function buildWatchFoodShortcuts(
  favoriteFoods: FoodItem[],
  recentFoods: FoodItem[]
): WatchFoodShortcutPayload[] {
  const seen = new Set<string>();
  const candidates = [
    ...favoriteFoods
      .slice(0, 8)
      .map((food) => ({ food, group: 'favorite' as const })),
    ...recentFoods
      .slice(0, 8)
      .map((food) => ({ food, group: 'recent' as const })),
  ];

  return candidates.flatMap(({ food, group }) => {
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
      return [];
    }
    seen.add(food.id);
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
      },
    ];
  });
}
