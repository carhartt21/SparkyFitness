import { addDays, isDayString } from '@workspace/shared';
import * as apiClient from './api/apiClient';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from './nutritionIdentity';
import type { FoodEntry } from '../types/foodEntries';
import type { FoodItem } from '../types/foods';

export function mealHistoryWindow(day: string | undefined, today: string) {
  const end = day && isDayString(day) && day < today ? day : today;
  return { start: addDays(end, -27), end };
}

const sameIdentity = (
  a: NutritionActionIdentity | null,
  b: NutritionActionIdentity
) => a?.serverConfigId === b.serverConfigId && a?.userId === b.userId;

interface HistoryRequestBinding extends NutritionActionIdentity {
  assertCurrent: () => Promise<void>;
  release: () => void;
}
// Owner A supplies this transport capability at serial integration. The pinned
// baseline lacks it: fail closed there rather than read under stale credentials.
const transport: typeof apiClient & {
  bindNutritionRequestIdentity?: (
    identity: NutritionActionIdentity
  ) => Promise<HistoryRequestBinding>;
} = apiClient;

/** Owner-scoped range route. Rows carry no owner field: reject the whole stale response. */
export async function readMealFoodHistory(
  identity: NutritionActionIdentity,
  start: string,
  end: string
): Promise<FoodEntry[]> {
  let changed = false;
  const stop = subscribeNutritionIdentity(() => {
    changed = true;
  });
  const assertScope = async () => {
    const current = await getActiveNutritionIdentity();
    if (changed || !sameIdentity(current, identity))
      throw new Error('History identity changed');
  };
  try {
    await assertScope();
    if (!transport.bindNutritionRequestIdentity)
      throw new Error('Bound history transport unavailable');
    const binding = await transport.bindNutritionRequestIdentity(identity);
    try {
      await binding.assertCurrent();
      const profile = await apiClient.apiFetch<{ id: string }>({
        endpoint: '/api/identity/profiles',
        serviceName: 'Meal Food Suggestions',
        operation: 'verify history owner',
        expectedIdentity: binding,
      });
      await binding.assertCurrent();
      await assertScope();
      if (profile.id !== identity.userId)
        throw new Error('History identity changed');
      const entries = await apiClient.apiFetch<FoodEntry[]>({
        endpoint: `/api/food-entries/range/${start}/${end}`,
        serviceName: 'Meal Food Suggestions',
        operation: 'read meal food history',
        expectedIdentity: binding,
      });
      await binding.assertCurrent();
      // Even switching away and back to the same ID invalidates this read.
      await assertScope();
      return entries;
    } finally {
      binding.release();
    }
  } finally {
    stop();
  }
}

/** Distinct days per canonical food/meal; variants collapse; meal ingredients do not count. */
export function rankMealFoods(
  foods: FoodItem[],
  entries: FoodEntry[],
  mealId: string | null | undefined,
  start: string,
  end: string
): FoodItem[] {
  if (!mealId) return [];
  const usage = new Map<string, { days: Set<string>; latest: string }>();
  for (const entry of entries) {
    if (
      !entry.food_id ||
      entry.meal_type_id !== mealId ||
      entry.meal_id ||
      entry.food_entry_meal_id ||
      entry.isPendingNutrition ||
      !isDayString(entry.entry_date) ||
      entry.entry_date < start ||
      entry.entry_date > end
    )
      continue;
    const clock =
      entry.entry_time &&
      /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(entry.entry_time)
        ? entry.entry_time
        : '';
    const latest = `${entry.entry_date} ${clock}`;
    const stat = usage.get(entry.food_id) ?? {
      days: new Set<string>(),
      latest: '',
    };
    stat.days.add(entry.entry_date);
    if (latest > stat.latest) stat.latest = latest;
    usage.set(entry.food_id, stat);
  }
  const unique = [...new Map(foods.map((food) => [food.id, food])).values()];
  return unique
    .filter((food) => usage.has(food.id))
    .sort((a, b) => {
      const x = usage.get(a.id)!;
      const y = usage.get(b.id)!;
      return (
        y.days.size - x.days.size ||
        (x.latest < y.latest ? 1 : x.latest > y.latest ? -1 : 0)
      );
    });
}
