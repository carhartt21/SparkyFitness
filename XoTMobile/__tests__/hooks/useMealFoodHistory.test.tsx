import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMealFoodHistory } from '../../src/hooks/useMealFoodHistory';
import { readMealFoodHistory } from '../../src/services/mealFoodSuggestions';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { createTestQueryClient, createQueryWrapper } from './queryTestUtils';
import type { FoodEntry } from '../../src/types/foodEntries';

let mockIdentityChanged: () => void;
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
  subscribeNutritionIdentity: (listener: () => void) => {
    mockIdentityChanged = listener;
    return jest.fn();
  },
}));
jest.mock('../../src/services/mealFoodSuggestions', () => ({
  ...jest.requireActual('../../src/services/mealFoodSuggestions'),
  readMealFoodHistory: jest.fn(),
}));
const identity = { serverConfigId: 'ui-test-server', userId: 'ui-test-owner' };
const rows = [{ id: 'synthetic-entry', food_id: 'a' }] as FoodEntry[];
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  jest.mocked(readMealFoodHistory).mockResolvedValue(rows);
});
const setup = (enabled = true) =>
  renderHook(({ user }) => useMealFoodHistory(user, '2030-02-28', enabled), {
    initialProps: { user: identity.userId },
    wrapper: createQueryWrapper(createTestQueryClient()),
  });

it('keys history by verified server/user and stable date; ordinary rerenders do not refetch', async () => {
  const v = setup();
  await waitFor(() => expect(v.result.current.entries).toEqual(rows));
  expect(readMealFoodHistory).toHaveBeenCalledWith(
    identity,
    expect.any(String),
    expect.any(String)
  );
  v.rerender({ user: identity.userId });
  expect(readMealFoodHistory).toHaveBeenCalledTimes(1);
});
it('disables all reads offline/unsupported mode and falls back on a forbidden response', async () => {
  const v = setup(false);
  await act(async () => {
    await Promise.resolve();
  });
  expect(readMealFoodHistory).not.toHaveBeenCalled();
  expect(v.result.current.entries).toEqual([]);
  v.unmount();
  jest.mocked(readMealFoodHistory).mockRejectedValue({ status: 403 });
  const failed = setup();
  await waitFor(() => expect(readMealFoodHistory).toHaveBeenCalledTimes(1));
  expect(failed.result.current.entries).toEqual([]);
});
it('does not show old or late history after an account change', async () => {
  let resolve!: (entries: FoodEntry[]) => void;
  jest.mocked(readMealFoodHistory).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const v = setup();
  await waitFor(() => expect(readMealFoodHistory).toHaveBeenCalledTimes(1));
  jest
    .mocked(getActiveNutritionIdentity)
    .mockResolvedValue({ ...identity, userId: 'other-synthetic-owner' });
  await act(async () => {
    mockIdentityChanged();
    resolve(rows);
    await Promise.resolve();
  });
  expect(v.result.current.entries).toEqual([]);
});
it('removes visible history on same-user server switch before replacement arrives', async () => {
  const v = setup();
  await waitFor(() => expect(v.result.current.entries).toEqual(rows));
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue({
    ...identity,
    serverConfigId: 'other-synthetic-server',
  });
  jest
    .mocked(readMealFoodHistory)
    .mockImplementation(() => new Promise(() => {}));
  await act(async () => {
    mockIdentityChanged();
    await Promise.resolve();
  });
  expect(v.result.current.entries).toEqual([]);
});
