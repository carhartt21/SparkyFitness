import { missingProviderServings } from '../../src/utils/providerServingRefresh';
import type { FoodVariantDetail } from '../../src/types/foods';
import type { ExternalFoodVariant } from '../../src/types/externalFoods';

export const basis: FoodVariantDetail = {
  id: 'base',
  food_id: 'food',
  serving_size: 100,
  serving_unit: 'g',
  calories: 572,
  carbs: 49.5,
  protein: 8.6,
  fat: 37.3,
  is_default: true,
  custom_nutrients: { Magnesium: 20 },
  water_ml: 3,
};
export const portion: ExternalFoodVariant = {
  serving_size: 1,
  serving_unit: 'serving',
  serving_description: '1 serving (21.5 g)',
  serving_label: '1 serving',
  metric_amount: 21.5,
  metric_unit: 'g',
  calories: 123,
  carbs: 10.6,
  protein: 1.8,
  fat: 8,
};

describe('provider portion backfill', () => {
  it('adds countable geometry using saved nutrition, preserving the original and unknown nutrients', () => {
    const original = {
      ...basis,
      custom_nutrients: { ...basis.custom_nutrients },
    };
    const [result] = missingProviderServings('food', [basis], [portion]);
    expect(result.serving_size).toBe(1);
    expect(result.serving_unit).toBe('serving (21.5 g)');
    expect(result.metric_amount).toBe(21.5);
    expect(result.calories).toBeCloseTo(122.98);
    expect(result.calories * 2).toBeCloseTo(245.96);
    expect(result.metric_amount! * 2).toBe(43);
    expect(result.custom_nutrients).toEqual({ Magnesium: 4.3 });
    expect(result).not.toHaveProperty('sodium');
    expect(result.source).toBe('imported');
    expect(basis).toEqual(original);
  });
  it('deduplicates exact stored and repeated provider portions', () => {
    const [result] = missingProviderServings(
      'food',
      [basis],
      [portion, portion]
    );
    const stored = { ...basis, ...result, id: 'portion' };
    expect(missingProviderServings('food', [basis, stored], [portion])).toEqual(
      []
    );
  });
  it('keeps different weights distinct and skips invalid or incomparable geometry', () => {
    expect(
      missingProviderServings(
        'food',
        [basis],
        [
          portion,
          {
            ...portion,
            metric_amount: 43,
            serving_description: '1 serving (43 g)',
          },
        ]
      )
    ).toHaveLength(2);
    for (const invalid of [
      { ...portion, metric_amount: 0 },
      { ...portion, metric_unit: 'ml' as const },
      { ...portion, metric_amount: null },
      { ...portion, serving_size: NaN },
    ])
      expect(missingProviderServings('food', [basis], [invalid])).toEqual([]);
  });
  it('preserves owner corrections rather than copying provider calories', () => {
    expect(
      missingProviderServings(
        'food',
        [{ ...basis, calories: 400 }],
        [portion]
      )[0].calories
    ).toBe(86);
  });
});
