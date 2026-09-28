jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { t: (key: string, defaultValue?: string) => defaultValue || key },
}));

import {
  groupDashboardMeals,
  summarizeActivity,
} from '@/utils/dashboardSummary';
import type { FoodEntry } from '@/types/food';
import type { DailySummaryResponse } from '@workspace/shared';

type Session = DailySummaryResponse['exerciseSessions'][number];

const individual = (overrides: Record<string, unknown>): Session =>
  ({
    type: 'individual',
    id: 'i',
    name: 'Walk',
    duration_minutes: 20,
    calories_burned: 100,
    entry_time: '08:00:00',
    exercise_snapshot: null,
    ...overrides,
  }) as unknown as Session;

describe('summarizeActivity', () => {
  it('sums sessions, lists workouts newest first and keeps device totals out of the list', () => {
    const result = summarizeActivity([
      individual({ id: 'walk', name: 'Walk', entry_time: '07:00:00' }),
      individual({
        id: 'device',
        name: 'Active Calories',
        duration_minutes: 0,
        calories_burned: 300,
      }),
      {
        type: 'preset',
        id: 'pull',
        name: 'Pull workout',
        total_duration_minutes: 40,
        exercises: [
          { calories_burned: 120, entry_time: '17:00:00' },
          { calories_burned: 80, entry_time: '17:20:00' },
        ],
      } as unknown as Session,
    ]);

    expect(result.minutes).toBe(60);
    expect(result.calories).toBe(600);
    expect(result.workouts).toBe(2);
    expect(result.recent.map((item) => item.id)).toEqual(['pull', 'walk']);
    expect(result.recent[0]?.calories).toBe(200);
  });

  it('returns zeros without sessions', () => {
    expect(summarizeActivity(undefined)).toEqual({
      minutes: 0,
      calories: 0,
      workouts: 0,
      recent: [],
    });
  });
});

describe('groupDashboardMeals', () => {
  const entry = (overrides: Partial<FoodEntry>): FoodEntry =>
    ({
      id: 'e',
      meal_type: 'breakfast',
      quantity: 100,
      serving_size: 100,
      calories: 200,
      protein: 10,
      carbs: 20,
      fat: 5,
      images: null,
      food_images: null,
      ...overrides,
    }) as FoodEntry;

  it('groups logged entries by meal in meal-type order with calories and a photo', () => {
    const meals = groupDashboardMeals(
      [
        entry({ id: 'a', meal_type: 'Dinner', calories: 300 }),
        entry({
          id: 'b',
          meal_type: 'breakfast',
          food_images: ['https://example.test/oats.jpg'],
        }),
        entry({ id: 'c', meal_type: 'breakfast', calories: 100 }),
      ],
      [],
      ['breakfast', 'lunch', 'dinner']
    );

    expect(meals.map((meal) => meal.name)).toEqual(['breakfast', 'Dinner']);
    expect(meals[0]).toMatchObject({
      calories: 300,
      itemCount: 2,
      image: 'https://example.test/oats.jpg',
    });
    expect(meals[1]).toMatchObject({ calories: 300, image: null });
  });

  it('omits meal types with nothing logged', () => {
    expect(groupDashboardMeals([], [], ['breakfast'])).toEqual([]);
  });
});
