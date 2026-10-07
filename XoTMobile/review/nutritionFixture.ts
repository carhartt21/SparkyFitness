import {
  trackingProgressRange,
  trackingReviewResponse,
} from './trackingFixture';
import {
  containerWaterActionBodySchema,
  type WaterIntakeLogEntry,
  type MealTrackingStatus,
  setMealDayStatusRequestSchema,
} from '@workspace/shared';
import type { FoodItem, FoodVariantDetail } from '../src/types/foods';
import type { FoodEntry } from '../src/types/foodEntries';
import type {
  CreateFoodEntryPayload,
  UpdateFoodEntryPayload,
} from '../src/services/api/foodEntriesApi';
import {
  reviewDate as historicalReviewDate,
  reviewResponse,
  summaryFixture,
} from './fixtures';

export const reviewFood: FoodItem = {
  id: 'review-food',
  name: 'Review yogurt with berries and toasted pumpkin seeds',
  brand: 'Synthetic kitchen',
  is_custom: true,
  user_id: 'review-user',
  default_variant: {
    id: 'review-variant',
    serving_size: 100,
    serving_unit: 'g',
    calories: 150,
    protein: 10,
    carbs: 15,
    fat: 5,
    dietary_fiber: 2,
    monounsaturated_fat: 0.125,
    polyunsaturated_fat: 0,
    iron: 0.04,
    custom_nutrients: { Magnesium: 0.25, 'Vitamin B12': '<LOD' },
  },
};

// Saved portions of the review food (synthetic; values derived from 100 g).
export const reviewVariants: FoodVariantDetail[] = [
  {
    ...reviewFood.default_variant,
    id: 'review-variant',
    food_id: reviewFood.id,
    metric_amount: 100,
    metric_unit: 'g' as const,
    is_default: true,
    sort_order: 0,
  },
  {
    id: 'review-variant-medium',
    food_id: reviewFood.id,
    serving_label: 'Medium pot',
    serving_size: 1,
    serving_unit: 'piece',
    metric_amount: 130,
    metric_unit: 'g' as const,
    calories: 195,
    protein: 13,
    carbs: 19.5,
    fat: 6.5,
    dietary_fiber: 2.6,
    is_default: false,
    sort_order: 1,
  },
  {
    id: 'review-variant-cup',
    food_id: reviewFood.id,
    serving_size: 1,
    serving_unit: 'cup',
    metric_amount: 245,
    metric_unit: 'g' as const,
    calories: 367.5,
    protein: 24.5,
    carbs: 36.75,
    fat: 12.25,
    dietary_fiber: 4.9,
    is_default: false,
    sort_order: 2,
  },
  {
    id: 'review-variant-off-shaped-portion',
    food_id: reviewFood.id,
    serving_size: 1,
    serving_unit: 'serving (21.5 g)',
    metric_amount: 21.5,
    metric_unit: 'g' as const,
    calories: 32.25,
    protein: 2.15,
    carbs: 3.225,
    fat: 1.075,
    dietary_fiber: 0.43,
    is_default: false,
    sort_order: 3,
  },
];

import { getTodayDate } from '../src/utils/dateUtils';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** In-memory simulator fixture. Never imports a network or persistence client. */
export function createNutritionFixture(
  scenario: string,
  legacyPortions = false,
  diaryRefinement = false
) {
  // Empty planned meals only exist on current/future days in production.
  // Use today for this isolated interaction fixture, not a historic default.
  const reviewDate = diaryRefinement ? getTodayDate() : historicalReviewDate;
  const food: FoodItem = legacyPortions
    ? {
        ...reviewFood,
        is_custom: false,
        provider_type: 'openfoodfacts',
        provider_external_id: 'synthetic-review-provider',
      }
    : reviewFood;
  const variants: FoodVariantDetail[] = clone(
    legacyPortions ? [reviewVariants[0]] : reviewVariants
  );
  const baseSummary = reviewResponse(
    '/api/daily-summary',
    scenario
  ) as typeof summaryFixture;
  let entries: FoodEntry[] = clone(baseSummary.foodEntries);
  if (diaryRefinement)
    entries = entries.map((entry) => ({ ...entry, entry_date: reviewDate }));
  let nextId = 1;
  const mealTypes = [
    ...(reviewResponse('/api/meal-types', scenario) as object[]),
    {
      id: 'review-custom-meal',
      name: 'Synthetic snack',
      user_id: 'review-user',
      sort_order: 20,
      is_visible: true,
      show_in_quick_log: false,
      created_at: '2026-01-01T00:00:00Z',
      icon_key: null as string | null,
    },
  ];
  let waterMl = scenario === 'empty' ? 0 : summaryFixture.waterIntake;
  const waterLog: WaterIntakeLogEntry[] = [];
  const waterOperations = new Set<string>();

  // This scenario exercises the real meal-status hooks without a real account.
  // Kept per selected day, so navigation cannot leak status across dates.
  const mealDays = new Map<string, MealTrackingStatus>();
  const lunchId = 'b3333333-3333-4333-8333-333333333333';
  const mealDay = (date: string): MealTrackingStatus => {
    let day = mealDays.get(date);
    if (!day) {
      day = {
        entry_date: date,
        meals: [
          {
            meal_type_id: lunchId,
            name: 'lunch',
            state: 'pending',
            logged_item_count: 0,
            updated_at: null,
          },
        ],
        coverage: {
          total: 1,
          resolved: 0,
          complete: 0,
          skipped: 0,
          incomplete: 0,
          pending: 1,
        },
      };
      mealDays.set(date, day);
    }
    return day;
  };

  if (diaryRefinement)
    mealTypes.push({
      id: lunchId,
      name: 'lunch',
      user_id: null,
      sort_order: 1,
      is_visible: true,
      show_in_quick_log: true,
      created_at: '2026-01-01T00:00:00Z',
      default_time: '12:30',
    });
  const snapshot = () => clone(entries);
  return {
    snapshot,
    respond(url: URL, method: string, body?: string): unknown {
      if (url.origin !== 'https://ui-review.invalid')
        throw new Error('Review blocked network origin');
      const path = url.pathname.replace(/\/$/, '');
      if (diaryRefinement) {
        if (
          method === 'GET' &&
          path.startsWith('/api/v2/tracking/meal-status/')
        )
          return clone(mealDay(path.split('/').at(-1)!));
        if (method === 'PUT' && path === '/api/v2/tracking/meal-status') {
          const data = setMealDayStatusRequestSchema.parse(
            JSON.parse(body ?? '{}')
          );
          if (data.meal_type_id !== lunchId)
            throw new Error('Unknown review meal');
          const day = mealDay(data.entry_date);
          day.meals[0].state = data.status ?? 'pending';
          return clone(day);
        }
        if (method === 'POST' && path === '/api/food-entries/bulk-action') {
          const data = JSON.parse(
            body ?? '{}'
          ) as import('../src/services/api/foodEntriesApi').BulkFoodEntryAction;
          if (
            data.action !== 'move' ||
            data.sourceDate !== reviewDate ||
            data.targetDate !== reviewDate ||
            data.targetMealTypeId !== lunchId ||
            data.ids.length !== 1 ||
            data.ids[0] !== 'review-breakfast'
          )
            throw new Error('Unexpected synthetic bulk move');
          entries = entries.map((entry) =>
            data.ids.includes(entry.id)
              ? { ...entry, meal_type_id: lunchId, meal_type: 'lunch' }
              : entry
          );
          return { count: 1 };
        }
      }
      if (scenario === 'v38-review') {
        if (method === 'GET' && path.startsWith('/api/v2/tracking/')) {
          const response = trackingReviewResponse(
            path,
            'populated',
            reviewDate
          );
          if (response !== undefined) return clone(response);
        }
        if (method === 'GET' && path === '/api/custom-nutrients')
          return [
            { id: 'review-magnesium', name: 'Magnesium', unit: 'mg' },
            { id: 'review-b12', name: 'Vitamin B12', unit: 'µg' },
          ];
        if (method === 'GET' && path === '/api/meal-types')
          return clone(mealTypes);
        if (method === 'PUT' && path === '/api/meal-types/review-custom-meal') {
          const update = JSON.parse(body ?? '{}') as {
            icon_key?: string | null;
          };
          const meal = mealTypes[1] as { icon_key: string | null };
          if ('icon_key' in update) meal.icon_key = update.icon_key ?? null;
          return clone(mealTypes[1]);
        }
      }
      if (scenario === 'meal-status') {
        if (method === 'PUT' && path === '/api/v2/tracking/meal-status') {
          const data = setMealDayStatusRequestSchema.parse(
            JSON.parse(body ?? '{}')
          );
          if (data.meal_type_id !== lunchId)
            throw new Error('Unknown review meal');
          const day = mealDay(data.entry_date);
          day.meals[0].state = data.status ?? 'pending';
          day.meals[0].updated_at = data.status
            ? `${data.entry_date}T12:00:00Z`
            : null;
          const state = day.meals[0].state;
          day.coverage = {
            total: 1,
            resolved: state === 'pending' ? 0 : 1,
            complete: state === 'complete' ? 1 : 0,
            skipped: state === 'skipped' ? 1 : 0,
            incomplete: state === 'incomplete' ? 1 : 0,
            pending: state === 'pending' ? 1 : 0,
          };
          return JSON.parse(JSON.stringify(day));
        }
        if (method === 'GET' && path === '/api/meal-types')
          return [
            ...(reviewResponse(path, scenario) as object[]),
            {
              id: lunchId,
              name: 'lunch',
              user_id: null,
              sort_order: 1,
              is_visible: true,
              show_in_quick_log: true,
              created_at: '2026-01-01T00:00:00Z',
            },
          ];
        if (method === 'GET' && path.startsWith('/api/v2/tracking/')) {
          const date = path.split('/').at(-1)!;
          const response = trackingReviewResponse(
            path,
            scenario,
            reviewDate,
            mealDay(date)
          );
          if (response !== undefined)
            return JSON.parse(JSON.stringify(response));
        }
      }
      if (method === 'GET' && path === '/api/v2/mobility')
        return {
          routines: [],
          schedules: [],
          plans: [],
          sessions: [],
          timezone: 'Europe/Berlin',
        };
      if (method === 'GET' && path === '/api/v2/engagement/status')
        return {
          revision: 0,
          remote_enabled: false,
          daily_limit: 3,
          daily_used: 0,
          devices: [],
          occurrences: [],
          diagnostics: [],
        };
      if (method === 'GET' && path === '/api/v2/engagement/settings')
        return {
          ...(url.searchParams.get('version') === '2'
            ? {
                schema_version: 2,
                schedule_initialized: true,
                daily_limit: 3,
                hydration_interval_hours: 2,
                hydration_start: '08:00',
                hydration_end: '22:00',
                meal_capture_start: '11:00',
                meal_capture_end: '14:00',
                meal_capture_time: '12:30',
                meal_review_time: '20:00',
                movement_break_time: '15:00',
              }
            : {}),
          revision: 0,
          remote_enabled: false,
          quiet_start: '22:00',
          quiet_end: '08:00',
          hydration_enabled: false,
          meal_capture_enabled: false,
          meal_review_enabled: false,
          movement_break_enabled: false,
          mobility_enabled: false,
        };
      if (
        method === 'POST' &&
        path === '/api/user-preferences/bootstrap-timezone'
      )
        return { timezone: 'Europe/Berlin' };
      if (
        method === 'POST' &&
        path === '/api/v2/measurements/water-intake/container-actions'
      ) {
        const payload = containerWaterActionBodySchema.parse(
          JSON.parse(body ?? '{}')
        );
        if (
          !['hydration-options', 'v38-review'].includes(scenario) ||
          payload.container_id !== 1 ||
          payload.entry_date !== reviewDate
        )
          throw new Error('Unconfigured container water write');
        const alreadyApplied = waterOperations.has(payload.client_operation_id);
        if (!alreadyApplied) {
          waterOperations.add(payload.client_operation_id);
          waterMl += 250;
          waterLog.push({
            id: payload.client_operation_id,
            user_id: 'review-user',
            entry_date: reviewDate,
            water_ml: 250,
            container_id: 1,
            container_name: 'Glass',
            source: 'manual',
            created_at: payload.logged_at,
            logged_at: payload.logged_at,
          });
        }
        return {
          waterLogId: payload.client_operation_id,
          foodEntryId: null,
          waterMl: 250,
          alreadyApplied,
          totals: { water_ml: waterMl },
        };
      }
      if (method === 'POST' && path === '/api/measurements/water-intake') {
        const payload = JSON.parse(body ?? '{}') as {
          entry_date: string;
          change_drinks: number;
          container_id: number;
        };
        if (
          payload.entry_date !== reviewDate ||
          payload.change_drinks !== 1 ||
          payload.container_id !== -1
        )
          throw new Error('Unconfigured water write');
        waterMl += 250;
        waterLog.push({
          id: `review-water-${waterLog.length + 1}`,
          user_id: 'review-user',
          entry_date: reviewDate,
          water_ml: 250,
          container_id: null,
          container_name: null,
          source: 'manual',
          created_at: `${reviewDate}T08:00:00Z`,
          logged_at: `${reviewDate}T08:00:00Z`,
        });
        return { water_ml: waterMl };
      }
      if (
        legacyPortions &&
        method === 'GET' &&
        path === '/api/v2/foods/details/openfoodfacts/synthetic-review-provider'
      ) {
        return { ...food, variants: [reviewVariants[0], reviewVariants[3]] };
      }
      if (
        legacyPortions &&
        method === 'POST' &&
        path === '/api/foods/food-variants'
      ) {
        const payload = JSON.parse(
          body ?? '{}'
        ) as import('../src/services/api/foodsApi').CreateFoodVariantPayload;
        if (
          payload.food_id !== food.id ||
          payload.source !== 'imported' ||
          payload.metric_amount !== 21.5 ||
          payload.metric_unit !== 'g'
        )
          throw new Error('Unexpected synthetic provider portion');
        const created: FoodVariantDetail = {
          ...payload,
          id: 'review-refreshed-portion',
        };
        variants.push(created);
        return created;
      }
      if (method === 'GET') {
        if (
          /^\/api\/v2\/measurements\/water-intake\/[^/]+\/details$/.test(path)
        ) {
          const base = {
            entry_date: reviewDate,
            source: 'manual',
            water_entry_id: null,
            food_entry_id: null,
            medication_id: null,
            amount_basis: 'recorded' as const,
            counts_toward_goal: true,
          };
          return {
            date: reviewDate,
            timezone: 'Europe/Berlin',
            totals: {
              water_ml: waterMl,
              manual_ml: waterMl - 750,
              ledger_ml: waterMl - 750,
              food_ml: 750,
              drink_ml: 250,
              supplement_ml: 500,
              solid_food_ml: 160,
              unknown_count: 1,
            },
            entries: [
              {
                ...base,
                id: 'review-water',
                kind: 'water',
                name: 'Glass',
                water_ml: waterMl - 750,
                logged_at: `${reviewDate}T08:00:00Z`,
                water_entry_id: 'review-water',
              },
              {
                ...base,
                id: 'review-drink',
                kind: 'drink',
                name: 'Energy Drink',
                water_ml: 250,
                logged_at: `${reviewDate}T10:00:00Z`,
                food_entry_id: 'review-drink',
              },
              {
                ...base,
                id: 'review-supplement',
                kind: 'supplement',
                name: 'Elektrolyte',
                water_ml: 500,
                logged_at: `${reviewDate}T11:00:00Z`,
                medication_id: 'review-supplement',
              },
              {
                ...base,
                id: 'review-food',
                kind: 'food',
                name: 'Apfel',
                water_ml: 160,
                logged_at: `${reviewDate}T09:00:00Z`,
                food_entry_id: 'review-food',
                counts_toward_goal: false,
              },
              {
                ...base,
                id: 'review-unknown',
                kind: 'food',
                name: 'Unbekannter Wassergehalt',
                water_ml: null,
                logged_at: null,
                amount_basis: 'unknown',
                counts_toward_goal: false,
              },
            ],
          };
        }

        if (path === `/api/v2/measurements/water-intake/${reviewDate}/log`)
          return waterLog.map((entry) => ({ ...entry }));
        if (path === '/api/exercise-stats/review') {
          const bucket = {
            sessions: 0,
            exerciseEntries: 0,
            distanceMeters: 0,
            durationMinutes: 0,
            liftedVolumeKg: 0,
            reps: 0,
            inferredEntries: 0,
          };
          const period = (startDate: string, endDate: string) => ({
            startDate,
            endDate,
            overall: bucket,
            running: bucket,
            cycling: bucket,
            strength: bucket,
            other: bucket,
          });
          const current = period(
            url.searchParams.get('startDate')!,
            url.searchParams.get('endDate')!
          );
          const previous = period(
            url.searchParams.get('previousStartDate')!,
            url.searchParams.get('previousEndDate')!
          );
          const adherence = {
            elapsedDays: 1,
            coveredDays: 0,
            eligibleScheduledSessions: 0,
            attendedScheduledSessions: 0,
            adherencePercent: null,
          };
          return {
            current,
            previous,
            trend: [],
            sources: [],
            adherence: {
              current: {
                ...adherence,
                startDate: current.startDate,
                endDate: current.endDate,
              },
              previous: {
                ...adherence,
                startDate: previous.startDate,
                endDate: previous.endDate,
              },
            },
          };
        }

        if (method === 'GET' && path === '/api/v2/tracking/daily-progress') {
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          return trackingProgressRange(
            url.searchParams.get('start_date') ?? today,
            url.searchParams.get('end_date') ?? today,
            today
          );
        }
        if (path === '/api/goals/for-date') return baseSummary.goals;
        if (path === '/api/workout-presets') return { presets: [], total: 0 };
        if (path === '/api/daily-summary') {
          const foodEntries = entries.filter(
            (entry) =>
              entry.entry_date === (url.searchParams.get('date') ?? reviewDate)
          );
          const eaten = foodEntries.reduce(
            (sum, entry) =>
              sum + (entry.calories * entry.quantity) / entry.serving_size,
            0
          );
          return {
            ...baseSummary,
            foodEntries,
            waterIntake: waterMl,
            calorieBalance: {
              ...baseSummary.calorieBalance,
              eaten,
              net: eaten,
              remaining: baseSummary.goals.calories - eaten,
              progress:
                baseSummary.goals.calories > 0
                  ? (eaten / baseSummary.goals.calories) * 100
                  : 0,
            },
          };
        }
        if (path === '/api/foods') return { recentFoods: [food], topFoods: [] };
        if (path === '/api/foods/foods-paginated') {
          const match = reviewFood.name
            .toLowerCase()
            .includes((url.searchParams.get('searchTerm') ?? '').toLowerCase());
          return {
            foods: match ? [food] : [],
            totalCount: match ? 1 : 0,
          };
        }
        if (
          path === '/api/foods/food-variants' &&
          url.searchParams.get('food_id') === reviewFood.id
        )
          return variants;
        if (path === `/api/foods/${reviewFood.id}/last-serving`)
          return scenario === 'populated'
            ? {
                food_id: reviewFood.id,
                variant_id: 'review-variant',
                quantity: 150,
                unit: 'g',
                serving_size: 100,
                serving_label: null,
                metric_amount: 100,
                metric_unit: 'g',
                used_at: `${reviewDate}T07:30:00Z`,
              }
            : null;
        if (path === '/api/foods/review-food') return food;
        // Edit Food asks whether AI unit estimates are available; they are off.
        if (path === '/api/global-settings/allow-user-ai-config')
          return { allow_user_ai_config: false };
        if (path === `/api/foods/${reviewFood.id}/deletion-impact`)
          return {
            foodEntriesCount: entries.filter(
              (entry) => entry.food_id === reviewFood.id
            ).length,
            mealFoodsCount: 0,
            mealPlansCount: 0,
            mealPlanTemplateAssignmentsCount: 0,
            totalReferences: 0,
            otherUserReferences: 0,
          };
        // Launch-icon measurements opens an empty synthetic editor. Unknown
        // history is absent, not a zero-valued body measurement.
        if (path === '/api/measurements/check-in/latest-on-or-before-date')
          return null;
        if (
          path ===
          '/api/measurements/custom-entries/latest-manual-on-or-before-date'
        )
          return [];
        if (
          [
            '/api/identity/users/accessible-users',
            '/api/sleep',
            '/api/meals/search',
          ].includes(path) ||
          /^\/api\/(measurements\/(check-in-photos|custom-entries)|nutrition-captures\/by-date)\/\d{4}-\d{2}-\d{2}$/.test(
            path
          )
        )
          return [];
        return reviewResponse(path, scenario);
      }
      if (method === 'PUT' && path === `/api/foods/${reviewFood.id}/servings`)
        return variants;
      if (method === 'POST' && path === '/api/food-entries') {
        const data = JSON.parse(body ?? '{}') as CreateFoodEntryPayload;
        if (
          data.food_id !== reviewFood.id ||
          !data.meal_type_id ||
          !(data.quantity > 0)
        )
          throw new Error('Invalid synthetic food entry');
        const previous =
          data.client_operation_id &&
          entries.find(
            (entry) => entry.client_operation_id === data.client_operation_id
          );
        if (previous) return previous;
        const variant =
          variants.find((row) => row.id === data.variant_id) ?? variants[0];
        const entry: FoodEntry = {
          ...reviewFood.default_variant,
          ...variant,
          ...data,
          id: `review-created-${nextId++}`,
          user_id: 'review-user',
          food_name: reviewFood.name,
          brand_name: reviewFood.brand!,
          food_images: [
            `http://127.0.0.1:43991/fixture-thumbnail.png?run=${Date.now()}`,
          ],
          meal_type: 'breakfast',
          serving_size: data.serving_size ?? variant.serving_size,
          serving_unit: data.serving_unit ?? variant.serving_unit,
          calories: variant.calories,
          custom_nutrients: data.custom_nutrients ?? undefined,
        };
        entries.push(entry);
        return entry;
      }
      const id = path.match(/^\/api\/food-entries\/(review-created-\d+)$/)?.[1];
      if (id && method === 'PUT') {
        const data = JSON.parse(body ?? '{}') as UpdateFoodEntryPayload;
        const entry = entries.find((entry) => entry.id === id);
        if (!entry || (data.quantity !== undefined && !(data.quantity > 0)))
          throw new Error('Invalid synthetic update');
        Object.assign(entry, data);
        return entry;
      }
      if (id && method === 'DELETE') {
        if (!entries.some((entry) => entry.id === id))
          throw new Error('Unknown synthetic entry');
        entries = entries.filter((entry) => entry.id !== id);
        return { success: true };
      }
      throw new Error(`Unconfigured review endpoint: ${method} ${path}`);
    },
  };
}
