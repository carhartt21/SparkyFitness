import type { Meal, MealFood } from '../../src/types/meals';
import type { OfflineMealSnapshot } from '@workspace/shared';

export const offlineIngredient: MealFood = {
  id: 'ingredient',
  food_name: 'Test oats',
  brand: null,
  quantity: 200,
  unit: 'g',
  serving_size: 100,
  serving_unit: 'g',
  calories: 350,
  protein: 12,
  carbs: 60,
  fat: 6,
  water_ml: 8,
};
export const savedMeal: Meal = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'user-a',
  name: 'Test breakfast',
  description: 'Recipe reference',
  notes: 'Keep refrigerated',
  is_public: false,
  serving_size: 1,
  serving_unit: 'serving',
  total_servings: 4,
  created_at: '2026-10-12T12:00:00Z',
  updated_at: '2026-10-12T12:00:00Z',
  foods: [offlineIngredient],
};
export const offlineMeal: OfflineMealSnapshot = {
  id: savedMeal.id,
  name: savedMeal.name,
  description: savedMeal.description,
  notes: savedMeal.notes,
  serving_size: 1,
  serving_unit: 'serving',
  total_servings: 4,
  foods: [
    {
      food_name: 'Test oats',
      brand_name: null,
      quantity: 200,
      unit: 'g',
      serving_size: 100,
      serving_unit: 'g',
      calories: 350,
      protein: 12,
      carbs: 60,
      fat: 6,
      water_ml: 8,
    },
  ],
};
export const offlineMealPayload = {
  client_operation_id: '33333333-3333-4333-8333-333333333333',
  entry_date: '2026-10-12',
  entry_time: '23:05:00',
  meal_type_id: '22222222-2222-4222-8222-222222222222',
  quantity: 2,
  meal: offlineMeal,
};
