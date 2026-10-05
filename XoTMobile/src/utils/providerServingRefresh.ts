import type { FoodVariantDetail } from '../types/foods';
import type { ExternalFoodVariant } from '../types/externalFoods';
import type { CreateFoodVariantPayload } from '../services/api/foodsApi';
import { servingVariantKey, toPersistedServingUnit } from './foodDetails';

const nutrients = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'saturated_fat',
  'polyunsaturated_fat',
  'monounsaturated_fat',
  'trans_fat',
  'cholesterol',
  'sodium',
  'potassium',
  'dietary_fiber',
  'sugars',
  'vitamin_a',
  'vitamin_c',
  'calcium',
  'iron',
  'caffeine_mg',
  'water_ml',
  'alcohol_g',
] as const;

/** Import portion geometry only; retain the saved food's nutrition and corrections. */
export function missingProviderServings(
  foodId: string,
  stored: readonly FoodVariantDetail[],
  provider: readonly ExternalFoodVariant[]
): CreateFoodVariantPayload[] {
  const keys = new Set(stored.map(servingVariantKey));
  return provider.slice(0, 10).flatMap((portion) => {
    const metric = Number(portion.metric_amount);
    if (
      !portion.metric_unit ||
      !Number.isFinite(metric) ||
      metric <= 0 ||
      !Number.isFinite(portion.serving_size) ||
      portion.serving_size <= 0 ||
      ['g', 'ml'].includes(portion.serving_unit.toLowerCase())
    )
      return [];
    const key = servingVariantKey(portion);
    if (keys.has(key)) return [];
    const basis = stored.find(
      (variant) =>
        variant.serving_unit.toLowerCase() === portion.metric_unit &&
        variant.serving_size > 0 &&
        ['calories', 'protein', 'carbs', 'fat'].every((name) =>
          Number.isFinite(
            variant[name as 'calories' | 'protein' | 'carbs' | 'fat']
          )
        )
    );
    if (!basis) return [];
    const factor = metric / basis.serving_size;
    const values: Partial<Record<(typeof nutrients)[number], number>> = {};
    for (const name of nutrients) {
      const value = basis[name];
      if (value !== null && value !== undefined && Number.isFinite(value))
        values[name] = value * factor;
    }
    const custom =
      basis.custom_nutrients &&
      Object.fromEntries(
        Object.entries(basis.custom_nutrients).map(([name, value]) => [
          name,
          typeof value === 'number' && Number.isFinite(value)
            ? value * factor
            : value,
        ])
      );
    keys.add(key);
    return [
      {
        food_id: foodId,
        serving_size: portion.serving_size,
        serving_unit: toPersistedServingUnit(portion),
        serving_label: portion.serving_label,
        metric_amount: metric,
        metric_unit: portion.metric_unit,
        sort_order: portion.sort_order,
        source: 'imported' as const,
        ...values,
        calories: values.calories!,
        protein: values.protein!,
        carbs: values.carbs!,
        fat: values.fat!,
        ...(custom ? { custom_nutrients: custom } : {}),
      },
    ];
  });
}
