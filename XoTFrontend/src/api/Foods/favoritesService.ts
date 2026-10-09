import { FavoriteUsageFieldsSchema } from '@workspace/shared';
import { apiCall } from '../api';

import type { Food } from '@/types/food';
import type { Meal } from '@/types/meal';

export type FavoriteType = 'food' | 'meal';

export interface FavoritesResponse {
  favoriteFoods: Food[];
  favoriteMeals: Meal[];
}

export interface FavoriteToggleResponse {
  type: FavoriteType;
  id: string;
  is_favorite: boolean;
}

export const getFavorites = async (): Promise<FavoritesResponse> => {
  const response: FavoritesResponse = await apiCall('/favorites', {
    method: 'GET',
  });
  return {
    favoriteFoods: response.favoriteFoods.map((food) => ({
      ...food,
      ...FavoriteUsageFieldsSchema.parse(food),
    })),
    favoriteMeals: response.favoriteMeals.map((meal) => ({
      ...meal,
      ...FavoriteUsageFieldsSchema.parse(meal),
    })),
  };
};

export const addFavorite = async (
  type: FavoriteType,
  id: string
): Promise<FavoriteToggleResponse> => {
  return apiCall(`/favorites/${type}/${id}`, {
    method: 'POST',
  });
};

export const removeFavorite = async (
  type: FavoriteType,
  id: string
): Promise<FavoriteToggleResponse> => {
  return apiCall(`/favorites/${type}/${id}`, {
    method: 'DELETE',
  });
};
