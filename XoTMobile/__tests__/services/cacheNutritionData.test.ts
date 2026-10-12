import {
  fetchAndCacheNutritionData,
  fetchAndCacheNutritionMeals,
} from '../../src/services/cacheNutritionData';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../../src/services/nutritionIdentity';
import { fetchProfile } from '../../src/services/api/profileApi';
import { cacheOfflineMeals } from '../../src/services/nutritionFavoriteCache';
import { savedMeal } from '../helpers/offlineMealFixtures';

jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
  subscribeNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/api/profileApi', () => ({
  fetchProfile: jest.fn(),
}));
jest.mock('../../src/services/nutritionFavoriteCache', () => ({
  cacheSavedFoods: jest.fn(),
  cacheOfflineMeals: jest.fn(),
}));
const identity = { serverConfigId: 'a', userId: 'owner' };
const stop = jest.fn();
let change: () => void;
beforeEach(() => {
  jest.clearAllMocks();
  (getActiveNutritionIdentity as jest.Mock).mockResolvedValue(identity);
  (fetchProfile as jest.Mock).mockResolvedValue({ id: identity.userId });
  (subscribeNutritionIdentity as jest.Mock).mockImplementation((listener) => {
    change = listener;
    return stop;
  });
});
it('persists a successful response only for its verified account and unsubscribes', async () => {
  const result = { foods: [] };
  const persist = jest.fn();
  expect(await fetchAndCacheNutritionData(async () => result, persist)).toBe(
    result
  );
  expect(persist).toHaveBeenCalledWith(result, identity, expect.any(Function));
  expect(stop).toHaveBeenCalledTimes(1);
});
it('never caches a response across an account switch, including a switch back', async () => {
  const persist = jest.fn();
  await fetchAndCacheNutritionData(async () => {
    change();
    return [];
  }, persist);
  expect(persist).not.toHaveBeenCalled();
  (fetchProfile as jest.Mock).mockResolvedValueOnce({ id: 'other' });
  await fetchAndCacheNutritionData(async () => [], persist);
  expect(persist).not.toHaveBeenCalled();
});
it('does not hide online results if profile verification or local storage fails', async () => {
  (fetchProfile as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  expect(
    await fetchAndCacheNutritionData(async () => 'visible', jest.fn())
  ).toBe('visible');
  expect(
    await fetchAndCacheNutritionData(
      async () => 'visible',
      jest.fn().mockRejectedValue(new Error('disk full'))
    )
  ).toBe('visible');
  await expect(
    fetchAndCacheNutritionData(async () => {
      throw new Error('request failed');
    }, jest.fn())
  ).rejects.toThrow('request failed');
  expect(stop).toHaveBeenCalledTimes(3);
});
it('caches a complete recipe snapshot rather than just a meal ID', async () => {
  await fetchAndCacheNutritionMeals(
    async () => [savedMeal],
    (meals) => meals
  );
  expect(cacheOfflineMeals).toHaveBeenCalledWith(identity, [
    expect.objectContaining({
      id: savedMeal.id,
      foods: [expect.objectContaining({ quantity: 200 })],
    }),
  ]);
});
