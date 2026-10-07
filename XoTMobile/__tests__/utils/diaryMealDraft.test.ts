import { diaryMealDraft } from '../../src/utils/diaryMealDraft';
import type { FoodEntry } from '../../src/types/foodEntries';
const entry = (values: Partial<FoodEntry> = {}) =>
  ({
    id: 'old-entry',
    food_id: 'food',
    variant_id: 'recorded-variant',
    food_name: 'Custom oats',
    quantity: 150,
    unit: 'g',
    serving_size: 100,
    serving_unit: 'g',
    calories: 100,
    protein: 5,
    carbs: 15,
    fat: 2,
    water_ml: 80,
    brand_name: 'Custom brand',
    entry_date: '2026-10-03',
    entry_time: '08:30',
    ...values,
  }) as FoodEntry;
it('retains recorded serving nutrition and amounts without entry identity', () => {
  const draft = diaryMealDraft([entry()]);
  expect(draft.unresolved).toEqual([]);
  expect(draft.ingredients[0]).toMatchObject({
    food_id: 'food',
    variant_id: 'recorded-variant',
    quantity: 150,
    unit: 'g',
    serving_size: 100,
    calories: 100,
    water_ml: 80,
    brand: 'Custom brand',
  });
  expect(draft.ingredients[0]).not.toHaveProperty('id');
  expect(draft.ingredients[0]).not.toHaveProperty('entry_date');
});
it('requires explicit resolution for captures, missing nutrition or deleted library foods', () => {
  const pending = entry({ isPendingNutrition: true }),
    missing = entry({ protein: null }),
    deleted = entry({ food_id: null });
  const draft = diaryMealDraft([entry(), pending, missing, deleted]);
  expect(draft.ingredients).toHaveLength(1);
  expect(draft.unresolved).toEqual([pending, missing, deleted]);
});

it('requires explicit resolution when a reusable serving variant is unavailable', () => {
  const missingVariant = entry({ variant_id: null });
  const draft = diaryMealDraft([missingVariant]);
  expect(draft.ingredients).toEqual([]);
  expect(draft.unresolved).toEqual([missingVariant]);
});
