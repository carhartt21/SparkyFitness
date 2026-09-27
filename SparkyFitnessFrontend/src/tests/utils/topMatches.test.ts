import { rankTopMatches } from '@/utils/topMatches';
import type { ProviderFoodSearchResult } from '@/hooks/Foods/useAllProvidersFoodSearch';
import type { DataProvider } from '@/types/settings';
import type { Food } from '@/types/food';

const provider = (id: string, names: string[]): ProviderFoodSearchResult => ({
  provider: { id, provider_type: id, provider_name: id } as DataProvider,
  items: names.map((name, index) => ({
    provider_type: 'bls4' as const,
    food: {
      id: `${id}-${index}`,
      name,
      provider_external_id: `${id}-${index}`,
    } as Food,
  })),
  totalCount: names.length,
  isLoading: false,
  isError: false,
  refetch: () => {},
});

it('ranks food identity ahead of provider round-robin positions', () => {
  const rows = rankTopMatches(
    [
      provider('off', ['Sellerieknolle, roh', 'Tomatensauce']),
      provider('bls4', ['Tomate, roh']),
    ],
    'tomate roh'
  );
  expect(rows[0]?.result.food.name).toBe('Tomate, roh');
  expect(rows.map((row) => row.result.food.name)).not.toContain(
    'Sellerieknolle, roh'
  );
});
