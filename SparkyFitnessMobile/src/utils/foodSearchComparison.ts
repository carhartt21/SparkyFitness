export interface SearchNutrientServing {
  serving_size: number;
  serving_unit: string;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

export interface FoodSearchComparison {
  basis: '100g' | '100ml' | 'serving';
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

/** Only explicit metric mass or volume units permit a per-100 comparison. */
export function foodSearchComparison(
  serving: SearchNutrientServing
): FoodSearchComparison {
  const unit = serving.serving_unit.trim().toLowerCase();
  const metric: Record<
    string,
    { basis: '100g' | '100ml'; multiplier: number }
  > = {
    g: { basis: '100g', multiplier: 1 },
    gram: { basis: '100g', multiplier: 1 },
    grams: { basis: '100g', multiplier: 1 },
    kg: { basis: '100g', multiplier: 1000 },
    ml: { basis: '100ml', multiplier: 1 },
    milliliter: { basis: '100ml', multiplier: 1 },
    millilitre: { basis: '100ml', multiplier: 1 },
    l: { basis: '100ml', multiplier: 1000 },
    liter: { basis: '100ml', multiplier: 1000 },
    litre: { basis: '100ml', multiplier: 1000 },
  };
  const reference = metric[unit];
  const size = serving.serving_size * (reference?.multiplier ?? 1);
  const canNormalize = reference && Number.isFinite(size) && size > 0;
  const factor = canNormalize ? 100 / size : 1;
  const nutrient = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value * factor : null;
  return {
    basis: canNormalize ? reference.basis : 'serving',
    calories: nutrient(serving.calories),
    protein: nutrient(serving.protein),
    carbs: nutrient(serving.carbs),
    fat: nutrient(serving.fat),
  };
}
