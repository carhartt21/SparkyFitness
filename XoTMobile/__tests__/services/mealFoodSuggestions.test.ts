import {
  mealHistoryWindow,
  rankMealFoods,
  readMealFoodHistory,
} from '../../src/services/mealFoodSuggestions';
import { waitFor } from '@testing-library/react-native';
import { apiFetch } from '../../src/services/api/apiClient';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../../src/services/nutritionIdentity';
import type { FoodEntry } from '../../src/types/foodEntries';
import type { FoodItem } from '../../src/types/foods';
jest.mock('../../src/services/api/apiClient', () => ({
  __esModule: true,
  apiFetch: jest.fn(),
  bindNutritionRequestIdentity: (...args: unknown[]) => mockBind(...args),
}));
const mockBind = jest.fn();
const binding = {
  serverConfigId: 'ui-test-server',
  userId: 'ui-test-owner',
  assertCurrent: jest.fn(),
  release: jest.fn(),
};
const transport = jest.requireMock('../../src/services/api/apiClient') as {
  bindNutritionRequestIdentity?: (...args: unknown[]) => unknown;
};
const originalBinder = transport.bindNutritionRequestIdentity;
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
  subscribeNutritionIdentity: jest.fn(),
}));
let mockScopeChanged: () => void;
const identity = { serverConfigId: 'ui-test-server', userId: 'ui-test-owner' };
const food = (id: string) => ({ id, name: `Test ${id}` }) as FoodItem;
const row = (
  food_id: string,
  entry_date: string,
  extra: Partial<FoodEntry> = {}
) =>
  ({
    id: `${food_id}-${entry_date}`,
    food_id,
    entry_date,
    meal_type_id: 'custom-context',
    ...extra,
  }) as FoodEntry;
const rank = (rows: FoodEntry[], items = [food('a'), food('b'), food('c')]) =>
  rankMealFoods(items, rows, 'custom-context', '2030-02-01', '2030-02-28').map(
    (x) => x.id
  );
beforeEach(() => {
  jest.resetAllMocks();
  transport.bindNutritionRequestIdentity = originalBinder;
  mockBind.mockResolvedValue(binding);
  binding.assertCurrent.mockResolvedValue(undefined);
  jest
    .mocked(apiFetch)
    .mockImplementation(async () => ({ id: identity.userId }));
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  jest.mocked(subscribeNutritionIdentity).mockImplementation((listener) => {
    mockScopeChanged = listener;
    return jest.fn();
  });
});

it('anchors 28 local calendar days, clamps future days and handles leap days', () => {
  expect(mealHistoryWindow('2030-03-12', '2030-03-01')).toEqual({
    start: '2030-02-02',
    end: '2030-03-01',
  });
  expect(mealHistoryWindow('2028-02-29', '2030-03-01')).toEqual({
    start: '2028-02-02',
    end: '2028-02-29',
  });
  expect(mealHistoryWindow('bad', '2030-03-01')).toEqual(
    mealHistoryWindow(undefined, '2030-03-01')
  );
});
it('counts distinct days, collapses variants and chooses canonical meal IDs rather than names', () => {
  const rows = [
    row('a', '2030-02-01'),
    row('a', '2030-02-02'),
    ...Array.from({ length: 5 }, (_, i) =>
      row('b', '2030-02-28', { variant_id: `variant-${i}` })
    ),
    row('c', '2030-02-28', {
      meal_type_id: 'other-custom',
      meal_type: 'Same name',
    }),
  ];
  expect(rank(rows)).toEqual(['a', 'b']);
  expect(
    rankMealFoods(
      [food('a'), food('c')],
      rows,
      'other-custom',
      '2030-02-01',
      '2030-02-28'
    ).map((x) => x.id)
  ).toEqual(['c']);
});
it('orders recency by date then clock with null clocks last and stable ties', () => {
  expect(
    rank([
      row('a', '2030-02-28', { entry_time: null }),
      row('b', '2030-02-28', { entry_time: '09:00' }),
      row('c', '2030-02-27', { entry_time: '23:00' }),
    ])
  ).toEqual(['b', 'a', 'c']);
  expect(rank([row('a', '2030-02-28'), row('b', '2030-02-28')])).toEqual([
    'a',
    'b',
  ]);
});
it('drops deleted foods, grouped-meal ingredients, pending/invalid/out-of-window rows and unavailable definitions', () => {
  expect(
    rank([
      row('a', '2030-02-28', { food_id: undefined }),
      row('b', '2030-02-28', { food_entry_meal_id: 'group' }),
      row('c', '2030-02-28', { meal_id: 'legacy' }),
      row('a', '2030-02-28', { isPendingNutrition: true }),
      row('a', '2030-03-01'),
      row('a', '2030-01-31'),
      row('a', '2030-02-30'),
      row('not-in-library', '2030-02-28'),
    ])
  ).toEqual([]);
});
it('returns unchanged fallback candidates when history/context is unavailable (no invented matches)', () => {
  expect(rank([])).toEqual([]);
  expect(
    rankMealFoods(
      [food('a')],
      [row('a', '2030-02-28')],
      undefined,
      '2030-02-01',
      '2030-02-28'
    )
  ).toEqual([]);
});
it('verifies the profile and reads the owner range through one binding, without writes', async () => {
  const rows = [row('a', '2030-02-28')];
  jest
    .mocked(apiFetch)
    .mockResolvedValueOnce({ id: identity.userId })
    .mockResolvedValueOnce(rows);
  await expect(
    readMealFoodHistory(identity, '2030-02-01', '2030-02-28')
  ).resolves.toEqual(rows);
  expect(mockBind).toHaveBeenCalledWith(identity);
  expect(
    jest.mocked(apiFetch).mock.calls.map(([args]) => args.endpoint)
  ).toEqual([
    '/api/identity/profiles',
    '/api/food-entries/range/2030-02-01/2030-02-28',
  ]);
  for (const [args] of jest.mocked(apiFetch).mock.calls) {
    expect(args.expectedIdentity).toBe(binding);
    expect(args).not.toHaveProperty('body');
    expect(args).not.toHaveProperty('method');
  }
  expect(binding.release).toHaveBeenCalledTimes(1);
});
it('fails closed without the owner-A binding capability, before any network read', async () => {
  transport.bindNutritionRequestIdentity = undefined;
  await expect(
    readMealFoodHistory(identity, '2030-02-01', '2030-02-28')
  ).rejects.toThrow('transport unavailable');
  expect(apiFetch).not.toHaveBeenCalled();
});
it('rejects same-ID saved credentials resolving to another profile before reading any history', async () => {
  jest.mocked(apiFetch).mockResolvedValue({ id: 'other-synthetic-owner' });
  await expect(
    readMealFoodHistory(identity, '2030-02-01', '2030-02-28')
  ).rejects.toThrow('identity changed');
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(binding.release).toHaveBeenCalledTimes(1);
});
it.each([1, 2, 3])(
  'rejects credential changes at binding boundary %i and releases the binding',
  async (boundary) => {
    let checks = 0;
    binding.assertCurrent.mockImplementation(async () => {
      if (++checks === boundary) throw new Error('credentials changed');
    });
    jest
      .mocked(apiFetch)
      .mockResolvedValueOnce({ id: identity.userId })
      .mockResolvedValueOnce([]);
    await expect(
      readMealFoodHistory(identity, '2030-02-01', '2030-02-28')
    ).rejects.toThrow('credentials changed');
    expect(apiFetch).toHaveBeenCalledTimes(boundary - 1);
    expect(binding.release).toHaveBeenCalledTimes(1);
  }
);
function deferRange() {
  let resolve!: (value: FoodEntry[]) => void;
  jest
    .mocked(apiFetch)
    .mockResolvedValueOnce({ id: identity.userId })
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
  return { resolve: (value: FoodEntry[]) => resolve(value) };
}
it.each(['user', 'server'])(
  'rejects a late response on %s change',
  async (change) => {
    const deferred = deferRange();
    const result = readMealFoodHistory(identity, '2030-02-01', '2030-02-28');
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    jest
      .mocked(getActiveNutritionIdentity)
      .mockResolvedValue(
        change === 'user'
          ? { ...identity, userId: 'other-synthetic-owner' }
          : { ...identity, serverConfigId: 'other-synthetic-server' }
      );
    deferred.resolve([row('a', '2030-02-28')]);
    await expect(result).rejects.toThrow('identity changed');
    expect(binding.release).toHaveBeenCalledTimes(1);
  }
);
it('refuses unknown identity before issuing a request and propagates 403 for the hook fallback', async () => {
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(null);
  await expect(
    readMealFoodHistory(identity, '2030-02-01', '2030-02-28')
  ).rejects.toThrow();
  expect(apiFetch).not.toHaveBeenCalled();
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  jest.mocked(apiFetch).mockRejectedValue({ status: 403 });
  await expect(
    readMealFoodHistory(identity, '2030-02-01', '2030-02-28')
  ).rejects.toEqual({ status: 403 });
  expect(binding.release).toHaveBeenCalledTimes(1);
});
it('rejects a response after switching away and back to the same identity', async () => {
  const deferred = deferRange();
  const result = readMealFoodHistory(identity, '2030-02-01', '2030-02-28');
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  mockScopeChanged();
  deferred.resolve([]);
  await expect(result).rejects.toThrow('identity changed');
});
