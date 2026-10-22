import {
  buildDailyProgress,
  DEFAULT_DAILY_TRACKING_PREFERENCES,
  type Habit,
  type MedicationDetail,
} from '@workspace/shared';
import type { MealType } from '../src/types/mealTypes';
import { reviewFood, reviewVariants } from './nutritionFixture';
import type { FoodItem } from '../src/types/foods';
import { trackingReviewResponse } from './trackingFixture';

// Literal, labelled synthetic user content: never medication or routine advice.
export function nativeIntegrationResponse(
  url: URL,
  method: string,
  day: string,
  baseMealTypes: MealType[]
): unknown {
  if (method !== 'GET')
    throw new Error('Native integration fixture is read-only');
  const path = url.pathname;
  if (path === '/api/v2/tracking/habits') {
    const base = (trackingReviewResponse(path, 'populated', day) as Habit[])[1];
    return Array.from({ length: 12 }, (_, index): Habit => ({
      ...base,
      id: `review-long-habit-${String(index).padStart(2, '0')}`,
      name: `Synthetische Gewohnheit ${String(index + 1).padStart(2, '0')} – Ruhige Beweglichkeit und bewusste Pausen im langen Alltag`,
      description: 'Nur synthetische Layoutdaten, keine Empfehlung.',
      sort_order: index,
    }));
  }
  if (
    path === '/api/v2/tracking/habit-logs' ||
    path === '/api/v2/medications/entries'
  )
    return [];
  if (path === '/api/v2/medications') {
    const base = (
      trackingReviewResponse(path, 'populated', day) as MedicationDetail[]
    )[0];
    const schedule = base.schedules[0];
    return Array.from({ length: 16 }, (_, index): MedicationDetail => {
      const id = `review-long-supplement-${String(index).padStart(2, '0')}`;
      return {
        ...base,
        id,
        name: `Synthetisches Supplement ${String(index + 1).padStart(2, '0')} – Ausführliche Bezeichnung für die schmale Listenansicht`,
        schedules: [
          {
            ...schedule,
            id: `review-long-schedule-${String(index).padStart(2, '0')}`,
            medication_id: id,
          },
        ],
      };
    });
  }
  if (path.startsWith('/api/v2/tracking/daily-progress/')) {
    const read = (path: string) =>
      nativeIntegrationResponse(new URL(path, url), 'GET', day, baseMealTypes);
    const habits = read('/api/v2/tracking/habits') as Habit[];
    const supplements = read('/api/v2/medications') as MedicationDetail[];
    return buildDailyProgress({
      date: path.split('/').at(-1)!,
      preferences: DEFAULT_DAILY_TRACKING_PREFERENCES,
      goals: [],
      workouts: [],
      checkin: null,
      habits,
      habitLogs: [],
      measurementReminders: [],
      recordedMeasurements: {},
      supplementDoses: supplements.map((item) => ({
        schedule_id: item.schedules[0].id,
        medication_id: item.id,
        label: item.name,
        status: null,
        recorded_at: null,
      })),
      meals: [],
    });
  }
  if (path === '/api/meal-types')
    return [
      ...baseMealTypes,
      ...Array.from({ length: 12 }, (_, index): MealType => ({
        ...baseMealTypes[0],
        id: `review-long-meal-${String(index).padStart(2, '0')}`,
        user_id: 'review-user',
        name: `Synthetische Zielmahlzeit ${String(index + 1).padStart(2, '0')} – Lange Bezeichnung für die Auswahl`,
        sort_order: 30 + index,
      })),
    ];
  const foods: FoodItem[] = Array.from({ length: 12 }, (_, index) => ({
    ...reviewFood,
    id: `review-long-food-${index}`,
    name: `Synthetic suggested food ${String(index + 1).padStart(2, '0')} with a long descriptive name`,
    default_variant: {
      ...reviewFood.default_variant,
      id: `review-long-variant-${index}`,
    },
  }));
  if (path === '/api/foods')
    return { recentFoods: [reviewFood, ...foods], topFoods: [] };
  const variantFood = foods.find(
    (food) => food.id === url.searchParams.get('food_id')
  );
  if (path === '/api/foods/food-variants' && variantFood)
    return [
      {
        ...reviewVariants[0],
        ...variantFood.default_variant,
        food_id: variantFood.id,
      },
    ];
  const servingFood = foods.find(
    (food) => path === `/api/foods/${food.id}/last-serving`
  );
  if (servingFood) return null;
  const detailFood = foods.find((food) => path === `/api/foods/${food.id}`);
  if (detailFood) return detailFood;
  return undefined;
}
