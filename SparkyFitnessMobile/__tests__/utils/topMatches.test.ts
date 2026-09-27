import { rankTopMatches } from '../../src/utils/topMatches';
import type { ProviderSearchResult } from '../../src/hooks/useAllProvidersSearch';
import type { ExternalProvider } from '../../src/types/externalProviders';
import type { ExternalFoodItem } from '../../src/types/externalFoods';

const result = (id: string, names: string[]): ProviderSearchResult => ({
  provider: {
    id,
    provider_name: `Name ${id}`,
    provider_type: id,
  } as ExternalProvider,
  items: names.map((name, index) => ({
    id: `${id}-${index}`,
    name,
    source: id,
  })) as ExternalFoodItem[],
  totalCount: names.length,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
});

describe('rankTopMatches', () => {
  it('ranks food identity and preparation ahead of provider order', () => {
    const rows = rankTopMatches(
      [
        result('off', ['Sellerieknolle, roh', 'Tomatensauce']),
        result('bls4', ['Tomate, roh']),
      ],
      'tomate roh'
    );
    expect(rows[0]?.online.name).toBe('Tomate, roh');
    expect(rows.map((row) => row.online.name)).not.toContain(
      'Sellerieknolle, roh'
    );
    expect(
      rows.find((row) => row.online.name === 'Tomatensauce')?.broaderAlternative
    ).toBe(true);
  });

  it('keeps provider identity and caps the list after ranking', () => {
    const rows = rankTopMatches(
      [
        result('off', ['Tomatensauce', 'Tomatenpulver']),
        result('bls4', ['Tomate', 'Tomate, roh']),
      ],
      'tomate',
      2
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      providerId: 'bls4',
      providerName: 'Name bls4',
      online: { name: 'Tomate' },
    });
  });

  it('returns empty for unrelated candidates', () => {
    expect(
      rankTopMatches([result('off', ['Rindfleisch, gekocht'])], 'reis gekocht')
    ).toEqual([]);
  });
});
