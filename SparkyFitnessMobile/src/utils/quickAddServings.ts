/** Multiples of a serving offered as one-tap amounts (50/100/150/200 g for a 100 g serving). */
export const QUICK_ADD_MULTIPLIERS = [0.5, 1, 1.5, 2] as const;

export interface QuickAddServingBasis {
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface QuickAddPreset {
  multiplier: number;
  /** Amount in the serving's own unit (grams, ml, pieces), as entries store it. */
  quantity: number;
}

/**
 * One-tap amounts for a serving basis. Quantity is denominated in the
 * serving unit, matching FoodEntryAddScreen and the multi-add basket.
 */
export function buildQuickAddPresets(
  basis: Pick<QuickAddServingBasis, 'serving_size'>
): QuickAddPreset[] {
  const size =
    Number.isFinite(basis.serving_size) && basis.serving_size > 0
      ? basis.serving_size
      : 1;
  return QUICK_ADD_MULTIPLIERS.map((multiplier) => ({
    multiplier,
    quantity: Math.round(size * multiplier * 100) / 100,
  }));
}

export interface ScaledNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Nutrition for `quantity` of a serving; an invalid serving size yields zeros. */
export function scaleServingNutrition(
  basis: QuickAddServingBasis,
  quantity: number
): ScaledNutrition {
  const factor =
    basis.serving_size > 0 && Number.isFinite(quantity)
      ? quantity / basis.serving_size
      : 0;
  return {
    calories: (basis.calories ?? 0) * factor,
    protein: (basis.protein ?? 0) * factor,
    carbs: (basis.carbs ?? 0) * factor,
    fat: (basis.fat ?? 0) * factor,
  };
}
