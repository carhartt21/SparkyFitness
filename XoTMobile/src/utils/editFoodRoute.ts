import type { FoodInfoItem } from '../types/foodInfo';
import type { RootStackParamList } from '../types/navigation';
import {
  applyDisplayValuesToFoodInfo,
  type FoodDisplayValues,
} from './foodDetails';

type EditFoodParams = Extract<
  RootStackParamList['FoodForm'],
  { mode: 'edit-food' }
>;

const optional = (value: number | undefined): string =>
  value != null ? String(value) : '';

/**
 * Route params that open Edit Food (name, photo, serving sizes and the
 * nutrition values) for a saved food, from any screen that shows it.
 */
export function buildEditFoodParams({
  food,
  values,
  variantId,
  customNutrients,
  returnKey,
}: {
  food: FoodInfoItem;
  values: FoodDisplayValues;
  variantId: string;
  customNutrients?: Record<string, string | number> | null;
  returnKey: string;
}): EditFoodParams {
  return {
    mode: 'edit-food',
    item: applyDisplayValuesToFoodInfo(food, values, variantId),
    returnKey,
    foodId: food.id,
    variantId,
    customNutrients,
    initialValues: {
      name: food.name,
      brand: food.brand ?? '',
      notes: food.notes ?? '',
      servingSize: String(values.servingSize),
      servingUnit: values.servingUnit,
      calories: String(values.calories),
      protein: String(values.protein),
      carbs: String(values.carbs),
      fat: String(values.fat),
      fiber: optional(values.fiber),
      saturatedFat: optional(values.saturatedFat),
      sodium: optional(values.sodium),
      sugars: optional(values.sugars),
      transFat: optional(values.transFat),
      potassium: optional(values.potassium),
      calcium: optional(values.calcium),
      iron: optional(values.iron),
      caffeineMg: optional(values.caffeineMg),
      waterMl: optional(values.waterMl),
      alcoholG: optional(values.alcoholG),
      cholesterol: optional(values.cholesterol),
      vitaminA: optional(values.vitaminA),
      vitaminC: optional(values.vitaminC),
    },
  };
}
