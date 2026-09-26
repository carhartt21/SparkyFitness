import type { WaterIntakeLogEntry } from '@workspace/shared';
import type { FoodItem } from '../src/types/foods';
import type { FoodEntry } from '../src/types/foodEntries';
import type {
  CreateFoodEntryPayload,
  UpdateFoodEntryPayload,
} from '../src/services/api/foodEntriesApi';
import { reviewDate, reviewResponse, summaryFixture } from './fixtures';

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
  },
};

const clone = (entries: FoodEntry[]): FoodEntry[] =>
  JSON.parse(JSON.stringify(entries));

/** In-memory simulator fixture. Never imports a network or persistence client. */
export function createNutritionFixture(scenario: string) {
  let entries: FoodEntry[] = clone(
    (reviewResponse('/api/daily-summary', scenario) as typeof summaryFixture)
      .foodEntries
  );
  let nextId = 1;
  let waterMl = scenario === 'empty' ? 0 : summaryFixture.waterIntake;
  const waterLog: WaterIntakeLogEntry[] = [];

  const snapshot = () => clone(entries);
  return {
    snapshot,
    respond(url: URL, method: string, body?: string): unknown {
      if (url.origin !== 'https://ui-review.invalid')
        throw new Error('Review blocked network origin');
      const path = url.pathname.replace(/\/$/, '');
      if (
        method === 'POST' &&
        path === '/api/user-preferences/bootstrap-timezone'
      )
        return { timezone: 'Europe/Berlin' };
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
      if (method === 'GET') {
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

        if (path === '/api/goals/for-date') return summaryFixture.goals;
        if (path === '/api/workout-presets')
          return { presets: [], totalCount: 0 };
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
            ...summaryFixture,
            foodEntries,
            waterIntake: waterMl,
            calorieBalance: {
              ...summaryFixture.calorieBalance,
              eaten,
              net: eaten,
              remaining: 2000 - eaten,
              progress: eaten / 20,
            },
          };
        }
        if (path === '/api/foods')
          return { recentFoods: [reviewFood], topFoods: [] };
        if (path === '/api/foods/foods-paginated') {
          const match = reviewFood.name
            .toLowerCase()
            .includes((url.searchParams.get('searchTerm') ?? '').toLowerCase());
          return {
            foods: match ? [reviewFood] : [],
            totalCount: match ? 1 : 0,
          };
        }
        if (
          path === '/api/foods/food-variants' &&
          url.searchParams.get('food_id') === reviewFood.id
        )
          return [{ ...reviewFood.default_variant, food_id: reviewFood.id }];
        if (path === '/api/foods/review-food') return reviewFood;
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
        const entry: FoodEntry = {
          ...reviewFood.default_variant,
          ...data,
          id: `review-created-${nextId++}`,
          user_id: 'review-user',
          food_name: reviewFood.name,
          brand_name: reviewFood.brand!,
          food_images: ['http://127.0.0.1:43991/fixture-thumbnail.png'],
          meal_type: 'breakfast',
          serving_size: reviewFood.default_variant.serving_size,
          calories: reviewFood.default_variant.calories,
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
