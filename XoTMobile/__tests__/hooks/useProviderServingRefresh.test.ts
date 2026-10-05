import { renderHook, waitFor } from '@testing-library/react-native';
import { useProviderServingRefresh } from '../../src/hooks/useProviderServingRefresh';
import { foodItemToFoodInfo } from '../../src/types/foodInfo';
import type { FoodVariantDetail } from '../../src/types/foods';
import {
  createFoodVariant,
  fetchFoodVariants,
} from '../../src/services/api/foodsApi';
import { fetchExternalFoodDetails } from '../../src/services/api/externalFoodSearchApi';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { foodVariantsQueryKey } from '../../src/hooks/queryKeys';
import { createTestQueryClient, createQueryWrapper } from './queryTestUtils';

jest.mock('../../src/services/api/foodsApi', () => ({
  createFoodVariant: jest.fn(),
  fetchFoodVariants: jest.fn(),
}));
jest.mock('../../src/services/api/externalFoodSearchApi', () => ({
  fetchExternalFoodDetails: jest.fn(),
}));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
  subscribeNutritionIdentity: () => () => undefined,
}));
jest.mock('../../src/localization', () => ({ useAppLocale: () => 'de' }));

const identity = { serverConfigId: 'server', userId: 'owner' };
const basis: FoodVariantDetail = {
  id: 'base',
  food_id: 'food',
  serving_size: 100,
  serving_unit: 'g',
  calories: 572,
  protein: 8.6,
  carbs: 49.5,
  fat: 37.3,
  is_default: true,
};
const food = foodItemToFoodInfo({
  id: 'food',
  name: 'Synthetic provider food',
  brand: null,
  is_custom: false,
  user_id: 'owner',
  provider_type: 'openfoodfacts',
  provider_external_id: 'synthetic-provider-id',
  default_variant: basis,
});
const details = {
  id: 'synthetic-provider-id',
  name: 'Synthetic provider food',
  brand: null,
  calories: 572,
  protein: 8.6,
  carbs: 49.5,
  fat: 37.3,
  serving_size: 100,
  serving_unit: 'g',
  variants: [
    {
      serving_size: 1,
      serving_unit: 'serving',
      serving_description: '1 serving (21.5 g)',
      metric_amount: 21.5,
      metric_unit: 'g' as const,
      calories: 123,
      protein: 1.8,
      carbs: 10.6,
      fat: 8,
    },
  ],
};

describe('refreshing an owned, previously saved OFF food', () => {
  const client = createTestQueryClient();
  beforeEach(() => {
    jest.clearAllMocks();
    client.clear();
    jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
    jest.mocked(fetchFoodVariants).mockResolvedValue([basis]);
    jest.mocked(fetchExternalFoodDetails).mockResolvedValue(details);
    jest.mocked(createFoodVariant).mockImplementation(async (payload) => ({
      ...payload,
      id: 'new-portion',
    }));
  });
  afterEach(() => client.clear());
  it('uses one provider detail request and appends a resolved selectable local ID, keeping grams and cached nutrition', async () => {
    const hook = renderHook(() => useProviderServingRefresh(food, true), {
      wrapper: createQueryWrapper(client),
    });
    await waitFor(() =>
      expect(
        client.getQueryData<FoodVariantDetail[]>(foodVariantsQueryKey('food'))
      ).toHaveLength(2)
    );
    expect(fetchExternalFoodDetails).toHaveBeenCalledWith(
      'openfoodfacts',
      'synthetic-provider-id',
      undefined,
      undefined,
      'de',
      identity
    );
    expect(createFoodVariant).toHaveBeenCalledWith(
      expect.objectContaining({
        food_id: 'food',
        serving_size: 1,
        serving_unit: 'serving (21.5 g)',
        metric_amount: 21.5,
        source: 'imported',
      }),
      identity
    );
    expect(
      client.getQueryData<FoodVariantDetail[]>(
        foodVariantsQueryKey('food')
      )?.[0]
    ).toEqual(basis);
    hook.rerender({});
    expect(fetchExternalFoodDetails).toHaveBeenCalledTimes(1);
  });
  it('refreshes a legacy saved OFF food by its valid barcode when the provider ID is absent', async () => {
    renderHook(
      () =>
        useProviderServingRefresh(
          { ...food, provider_external_id: null, barcode: '80052760' },
          true
        ),
      {
        wrapper: createQueryWrapper(client),
      }
    );
    await waitFor(() => expect(fetchExternalFoodDetails).toHaveBeenCalled());
    expect(fetchExternalFoodDetails).toHaveBeenCalledWith(
      'openfoodfacts',
      '80052760',
      undefined,
      undefined,
      'de',
      identity
    );
  });
  it('preserves already imported or custom portions without an upstream request', async () => {
    jest.mocked(fetchFoodVariants).mockResolvedValue([
      basis,
      {
        ...basis,
        id: 'portion',
        serving_size: 1,
        serving_unit: 'piece',
        metric_amount: 21.5,
        metric_unit: 'g',
      },
    ]);
    renderHook(() => useProviderServingRefresh(food, true), {
      wrapper: createQueryWrapper(client),
    });
    await waitFor(() => expect(fetchFoodVariants).toHaveBeenCalled());
    expect(fetchExternalFoodDetails).not.toHaveBeenCalled();
    expect(createFoodVariant).not.toHaveBeenCalled();
  });
  it('publishes an authoritative existing legacy portion even if no new row is needed', async () => {
    const legacyPortion = {
      ...basis,
      id: 'legacy-portion',
      serving_size: 1,
      serving_unit: 'serving (21.5 g)',
    };
    client.setQueryData(foodVariantsQueryKey('food'), [basis]);
    jest.mocked(fetchFoodVariants).mockResolvedValue([basis, legacyPortion]);
    renderHook(() => useProviderServingRefresh(food, true), {
      wrapper: createQueryWrapper(client),
    });
    await waitFor(() =>
      expect(client.getQueryData(foodVariantsQueryKey('food'))).toEqual([
        basis,
        legacyPortion,
      ])
    );
    expect(createFoodVariant).not.toHaveBeenCalled();
  });
  it('retains a successfully appended portion when a later portion fails', async () => {
    jest.mocked(fetchExternalFoodDetails).mockResolvedValue({
      ...details,
      variants: [
        ...details.variants,
        { ...details.variants[0], serving_unit: 'pack', metric_amount: 43 },
      ],
    });
    jest
      .mocked(createFoodVariant)
      .mockImplementationOnce(async (payload) => ({
        ...payload,
        id: 'new-portion',
      }))
      .mockRejectedValueOnce(new Error('Provider unavailable'));
    const { result } = renderHook(() => useProviderServingRefresh(food, true), {
      wrapper: createQueryWrapper(client),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(
      client
        .getQueryData<FoodVariantDetail[]>(foodVariantsQueryKey('food'))
        ?.map((v) => v.id)
    ).toEqual(['base', 'new-portion']);
  });
  it('does not publish late serving results into a different active account', async () => {
    jest.mocked(fetchExternalFoodDetails).mockImplementation(async () => {
      jest
        .mocked(getActiveNutritionIdentity)
        .mockResolvedValue({ ...identity, userId: 'other' });
      return details;
    });
    renderHook(() => useProviderServingRefresh(food, true), {
      wrapper: createQueryWrapper(client),
    });
    await waitFor(() => expect(fetchExternalFoodDetails).toHaveBeenCalled());
    expect(createFoodVariant).not.toHaveBeenCalled();
    expect(client.getQueryData(foodVariantsQueryKey('food'))).toBeUndefined();
  });
  it.each([false, true])(
    'does not write another owner’s food, even when online=%s',
    async (online) => {
      renderHook(
        () => useProviderServingRefresh({ ...food, userId: 'other' }, online),
        { wrapper: createQueryWrapper(client) }
      );
      await waitFor(() =>
        expect(getActiveNutritionIdentity).toHaveBeenCalled()
      );
      expect(fetchExternalFoodDetails).not.toHaveBeenCalled();
      expect(createFoodVariant).not.toHaveBeenCalled();
    }
  );
  it('uses saved choices offline without contacting the provider or writing variants', async () => {
    const { result } = renderHook(
      () => useProviderServingRefresh(food, false),
      {
        wrapper: createQueryWrapper(client),
      }
    );
    await waitFor(() => expect(getActiveNutritionIdentity).toHaveBeenCalled());
    expect(result.current.isLoading).toBe(false);
    expect(fetchFoodVariants).not.toHaveBeenCalled();
    expect(fetchExternalFoodDetails).not.toHaveBeenCalled();
    expect(createFoodVariant).not.toHaveBeenCalled();
  });
  it('leaves saved choices usable on timeout and does not append if the authoritative re-read fails', async () => {
    jest
      .mocked(fetchFoodVariants)
      .mockResolvedValueOnce([basis])
      .mockRejectedValueOnce(new Error('Account changed'));
    const { result } = renderHook(() => useProviderServingRefresh(food, true), {
      wrapper: createQueryWrapper(client),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(createFoodVariant).not.toHaveBeenCalled();
  });
});
