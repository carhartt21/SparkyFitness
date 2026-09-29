import {
  buildQuickAddServings,
  buildServingOptions,
  convertServingQuantity,
  findNutritionBasis,
  METRIC_OPTION_PREFIX,
} from '../../src/utils/servingOptions';
import type { FoodVariantDetail } from '../../src/types/foods';

const row = (overrides: Partial<FoodVariantDetail>): FoodVariantDetail => ({
  id: 'row',
  food_id: 'food-1',
  serving_size: 100,
  serving_unit: 'g',
  metric_amount: 100,
  metric_unit: 'g',
  calories: 50,
  protein: 1,
  carbs: 12,
  fat: 0.2,
  ...overrides,
});

const basis = row({ id: 'basis', is_default: true, sort_order: 0 });
const cup = row({
  id: 'cup',
  serving_size: 1,
  serving_unit: 'cup',
  metric_amount: 245,
  calories: 122.5,
  protein: 2.45,
  carbs: 29.4,
  fat: 0.49,
  sort_order: 2,
});
const medium = row({
  id: 'medium',
  serving_label: 'Medium',
  serving_size: 1,
  serving_unit: 'piece',
  metric_amount: 130,
  calories: 65,
  protein: 1.3,
  carbs: 15.6,
  fat: 0.26,
  sort_order: 1,
});

describe('buildServingOptions', () => {
  it('puts grams first, then portions in the saved order', () => {
    const options = buildServingOptions([cup, basis, medium]);
    expect(options.map((option) => [option.kind, option.id])).toEqual([
      ['metric', 'basis'],
      ['portion', 'medium'],
      ['portion', 'cup'],
    ]);
    expect(options[0].label).toBe('Grams');
    expect(options[1].label).toBe('Medium (130 g)');
    expect(options[2].label).toBe('1 cup (245 g)');
  });

  it('folds a plain gram row that restates the basis into grams', () => {
    const fifty = row({
      id: 'fifty',
      serving_size: 50,
      metric_amount: 50,
      calories: 25,
      protein: 0.5,
      carbs: 6,
      fat: 0.1,
    });
    const options = buildServingOptions([basis, fifty]);
    expect(options.map((option) => option.id)).toEqual(['basis']);
    const custom = { ...fifty, serving_label: 'Custom' };
    expect(buildServingOptions([basis, custom]).map((o) => o.label)).toEqual([
      'Grams',
      'Custom (50 g)',
    ]);
  });

  it('derives a grams option from a weighed serving unless pickers forbid it', () => {
    const bar = row({
      id: 'bar',
      serving_size: 1,
      serving_unit: 'bar',
      metric_amount: 45,
      is_default: true,
    });
    const [grams, portion] = buildServingOptions([bar]);
    expect(grams).toEqual(
      expect.objectContaining({
        id: `${METRIC_OPTION_PREFIX}bar`,
        variantId: 'bar',
        servingSize: 45,
        servingUnit: 'g',
        servingOverride: { serving_size: 45, serving_unit: 'g' },
      })
    );
    expect(portion.label).toBe('1 bar (45 g)');
    expect(
      buildServingOptions([bar], { allowSynthesizedMetric: false }).map(
        (option) => option.kind
      )
    ).toEqual(['portion']);
  });

  it('offers no grams when nothing states a weight', () => {
    const serving = row({
      id: 'serving',
      serving_size: 1,
      serving_unit: 'serving',
      metric_amount: null,
      metric_unit: null,
      is_default: true,
    });
    expect(buildServingOptions([serving]).map((o) => o.kind)).toEqual([
      'portion',
    ]);
    expect(findNutritionBasis([cup, serving])?.id).toBe('serving');
  });
});

describe('convertServingQuantity', () => {
  it('converts through weights and refuses without them', () => {
    const [grams, portion] = buildServingOptions([basis, medium]);
    expect(convertServingQuantity(260, grams, portion)).toBeCloseTo(2);
    expect(
      convertServingQuantity(1, portion, { servingSize: 1, weight: null })
    ).toBeUndefined();
  });
});

describe('buildQuickAddServings', () => {
  const options = buildServingOptions([basis, medium, cup]);

  it('lists each saved portion once', () => {
    expect(buildQuickAddServings(options, null).map((r) => r.key)).toEqual([
      'medium',
      'cup',
    ]);
  });

  it('puts the last serving first and does not repeat an identical portion', () => {
    const rows = buildQuickAddServings(options, {
      food_id: 'food-1',
      variant_id: 'medium',
      quantity: 1,
      unit: 'piece',
      serving_size: 1,
      serving_label: 'Medium',
      metric_amount: 130,
      metric_unit: 'g',
      used_at: '2026-09-29',
    });
    expect(rows.map((r) => [r.key, r.title])).toEqual([
      ['last', 'Medium (130 g)'],
      ['cup', '1 cup (245 g)'],
    ]);
  });

  it('offers a last gram amount and a deleted portion in grams', () => {
    const grams = buildQuickAddServings(options, {
      food_id: 'food-1',
      variant_id: 'basis',
      quantity: 150,
      unit: 'g',
      serving_size: 100,
      serving_label: null,
      metric_amount: 100,
      metric_unit: 'g',
      used_at: '2026-09-29',
    })[0];
    expect(grams).toEqual(
      expect.objectContaining({ kind: 'last', title: '150 g', quantity: 150 })
    );
    expect(grams.calories).toBeCloseTo(75);

    const deleted = buildQuickAddServings(options, {
      food_id: 'food-1',
      variant_id: null,
      quantity: 2,
      unit: 'slice',
      serving_size: 1,
      serving_label: 'Slice',
      metric_amount: 30,
      metric_unit: 'g',
      used_at: '2026-09-29',
    })[0];
    expect(deleted).toEqual(
      expect.objectContaining({ kind: 'last', title: '60 g', quantity: 60 })
    );

    expect(
      buildQuickAddServings(options, {
        food_id: 'food-1',
        variant_id: null,
        quantity: 1,
        unit: 'bowl',
        serving_size: 1,
        serving_label: null,
        metric_amount: null,
        metric_unit: null,
        used_at: '2026-09-29',
      })[0].kind
    ).toBe('portion');
  });
});
