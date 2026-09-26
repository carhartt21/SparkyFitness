import { buildWatchFoodShortcuts } from '../../src/utils/watchFoodShortcuts';
import type { FoodItem } from '../../src/types/foods';

const food = (id: string, overrides: Partial<FoodItem> = {}): FoodItem => ({
  id,
  name: `Food ${id}`,
  brand: null,
  is_custom: true,
  default_variant: {
    id: `${id}-variant`,
    serving_size: 100,
    serving_unit: 'g',
    calories: 120,
    protein: 4,
    carbs: 20,
    fat: 2,
  },
  ...overrides,
});

describe('Watch food shortcuts', () => {
  it('prefers a favorite when that food also appears in recent items', () => {
    const shortcuts = buildWatchFoodShortcuts(
      [food('shared'), food('favorite')],
      [food('shared'), food('recent')]
    );

    expect(shortcuts.map(({ foodId, group }) => [foodId, group])).toEqual([
      ['shared', 'favorite'],
      ['favorite', 'favorite'],
      ['recent', 'recent'],
    ]);
  });

  it('does not offer entries the Watch cannot log with a valid serving', () => {
    const invalidVariant = food('missing-variant');
    invalidVariant.default_variant.id = undefined;
    const invalidServing = food('zero-serving');
    invalidServing.default_variant.serving_size = 0;
    const invalidCalories = food('bad-calories');
    invalidCalories.default_variant.calories = Number.NaN;

    expect(
      buildWatchFoodShortcuts(
        [invalidVariant, invalidServing, invalidCalories, food('valid')],
        []
      ).map(({ foodId }) => foodId)
    ).toEqual(['valid']);
  });
});
