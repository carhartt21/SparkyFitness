import {
  offlineMealFoodSchema,
  offlineMealSnapshotSchema,
  type OfflineMealFood,
  type OfflineMealSnapshot,
} from '@workspace/shared';
import type { Meal } from '../types/meals';
import type { FoodItem } from '../types/foods';
import { fetchMeal } from './api/mealsApi';

/** Resolve nested recipes while online; an incomplete recipe is never cached. */
export async function snapshotOfflineMeals(
  meals: Meal[],
  load: (id: string) => Promise<Meal> = fetchMeal
): Promise<OfflineMealSnapshot[]> {
  const known = new Map(meals.map((meal) => [meal.id, Promise.resolve(meal)]));
  const resolve = (id: string) => {
    let pending = known.get(id);
    if (!pending) {
      pending = load(id);
      known.set(id, pending);
    }
    return pending;
  };
  const leaves = async (
    meal: Meal,
    factor: number,
    ancestors: Set<string>
  ): Promise<OfflineMealFood[]> => {
    if (ancestors.has(meal.id) || ancestors.size >= 8)
      throw new Error('Invalid nested recipe.');
    const next = new Set([...ancestors, meal.id]);
    const result: OfflineMealFood[] = [];
    for (const component of meal.foods) {
      if (component.quantity === 0) continue;
      if (component.item_type === 'meal') {
        if (!component.child_meal_id) throw new Error('Missing nested recipe.');
        const child = await resolve(component.child_meal_id);
        const amount =
          component.unit === 'serving' && child.serving_unit !== 'serving'
            ? component.quantity * child.serving_size
            : component.quantity;
        result.push(
          ...(await leaves(
            child,
            (factor * amount) / (child.serving_size * child.total_servings),
            next
          ))
        );
      } else {
        if (component.unit !== component.serving_unit)
          throw new Error('Unresolved ingredient unit.');
        const snapshot: Record<string, unknown> = {
          food_name: component.food_name,
          brand_name: component.brand,
          quantity: component.quantity * factor,
          unit: component.unit,
        };
        for (const key of Object.keys(offlineMealFoodSchema.shape)) {
          if (key in snapshot) continue;
          const value = component[key as keyof typeof component];
          if (value !== null && value !== undefined) snapshot[key] = value;
        }
        result.push(offlineMealFoodSchema.parse(snapshot));
      }
      if (result.length > 200)
        throw new Error('Recipe exceeds offline ingredient limit.');
    }
    return result;
  };
  const results = await Promise.allSettled(
    meals.map(async (meal) =>
      offlineMealSnapshotSchema.parse({
        id: meal.id,
        name: meal.name,
        description: meal.description,
        notes: meal.notes,
        serving_size: meal.serving_size,
        serving_unit: meal.serving_unit,
        total_servings: meal.total_servings,
        foods: await leaves(meal, 1, new Set()),
      })
    )
  );
  return results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  );
}

export function offlineMealNutrition(meal: OfflineMealSnapshot) {
  const total = (key: 'calories' | 'protein' | 'carbs' | 'fat') =>
    meal.foods.reduce(
      (sum, food) => sum + (food[key] * food.quantity) / food.serving_size,
      0
    ) / meal.total_servings;
  return {
    calories: total('calories'),
    protein: total('protein'),
    carbs: total('carbs'),
    fat: total('fat'),
  };
}

export function offlineMealAsFood(meal: OfflineMealSnapshot): FoodItem {
  return {
    id: meal.id,
    name: meal.name,
    brand: null,
    is_custom: true,
    default_variant: {
      serving_size: meal.serving_size,
      serving_unit: meal.serving_unit,
      ...offlineMealNutrition(meal),
    },
  };
}
