import { renderHook, waitFor } from '@testing-library/react-native';
import { useAllProvidersSearch } from '../../src/hooks/useAllProvidersSearch';
import { searchExternalFoods } from '../../src/services/api/externalFoodSearchApi';
import { createQueryWrapper, createTestQueryClient } from './queryTestUtils';
import type { ExternalProvider } from '../../src/types/externalProviders';

jest.mock('../../src/services/api/externalFoodSearchApi', () => ({
  searchExternalFoods: jest.fn(),
}));

const providers = ['bls4', 'swissfood'].map((id) => ({
  id,
  provider_type: id,
  provider_name: id,
})) as ExternalProvider[];

it('shows useful BLS rows when another provider times out', async () => {
  jest.mocked(searchExternalFoods).mockImplementation(async (provider) => {
    if (provider === 'swissfood') throw new Error('timed out');
    return {
      items: [
        {
          id: 'bls-tomato',
          name: 'Tomate, roh',
          brand: null,
          source: 'bls4',
          calories: 18,
          protein: 0.9,
          carbs: 3,
          fat: 0.2,
          serving_size: 100,
          serving_unit: 'g',
        },
      ],
      pagination: { page: 1, pageSize: 100, totalCount: 1, hasMore: false },
    };
  });
  const queryClient = createTestQueryClient();
  const { result } = renderHook(
    () => useAllProvidersSearch('tomate roh', providers),
    { wrapper: createQueryWrapper(queryClient) }
  );
  await waitFor(() => {
    expect(result.current.providerResults[0]?.items[0]?.name).toBe(
      'Tomate, roh'
    );
    expect(result.current.providerResults[1]?.isError).toBe(true);
  });
  queryClient.clear();
});
