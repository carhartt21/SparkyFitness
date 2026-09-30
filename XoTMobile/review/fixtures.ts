import type { DailySummaryApiResponse } from '../src/services/api/dailySummaryApi';
import { trackingReviewResponse } from './trackingFixture';

export const reviewDate = '2026-09-26';
export const summaryFixture: DailySummaryApiResponse = {
  goals: {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 67,
    dietary_fiber: 25,
    water_goal_ml: 2500,
  },
  foodEntries: [
    {
      id: 'review-breakfast',
      food_name: 'Oat bowl with berries',
      meal_type: 'breakfast',
      meal_type_id: 'review-breakfast-type',
      quantity: 1,
      unit: 'serving',
      serving_size: 1,
      serving_unit: 'serving',
      entry_date: reviewDate,
      entry_time: '08:30',
      calories: 600,
      protein: 30,
      carbs: 80,
      fat: 18,
      dietary_fiber: 8,
    },
  ],
  exerciseSessions: [],
  waterIntake: 1000,
  stepCalories: 0,
  calorieBalance: {
    eaten: 600,
    burned: 0,
    remaining: 1400,
    goal: 2000,
    net: 600,
    progress: 30,
    bmr: 0,
    bmrSource: 'formula',
    exerciseSource: 'none',
    tdeeProjection: null,
  },
};

// Explicit routes: an unknown request fails rather than escaping to a live server.
export function reviewResponse(path: string, scenario: string): unknown {
  if (
    [
      '/api/announcement/current',
      '/api/v2/cycle/settings',
      '/api/fasting/current',
    ].includes(path)
  )
    return null;
  if (path === '/api/foods') return { recentFoods: [], topFoods: [] };
  if (path === '/api/favorites')
    return { favoriteFoods: [], favoriteMeals: [] };
  if (
    ['/api/meals/recent', '/api/meals/top', '/api/external-providers'].includes(
      path
    ) ||
    /^\/api\/v2\/measurements\/water-intake\/[^/]+\/log$/.test(path)
  )
    return [];
  if (path === '/api/meal-types')
    return [
      {
        id: 'review-breakfast-type',
        name: 'breakfast',
        user_id: null,
        sort_order: 0,
        is_visible: true,
        show_in_quick_log: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
  if (path === '/api/identity/user')
    return {
      userId: 'review-user',
      authenticatedUserId: 'review-user',
      activeUserId: 'review-user',
      role: 'user',
    };
  if (path === '/api/user-preferences')
    return {
      timezone: 'Europe/Berlin',
      energy_unit: 'kcal',
      water_display_unit: 'ml',
      default_weight_unit: 'kg',
      include_bmr_in_net_calories: false,
    };
  if (path === '/api/daily-summary') {
    if (scenario === 'empty')
      return {
        ...summaryFixture,
        foodEntries: [],
        waterIntake: 0,
        calorieBalance: {
          ...summaryFixture.calorieBalance,
          eaten: 0,
          burned: 0,
          net: 0,
          remaining: 2000,
          progress: 0,
        },
      };
    if (scenario === 'over-target')
      return {
        ...summaryFixture,
        foodEntries: summaryFixture.foodEntries.map((entry) => ({
          ...entry,
          calories: 2300,
        })),
        calorieBalance: {
          ...summaryFixture.calorieBalance,
          eaten: 2300,
          net: 2300,
          remaining: -300,
          progress: 115,
        },
      };
    return summaryFixture;
  }
  if (path === '/api/identity/profiles')
    return { id: 'review-user', full_name: 'Review Account' };
  if (path === '/api/water-containers')
    return scenario === 'hydration-options'
      ? [
          {
            id: 1,
            name: 'Glass',
            volume: 250,
            unit: 'ml',
            is_primary: true,
            servings_per_container: 1,
          },
          {
            id: 2,
            name: 'Bottle',
            volume: 500,
            unit: 'ml',
            is_primary: false,
            servings_per_container: 1,
          },
          {
            id: 3,
            name: 'Energy Drink',
            volume: 250,
            unit: 'ml',
            is_primary: false,
            servings_per_container: 1,
            is_quick_add: true,
            linked_food_id: 'review-drink',
            linked_food_name: 'Energy Drink',
            linked_quantity: 250,
            linked_variant_serving_unit: 'ml',
          },
        ]
      : [];
  if (path === '/api/v2/nutrition/caffeine/active')
    return { active_mg: 0, events: [], series: [] };
  if (
    [
      '/api/custom-nutrients',
      '/api/preferences/nutrient-display',
      '/api/food-entry-meals',
      '/api/water-containers/presets',
      '/api/measurements/custom-categories',
    ].includes(path)
  )
    return [];
  const tracking = trackingReviewResponse(path, scenario, localToday());
  if (tracking !== undefined) return tracking;
  // Library (More tab) reads for the screen tour: an empty synthetic library.
  if (['/api/meals', '/api/meal-plan-templates'].includes(path)) return [];
  if (path === '/api/exercises/' || path === '/api/exercises')
    return { exercises: [], totalCount: 0 };
  if (path === '/api/exercises/suggested')
    return { recentExercises: [], topExercises: [] };
  if (path === '/api/reports/mini-nutrition-trends')
    return syntheticNutritionTrend();
  if (path.startsWith('/api/measurements/check-in-measurements-range/'))
    return syntheticWeightRange();
  if (path.startsWith('/api/measurements/water-intake-range/')) return [];
  // Calendar photo markers and active workout plans: none in the fixture.
  if (path === '/api/measurements/check-in-photos/dates') return [];
  if (path.startsWith('/api/workout-plan-templates/active/')) return [];
  throw new Error(`Unconfigured review endpoint: ${path}`);
}

/** The simulator's calendar day; tracking screens open on the real today. */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function reviewDayOffset(offset: number): string {
  const day = new Date(`${reviewDate}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

/** Deterministic synthetic intake for the Insights tour; every fourth day is unlogged. */
function syntheticNutritionTrend() {
  return Array.from({ length: 90 }, (_, offset) => offset)
    .filter((offset) => offset % 4 !== 3)
    .map((offset) => ({
      date: reviewDayOffset(offset),
      calories: 1700 + ((offset * 137) % 700),
      protein: 110 + ((offset * 7) % 40),
      carbs: 190 + ((offset * 11) % 80),
      fat: 55 + ((offset * 5) % 25),
      dietary_fiber: 20 + (offset % 10),
    }));
}

/** Synthetic weekly weigh-ins, drifting down by 0.2 kg per week. */
function syntheticWeightRange() {
  return Array.from({ length: 13 }, (_, week) => ({
    entry_date: reviewDayOffset(week * 7),
    weight: 78 + week * 0.2,
    steps: null,
  }));
}
