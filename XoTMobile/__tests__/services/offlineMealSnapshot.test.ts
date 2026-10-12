import {
  offlineMealAsFood,
  snapshotOfflineMeals,
} from '../../src/services/offlineMealSnapshot';
import { savedMeal, offlineIngredient } from '../helpers/offlineMealFixtures';
import { offlineMealFoodSchema } from '@workspace/shared';

describe('offline recipe snapshots', () => {
  it('keeps the entire recipe and displays one serving of its yield', async () => {
    const [snapshot] = await snapshotOfflineMeals([savedMeal]);
    expect(snapshot.foods[0]).toMatchObject({ quantity: 200, water_ml: 8 });
    expect(snapshot.notes).toBe('Keep refrigerated');
    expect(offlineMealAsFood(snapshot).default_variant).toMatchObject({
      serving_size: 1,
      calories: 175,
      protein: 6,
    });
    expect(snapshot.foods[0]).not.toHaveProperty('sodium');
  });
  it('resolves a nested meal with a metric yield and a legacy serving quantity', async () => {
    const child = {
      ...savedMeal,
      id: '22222222-2222-4222-8222-222222222222',
      serving_size: 250,
      serving_unit: 'g',
      total_servings: 4,
    };
    const parent = {
      ...savedMeal,
      foods: [
        {
          ...offlineIngredient,
          item_type: 'meal' as const,
          child_meal_id: child.id,
          quantity: 2,
          unit: 'serving',
        },
      ],
    };
    const load = jest.fn().mockResolvedValue(child);
    const [snapshot] = await snapshotOfflineMeals([parent], load);
    expect(load).toHaveBeenCalledWith(child.id);
    expect(snapshot.foods[0].quantity).toBe(100);
    expect(offlineMealAsFood(snapshot).default_variant.calories).toBe(87.5);
  });
  it('rejects incomplete/cyclic recipes rather than fabricating a single aggregate food', async () => {
    const cycle = {
      ...savedMeal,
      foods: [
        {
          ...offlineIngredient,
          item_type: 'meal' as const,
          child_meal_id: savedMeal.id,
        },
      ],
    };
    const missing = {
      ...savedMeal,
      foods: [
        {
          ...offlineIngredient,
          item_type: 'meal' as const,
          child_meal_id: 'missing',
        },
      ],
    };
    const unknown = {
      ...savedMeal,
      foods: [{ ...offlineIngredient, protein: undefined }],
    } as unknown as typeof savedMeal;
    expect(await snapshotOfflineMeals([cycle])).toEqual([]);
    expect(
      await snapshotOfflineMeals(
        [missing],
        jest.fn().mockRejectedValue(new Error('missing'))
      )
    ).toEqual([]);
    expect(await snapshotOfflineMeals([unknown])).toEqual([]);
  });
  it('does not guess an ingredient conversion or allow negative amounts', async () => {
    expect(
      offlineMealFoodSchema.safeParse({
        food_name: 'Measured ingredient',
        quantity: 1,
        unit: 'cup',
        serving_size: 100,
        serving_unit: 'g',
        calories: 150,
        protein: 3,
        carbs: 12,
        fat: 8,
      }).success
    ).toBe(false);
    expect(
      await snapshotOfflineMeals([
        { ...savedMeal, foods: [{ ...offlineIngredient, unit: 'cup' }] },
      ])
    ).toEqual([]);
    expect(
      await snapshotOfflineMeals([
        { ...savedMeal, foods: [{ ...offlineIngredient, quantity: -2 }] },
      ])
    ).toEqual([]);
  });
});
