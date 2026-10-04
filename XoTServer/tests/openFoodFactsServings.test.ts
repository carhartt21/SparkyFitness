import { describe, expect, it, vi } from 'vitest';
import { mapOpenFoodFactsProduct } from '../integrations/openfoodfacts/openFoodFactsService.js';
import { NormalizedFoodSchema } from '../schemas/foodSchemas.js';
import kinder from './fixtures/off-kinder-bueno-80052760.json' with { type: 'json' };

vi.mock('../integrations/openfoodfacts/openFoodFactsAuth.js', () => ({
  DEFAULT_OFF_BASE_URL: 'https://world.openfoodfacts.org',
  resolveOpenFoodFactsProvider: vi.fn(),
  invalidateOpenFoodFactsSession: vi.fn(),
}));
vi.mock('../services/openFoodFactsProductReadRateLimitService.js', () => ({
  OPENFOODFACTS_INTERACTIVE_PRODUCT_READ_MAX_WAIT_MS: 5250,
  withOpenFoodFactsProductReadPermit: vi.fn(),
}));

describe('OFF serving ingestion', () => {
  // Public API subset retrieved on 2026-10-04; fixture has no account data.
  it.each([true, false])(
    'retains the real Kinder serving with autoScale=%s',
    (autoScale) => {
      const food = NormalizedFoodSchema.parse(
        mapOpenFoodFactsProduct(kinder, { autoScale })
      );
      expect(food.default_variant).toMatchObject({
        serving_size: autoScale ? 21.5 : 100,
        serving_unit: 'g',
        calories: autoScale ? 123 : 572,
      });
      const portion = food.variants?.[1];
      expect(portion).toMatchObject({
        serving_size: 1,
        serving_unit: 'serving',
        metric_amount: 21.5,
        metric_unit: 'g',
        serving_description: '1 serving (21.5 g)',
        calories: 123,
        fat: 8,
        carbs: 10.6,
        protein: 1.8,
      });
      // 43 g pack is not silently substituted for the manufacturer's serving.
      expect(portion?.metric_amount).not.toBe(kinder.product_quantity);
    }
  );

  it.each([
    ['21.5 g', undefined, 1, 'serving', 21.5, 'g'],
    ['21.5 grammes', undefined, 1, 'serving', 21.5, 'g'],
    [undefined, '21.5', 1, 'serving', 21.5, 'g'],
    ['21,5 g', '21,5', 1, 'serving', 21.5, 'g'],
    ['2 cookies (28 g)', undefined, 2, 'cookies', 28, 'g'],
    ['1 bar', '21.5', 1, 'bar', 21.5, 'g'],
    ['1 cup (240 ml)', undefined, 1, 'cup', 240, 'ml'],
    ['0.5 l', undefined, 1, 'serving', 500, 'ml'],
    ['0.5 l', '500', 1, 'serving', 500, 'ml'],
    ['0.5 litres', '500', 1, 'serving', 500, 'ml'],
    ['0,5 Portion (21,5 g)', undefined, 0.5, 'serving', 21.5, 'g'],
  ] as const)(
    'reads %s with quantity %s',
    (text, quantity, count, unit, amount, metricUnit) => {
      const food = mapOpenFoodFactsProduct(
        {
          ...kinder,
          product_quantity_unit: undefined,
          serving_quantity_unit: undefined,
          serving_size: text,
          serving_quantity: quantity,
        },
        { autoScale: false }
      );
      expect(food.default_variant.serving_size).toBe(100);
      expect(food.variants?.[1]).toMatchObject({
        serving_size: count,
        serving_unit: unit,
        metric_amount: amount,
        metric_unit: metricUnit,
        calories: Math.round((572 * amount) / 100),
      });
    }
  );

  it.each([
    { serving_size: '1 bar', serving_quantity: undefined },
    { serving_size: undefined, serving_quantity: 0 },
    { serving_size: undefined, serving_quantity: -20 },
    { serving_size: undefined, serving_quantity: Infinity },
    { serving_size: undefined, serving_quantity: '21 g' },
    { serving_size: '2 bars (28 g)', serving_quantity: 21.5 },
    { serving_size: '1 cup (21.5 ml)', serving_quantity: 21.5 },
  ])('does not guess an unsafe serving %j', (overrides) => {
    const food = mapOpenFoodFactsProduct({ ...kinder, ...overrides });
    expect(food.variants).toBeUndefined();
    expect(food.default_variant).toMatchObject({
      serving_size: 100,
      calories: 572,
    });
  });

  it('normalizes serving-only nutrients using an explicit textual weight', () => {
    const food = mapOpenFoodFactsProduct(
      {
        ...kinder,
        serving_quantity: undefined,
        nutriments: { 'energy-kcal_serving': 123, proteins_serving: 1.85 },
      },
      { autoScale: false }
    );
    expect(food.default_variant.calories).toBe(572);
    expect(food.variants?.[1]?.calories).toBe(123);
  });
});
