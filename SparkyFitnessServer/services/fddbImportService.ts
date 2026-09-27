import type {
  FddbDiaryRow,
  FddbExtras,
  FddbImportResult,
} from '@workspace/shared';
import foodRepository from '../models/foodRepository.js';
import mealTypeRepository from '../models/mealType.js';
import mealService from './mealService.js';
import favoritesService from './favoritesService.js';
import {
  fddbSourceId,
  findUniqueOwnedFoodByName,
  importFddbWeight,
  hasImportedFddbRecipe,
  importFddbActivities,
  importFddbDiaryBatch,
} from '../models/fddbImportRepository.js';

const IMPORT_MEAL_TYPE = 'FDDB Import';

interface MealTypeRecord {
  id: string;
  name: string;
  user_id: string | null;
  sort_order: number;
}

const emptyResult = (): FddbImportResult => ({
  imported: 0,
  alreadyPresent: 0,
  unmatched: [],
  errors: [],
});

async function ensureImportMealType(userId: string): Promise<string> {
  const mealTypes = (await mealTypeRepository.getAllMealTypes(
    userId
  )) as MealTypeRecord[];
  const existing = mealTypes.find(
    (type) => type.user_id === userId && type.name === IMPORT_MEAL_TYPE
  );
  if (existing) return existing.id;
  const highestSortOrder = Math.max(
    0,
    ...mealTypes.map((type) => type.sort_order)
  );
  const created = (await mealTypeRepository.createMealType(
    { name: IMPORT_MEAL_TYPE, sort_order: highestSortOrder + 1 },
    userId
  )) as MealTypeRecord;
  return created.id;
}

export async function importFddbDiary(
  userId: string,
  actorId: string,
  rows: FddbDiaryRow[]
): Promise<FddbImportResult> {
  const mealTypeId = await ensureImportMealType(userId);
  const imported = await importFddbDiaryBatch(
    userId,
    actorId,
    mealTypeId,
    rows
  );
  return {
    imported,
    alreadyPresent: rows.length - imported,
  };
}

export interface FddbExtrasResult {
  customFoods: FddbImportResult;
  recipes: FddbImportResult;
  favorites: FddbImportResult;
  measurements: FddbImportResult;
  activities: FddbImportResult;
}

/** Import only the sections the user selected in the review UI. */
export async function importFddbExtras(
  userId: string,
  actorId: string,
  extras: FddbExtras
): Promise<FddbExtrasResult> {
  const result: FddbExtrasResult = {
    customFoods: emptyResult(),
    recipes: emptyResult(),
    favorites: emptyResult(),
    measurements: emptyResult(),
    activities: emptyResult(),
  };

  for (const food of extras.customFoods) {
    try {
      const sourceId = fddbSourceId(food.sourceKey);
      const existing = await foodRepository.findFoodByProviderExternalId(
        userId,
        sourceId,
        'fddb'
      );
      if (existing) {
        result.customFoods.alreadyPresent += 1;
        continue;
      }
      await foodRepository.createFood({
        user_id: userId,
        name: food.name,
        brand: food.brand || null,
        provider_type: 'fddb',
        provider_external_id: sourceId,
        provider_verified: false,
        is_custom: true,
        is_quick_food: false,
        shared_with_public: false,
        serving_size: 100,
        serving_unit: 'g',
        source: 'imported',
        notes: `Imported from FDDB. Original portion descriptions: ${food.portions}`,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        dietary_fiber: food.dietaryFiber,
        sugars: food.sugars,
        saturated_fat: food.saturatedFat,
        cholesterol: food.cholesterol,
        sodium: food.sodium,
        potassium: food.potassium,
        calcium: food.calcium,
        iron: food.iron,
        vitamin_c: food.vitaminC,
        caffeine_mg: food.caffeine,
        alcohol_g: food.alcoholG,
      });
      result.customFoods.imported += 1;
    } catch (error) {
      result.customFoods.errors?.push({
        item: food.name,
        message: error instanceof Error ? error.message : 'Import failed.',
      });
    }
  }

  for (const recipe of extras.recipes) {
    try {
      const sourceId = fddbSourceId(recipe.sourceKey);
      if (await hasImportedFddbRecipe(userId, actorId, sourceId)) {
        result.recipes.alreadyPresent += 1;
        continue;
      }
      await mealService.createMeal(userId, {
        user_id: userId,
        name: recipe.name,
        description:
          'FDDB recipe draft: ingredient links and nutrition need review.',
        notes: `FDDB import ${sourceId}\nUnlinked ingredients: ${recipe.ingredientsText}\nPreparation: ${recipe.preparationMinutes} min; cooking: ${recipe.cookingMinutes} min.`,
        is_public: false,
        serving_size: 1,
        serving_unit: 'serving',
        total_servings: recipe.servings,
        foods: [],
        images: [],
      });
      result.recipes.imported += 1;
    } catch (error) {
      result.recipes.errors?.push({
        item: recipe.name,
        message: error instanceof Error ? error.message : 'Import failed.',
      });
    }
  }

  if (extras.favorites.length > 0) {
    const existingFavorites = await favoritesService.getFavorites(userId);
    const existingIds = new Set<string>(
      (existingFavorites.favoriteFoods as Array<{ id: string }>).map(
        (food) => food.id
      )
    );
    for (const name of extras.favorites) {
      try {
        const id = await findUniqueOwnedFoodByName(userId, actorId, name);
        if (!id) {
          result.favorites.unmatched?.push(name);
          continue;
        }
        if (existingIds.has(id)) {
          result.favorites.alreadyPresent += 1;
          continue;
        }
        await favoritesService.addFavorite(userId, 'food', id);
        existingIds.add(id);
        result.favorites.imported += 1;
      } catch (error) {
        result.favorites.errors?.push({
          item: name,
          message: error instanceof Error ? error.message : 'Import failed.',
        });
      }
    }
  }

  for (const measurement of extras.measurements) {
    try {
      const inserted = await importFddbWeight(
        userId,
        actorId,
        measurement.date,
        measurement.weightKg
      );
      if (inserted) result.measurements.imported += 1;
      else result.measurements.alreadyPresent += 1;
    } catch (error) {
      result.measurements.errors?.push({
        item: measurement.date,
        message: error instanceof Error ? error.message : 'Import failed.',
      });
    }
  }

  if (extras.activities.length > 0) {
    const imported = await importFddbActivities(
      userId,
      actorId,
      extras.activities
    );
    result.activities.imported = imported;
    result.activities.alreadyPresent = extras.activities.length - imported;
  }
  return result;
}
