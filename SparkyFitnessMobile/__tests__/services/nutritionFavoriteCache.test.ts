import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cacheFavoriteFoods,
  cacheQuickMealTypes,
  readNutritionFavoriteCache,
} from '../../src/services/nutritionFavoriteCache';
import type { FoodItem } from '../../src/types/foods';
import type { MealType } from '../../src/types/mealTypes';

const owner = { serverConfigId: 'server-a', userId: 'user-a' };
const food: FoodItem = {
  id: 'food-1',
  name: 'Synthetic bar',
  brand: 'Test',
  is_custom: true,
  default_variant: {
    id: 'variant-1',
    serving_size: 55,
    serving_unit: 'g',
    calories: 200,
    protein: 20,
    carbs: 19,
    fat: 6,
  },
};
const mealType: MealType = {
  id: 'lunch',
  name: 'Lunch',
  sort_order: 2,
  user_id: null,
  created_at: '2026-09-23T12:00:00.000Z',
  is_visible: true,
  show_in_quick_log: true,
};

describe('offline favorite cache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('keeps a complete logging snapshot after restart and separates identities', async () => {
    await cacheFavoriteFoods(owner, [food]);
    const stored = await readNutritionFavoriteCache(owner);
    expect(stored.foods[0]).toMatchObject({
      name: 'Synthetic bar',
      default_variant: {
        serving_size: 55,
        calories: 200,
        protein: 20,
      },
    });
    expect(
      (await readNutritionFavoriteCache({ ...owner, userId: 'user-b' })).foods
    ).toEqual([]);
  });

  test('meal types and food refreshes do not overwrite each other', async () => {
    await cacheFavoriteFoods(owner, [food]);
    await cacheQuickMealTypes(owner, [mealType]);
    expect((await readNutritionFavoriteCache(owner)).mealTypes[0].id).toBe(
      'lunch'
    );
    await cacheFavoriteFoods(owner, []);
    const refreshed = await readNutritionFavoriteCache(owner);
    expect(refreshed.foods).toEqual([]);
    expect(refreshed.mealTypes).toHaveLength(1);
  });

  test('server null nutrients stay unknown while known zero is retained', async () => {
    const serverFood = {
      ...food,
      default_variant: {
        ...food.default_variant,
        saturated_fat: null,
        sodium: null,
        custom_nutrients: null,
        sugars: 0,
      },
    } as unknown as FoodItem;
    await cacheFavoriteFoods(owner, [serverFood]);
    const variant = (await readNutritionFavoriteCache(owner)).foods[0]
      .default_variant;
    expect(variant).not.toHaveProperty('saturated_fat');
    expect(variant).not.toHaveProperty('sodium');
    expect(variant).not.toHaveProperty('custom_nutrients');
    expect(variant.sugars).toBe(0);
  });

  test('storage failure does not claim a favorite was cached', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(cacheFavoriteFoods(owner, [food])).rejects.toThrow(
      'disk full'
    );
    expect((await readNutritionFavoriteCache(owner)).foods).toEqual([]);
    setItem.mockRestore();
  });
});
