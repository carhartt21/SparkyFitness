import {
  buildWatchFoodShortcuts,
  buildWatchServings,
  watchThumbnailKey,
} from '../../src/utils/watchFoodShortcuts';
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
  it('ranks consumption popularity before the eight-favorite cap', () => {
    const favorites = Array.from({ length: 10 }, (_, index) =>
      food(`item-${index}`, { usage_count_28d: index })
    );
    const shortcuts = buildWatchFoodShortcuts(favorites, []);
    expect(shortcuts.map((item) => item.foodId)).toEqual([
      'item-9',
      'item-8',
      'item-7',
      'item-6',
      'item-5',
      'item-4',
      'item-3',
      'item-2',
    ]);
  });

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

describe('Watch food servings', () => {
  it('offers 100 g for a food measured in grams', () => {
    expect(buildWatchServings(food('oats'))).toEqual([
      expect.objectContaining({
        kind: 'default',
        quantity: 100,
        unit: 'g',
        variantId: 'oats-variant',
        calories: 120,
      }),
    ]);
  });

  it('puts the last logged amount first', () => {
    const servings = buildWatchServings(food('oats'), {
      lastServing: {
        food_id: 'oats',
        variant_id: 'oats-variant',
        quantity: 150,
        unit: 'g',
        serving_size: 100,
        serving_label: null,
        metric_amount: null,
        metric_unit: null,
        used_at: '2026-09-29T08:00:00Z',
      },
    });
    expect(servings.map(({ kind, quantity }) => [kind, quantity])).toEqual([
      ['last', 150],
      ['default', 100],
    ]);
    expect(servings[0].calories).toBe(180);
  });

  it('logs 100 g of a weighed portion against the portion with a grams override', () => {
    const bar = food('bar', {
      default_variant: {
        id: 'bar-variant',
        serving_size: 1,
        serving_unit: 'bar',
        calories: 172,
        protein: 15,
        carbs: 10,
        fat: 7,
      },
    });
    const servings = buildWatchServings(bar, {
      variants: [
        {
          id: 'bar-variant',
          food_id: 'bar',
          serving_size: 1,
          serving_unit: 'bar',
          metric_amount: 45,
          metric_unit: 'g',
          calories: 172,
          protein: 15,
          carbs: 10,
          fat: 7,
          is_default: true,
        },
      ],
    });
    expect(servings[0]).toEqual(
      expect.objectContaining({
        kind: 'default',
        quantity: 100,
        unit: 'g',
        variantId: 'bar-variant',
        servingSize: 45,
        servingUnit: 'g',
        calories: 382,
      })
    );
    expect(servings[1]).toEqual(
      expect.objectContaining({ kind: 'portion', quantity: 1, unit: 'bar' })
    );
    expect(servings[1]).not.toHaveProperty('servingSize');
  });

  it('offers the saved portion when a food cannot be weighed', () => {
    const cup = food('soup', {
      default_variant: {
        id: 'soup-variant',
        serving_size: 1,
        serving_unit: 'cup',
        calories: 90,
        protein: 3,
        carbs: 12,
        fat: 2,
      },
    });
    expect(
      buildWatchServings(cup).map(({ quantity, unit }) => [quantity, unit])
    ).toEqual([[1, 'cup']]);
  });

  it('names a thumbnail by its image so a new picture gets a new key', () => {
    const [withImage, withoutImage] = buildWatchFoodShortcuts(
      [
        food('pictured', { images: ['/uploads/foods/pictured/a.jpg'] }),
        food('plain'),
      ],
      []
    );
    expect(withImage.thumbnailKey).toBe(
      watchThumbnailKey('/uploads/foods/pictured/a.jpg')
    );
    expect(withImage.thumbnailKey).not.toBe(
      watchThumbnailKey('/uploads/foods/pictured/b.jpg')
    );
    expect(withoutImage.thumbnailKey).toBeNull();
  });
});
