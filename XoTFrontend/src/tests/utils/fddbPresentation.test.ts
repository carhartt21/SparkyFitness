import { isFddbImportMeal, shouldShowDiaryMeal } from '@workspace/shared';
import { groupDashboardMeals } from '@/utils/dashboardSummary';
import type { FoodEntry } from '@/types/food';

jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

describe('FDDB diary presentation', () => {
  it('omits empty imports while preserving editable empty meals', () => {
    expect(shouldShowDiaryMeal('FDDB Import', 0)).toBe(false);
    expect(shouldShowDiaryMeal('Breakfast', 0)).toBe(true);
    expect(isFddbImportMeal(' fddb import ')).toBe(true);
  });

  it('keeps an imported zero-calorie entry visible and counts it once', () => {
    const entry = {
      id: 'import',
      meal_type: 'FDDB Import',
      quantity: 100,
      serving_size: 100,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      food_images: null,
      images: null,
    } as FoodEntry;
    expect(shouldShowDiaryMeal(entry.meal_type, 1)).toBe(true);
    expect(groupDashboardMeals([entry], [], ['FDDB Import'])).toEqual([
      { name: 'FDDB Import', calories: 0, itemCount: 1, image: null },
    ]);
    expect(groupDashboardMeals([], [], ['FDDB Import'])).toEqual([]);
  });
});
