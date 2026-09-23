import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cacheFavoriteFoods,
  cacheQuickMealTypes,
} from '../../src/services/nutritionFavoriteCache';
import { listNutritionActions } from '../../src/services/nutritionActionOutbox';
import {
  logFavoriteFood,
  logQuickNutrition,
} from '../../src/services/quickNutritionLog';
import { getActiveServerConfigId } from '../../src/services/storage';
import { rememberActiveNutritionUser } from '../../src/services/nutritionIdentity';
import type { FoodItem } from '../../src/types/foods';
import type { MealType } from '../../src/types/mealTypes';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfigId: jest.fn().mockResolvedValue('server-a'),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '3116b172-7248-4c9e-aa4a-181e2efc8c70'),
}));

const owner = { serverConfigId: 'server-a', userId: 'user-a' };
const food: FoodItem = {
  id: 'food-bar',
  name: 'Synthetic protein bar',
  brand: 'Test',
  is_custom: true,
  default_variant: {
    id: 'variant-bar',
    serving_size: 50,
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
  sort_order: 1,
  user_id: null,
  created_at: '2026-09-23T12:00:00.000Z',
  is_visible: true,
  show_in_quick_log: true,
};

describe('quick nutrition logging', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const crypto = jest.requireMock('expo-crypto') as { randomUUID: jest.Mock };
    let sequence = 0;
    crypto.randomUUID.mockImplementation(
      () => `3116b172-7248-4c9e-aa4a-${String(++sequence).padStart(12, '0')}`
    );
    (getActiveServerConfigId as jest.Mock).mockResolvedValue('server-a');
    await AsyncStorage.clear();
    await rememberActiveNutritionUser('user-a');
    await cacheFavoriteFoods(owner, [food]);
    await cacheQuickMealTypes(owner, [mealType]);
  });

  test('offline favorite is durably recorded with the cached nutrient snapshot', async () => {
    const occurredAt = '2026-09-23T12:00:00.000Z';
    const action = await logFavoriteFood('food-bar', { occurredAt });
    expect(action.occurredAt).toBe(occurredAt);
    expect(action.payload).toMatchObject({
      client_operation_id: action.clientOperationId,
      meal_type_id: 'lunch',
      food_name: 'Synthetic protein bar',
      quantity: 50,
      serving_size: 50,
      calories: 200,
      protein: 20,
    });
    expect(action.payload.food_id).toBeUndefined();
    expect((await listNutritionActions(owner))[0]).toEqual(action);
  });

  test('logged snapshot stays stable when the cached favorite changes', async () => {
    const action = await logFavoriteFood('food-bar');
    await cacheFavoriteFoods(owner, [
      {
        ...food,
        default_variant: { ...food.default_variant, calories: 300 },
      },
    ]);
    expect((await listNutritionActions(owner))[0].payload.calories).toBe(200);
    const second = await logFavoriteFood('food-bar');
    expect(second.payload.calories).toBe(300);
    expect(action.clientOperationId).not.toBe(second.clientOperationId);
  });

  test('quick calories preserve unknown macros as absent, not zero', async () => {
    const action = await logQuickNutrition({ calories: 140 });
    expect(action.payload.calories).toBe(140);
    expect(action.payload.protein).toBeUndefined();
    expect(action.payload.carbs).toBeUndefined();
    expect(action.payload.fat).toBeUndefined();
  });

  test('missing cached favorite or meal type cannot claim durable success', async () => {
    await expect(logFavoriteFood('missing')).rejects.toThrow(/not cached/);
    await cacheQuickMealTypes(owner, []);
    await expect(logFavoriteFood('food-bar')).rejects.toThrow(/meal category/);
    expect(await listNutritionActions(owner)).toEqual([]);
  });
});
