import type { TFunction } from 'i18next';
import { getMealTypeDisplayLabel } from '../../src/utils/mealNutrition';
import type { FoodItem, FoodVariantDetail } from '../../src/types/foods';
import { nativeIntegrationResponse } from '../../review/nativeIntegrationFixture';
import { createNutritionFixture } from '../../review/nutritionFixture';
import type { DailyProgress, Habit, MedicationDetail } from '@workspace/shared';
import type { MealType } from '../../src/types/mealTypes';
const url = (path: string) => new URL(`https://ui-review.invalid${path}`);
const fixture = createNutritionFixture('v38-review');
const meals = fixture.respond(url('/api/meal-types'), 'GET') as MealType[];
const respond = (path: string, method = 'GET') =>
  nativeIntegrationResponse(url(path), method, '2026-10-22', meals);
describe('read-only native integration fixtures', () => {
  it('provides unique populated long lists with literal labelled synthetic content', () => {
    const habits = respond('/api/v2/tracking/habits') as Habit[];
    const supplements = respond('/api/v2/medications') as MedicationDetail[];
    const targets = respond('/api/meal-types') as MealType[];
    expect(habits).toHaveLength(12);
    expect(supplements).toHaveLength(16);
    expect(targets).toHaveLength(meals.length + 12);
    for (const rows of [habits, supplements, targets])
      expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(
      supplements.every(
        (row) =>
          row.schedules.length === 1 &&
          row.schedules[0].medication_id === row.id
      )
    ).toBe(true);
    expect(habits[11].name).toContain('Synthetische Gewohnheit 12');
    expect(respond('/api/v2/tracking/habit-logs')).toEqual([]);
    expect(respond('/api/v2/medications/entries')).toEqual([]);
  });
  it('projects the same populated references on the dashboard selected day', () => {
    const progress = respond(
      '/api/v2/tracking/daily-progress/2026-10-20'
    ) as DailyProgress;
    expect(progress.date).toBe('2026-10-20');
    expect(
      progress.items.filter((item) => item.domain === 'habit')
    ).toHaveLength(12);
    expect(
      progress.items.filter((item) => item.domain === 'supplement')
    ).toHaveLength(16);
  });
  it('hydrates every new suggestion with its own variants and unknown last serving', () => {
    const foods = (respond('/api/foods') as { recentFoods: FoodItem[] })
      .recentFoods;
    expect(foods).toHaveLength(13);
    for (const food of foods.slice(1)) {
      const variants = respond(
        `/api/foods/food-variants?food_id=${food.id}`
      ) as FoodVariantDetail[];
      expect(variants).toHaveLength(1);
      expect(variants[0]).toMatchObject({
        food_id: food.id,
        id: food.default_variant.id,
      });
      expect(respond(`/api/foods/${food.id}/last-serving`)).toBeNull();
      expect(respond(`/api/foods/${food.id}`)).toEqual(food);
    }
    expect(respond('/api/foods/food-variants?food_id=unknown')).toBeUndefined();
  });
  it('marks synthetic custom meal targets as user-owned so their literal labels survive', () => {
    const targets = (respond('/api/meal-types') as MealType[]).slice(
      meals.length
    );
    const translate = jest.fn(() => 'SYSTEM_FALLBACK') as unknown as TFunction;
    expect(
      targets.map((target) => getMealTypeDisplayLabel(target, translate))
    ).toEqual(targets.map((target) => target.name));
    expect(targets.every((target) => target.user_id === 'review-user')).toBe(
      true
    );
    expect(translate).not.toHaveBeenCalled();
  });
  it('refuses every mutation and leaves the underlying nutrition snapshot unchanged', () => {
    const before = fixture.snapshot();
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      for (const path of [
        '/api/food-entries/bulk-action',
        '/api/v2/tracking/habits/x/logs',
        '/api/v2/medications/entries',
      ])
        expect(() => respond(path, method)).toThrow('read-only');
    expect(fixture.snapshot()).toEqual(before);
    expect(respond('/unhandled')).toBeUndefined();
  });
  it('does not share editable fixture results or silently hide the original meal targets', () => {
    const first = respond('/api/v2/tracking/habits') as Habit[];
    first[0].name = 'edited';
    expect((respond('/api/v2/tracking/habits') as Habit[])[0].name).not.toBe(
      'edited'
    );
    expect(
      (respond('/api/meal-types') as MealType[]).slice(0, meals.length)
    ).toEqual(meals);
  });
});
