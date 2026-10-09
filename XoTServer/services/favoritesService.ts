import {
  addDays,
  todayInZone,
  compareFavoritePopularity,
  FavoriteUsageFieldsSchema,
  type FavoriteUsageFields,
} from '@workspace/shared';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { getFavoriteUsage } from '../models/favoriteUsage.js';
import foodCoreService from './foodCoreService.js';
import foodRepository from '../models/foodRepository.js';
import mealRepository from '../models/mealRepository.js';

interface Favorite extends Record<string, unknown> {
  id: string;
  favorited_at?: string;
}
async function getFavorites(authenticatedUserId: string) {
  const timezone = await loadUserTimezone(authenticatedUserId);
  const today = todayInZone(timezone);
  const [foods, meals, usage] = await Promise.all([
    foodRepository.getFavoriteFoods(authenticatedUserId) as Promise<Favorite[]>,
    mealRepository.getFavoriteMeals(authenticatedUserId) as Promise<Favorite[]>,
    getFavoriteUsage(authenticatedUserId, addDays(today, -27), today, timezone),
  ]);
  const metadata = new Map(
    usage.map((row) => [
      `${row.kind}:${row.id}`,
      FavoriteUsageFieldsSchema.parse({
        usage_count_28d: row.usage_count_28d,
        last_used_at: row.last_used_at?.toISOString() ?? null,
      }),
    ])
  );
  const ranked = (
    items: Favorite[],
    kind: 'food' | 'meal'
  ): Array<Favorite & FavoriteUsageFields> =>
    items
      .map((item) => ({
        ...item,
        ...(metadata.get(`${kind}:${item.id}`) ?? {
          usage_count_28d: 0,
          last_used_at: null,
        }),
      }))
      .sort(compareFavoritePopularity);
  return {
    favoriteFoods: ranked(foods, 'food'),
    favoriteMeals: ranked(meals, 'meal'),
  };
}

async function addFavorite(
  authenticatedUserId: string,
  type: string,
  id: string
) {
  if (type === 'food') {
    // foodCoreService.addFoodFavorite verifies access before inserting.
    await foodCoreService.addFoodFavorite(authenticatedUserId, id);
    return { type: 'food', id, is_favorite: true };
  }
  if (type === 'meal') {
    // getMealById is RLS-scoped, so a null result means the meal is not
    // accessible to this user (mirrors the food access check).
    const meal = await mealRepository.getMealById(id, authenticatedUserId);
    if (!meal) {
      throw new Error('Meal not found.');
    }
    await mealRepository.addMealFavorite(authenticatedUserId, id);
    return { type: 'meal', id, is_favorite: true };
  }
  throw new Error('Invalid favorite type.');
}

async function removeFavorite(
  authenticatedUserId: string,
  type: string,
  id: string
) {
  if (type === 'food') {
    await foodCoreService.removeFoodFavorite(authenticatedUserId, id);
    return { type: 'food', id, is_favorite: false };
  }
  if (type === 'meal') {
    await mealRepository.removeMealFavorite(authenticatedUserId, id);
    return { type: 'meal', id, is_favorite: false };
  }
  throw new Error('Invalid favorite type.');
}

export { getFavorites, addFavorite, removeFavorite };
export default { getFavorites, addFavorite, removeFavorite };
