import { act, renderHook, waitFor } from '@testing-library/react-native';
import i18n from '../../src/localization/i18n';
import { useExternalFoodSearch } from '../../src/hooks/useExternalFoodSearch';
import {
  allProvidersFoodSearchQueryKey,
  externalFoodSearchQueryKey,
} from '../../src/hooks/queryKeys';
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

describe.each(['all providers', 'single provider'])('%s language', (mode) => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    i18n.removeResourceBundle('de', 'translation');
  });

  it('refetches German names instead of retaining English names when the app language changes', async () => {
    jest.clearAllMocks();
    i18n.addResourceBundle('de', 'translation', { languageTest: 'Deutsch' });
    jest
      .mocked(searchExternalFoods)
      .mockImplementation(
        async (_provider, _query, _page, _id, _scale, _size, language) => ({
          items: [
            {
              id: 'fixture-oats',
              name: language === 'de' ? 'Hafer, roh' : 'Oat, raw',
              brand: null,
              source: 'bls4',
              calories: 343,
              protein: 11.375,
              carbs: 53.7,
              fat: 7.09,
              serving_size: 100,
              serving_unit: 'g',
            },
          ],
          pagination: { page: 1, pageSize: 100, totalCount: 1, hasMore: false },
        })
      );
    const client = createTestQueryClient();
    const { result, unmount } = renderHook(
      () => {
        // Both production hooks are mounted to verify request/key alignment.
        const all = useAllProvidersSearch('hafer', [providers[0]!], {
          enabled: mode === 'all providers',
        });
        const single = useExternalFoodSearch('hafer', 'bls4', {
          enabled: mode === 'single provider',
        });
        return mode === 'all providers'
          ? all.providerResults[0]?.items
          : single.searchResults;
      },
      { wrapper: createQueryWrapper(client) }
    );
    await waitFor(() => expect(result.current?.[0]?.name).toBe('Oat, raw'));
    await act(async () => {
      await i18n.changeLanguage('de');
    });
    await waitFor(() => expect(result.current?.[0]?.name).toBe('Hafer, roh'));
    expect(
      jest.mocked(searchExternalFoods).mock.calls.map((call) => call[6])
    ).toEqual(['en', 'de']);
    unmount();
    client.clear();
  });
});

it('versions locale-scoped keys so pre-fix English payloads cannot be reused', () => {
  for (const key of [
    allProvidersFoodSearchQueryKey(
      'bls4',
      'hafer',
      undefined,
      undefined,
      100,
      'de'
    ),
    externalFoodSearchQueryKey('bls4', 'hafer', undefined, undefined, 'de'),
  ]) {
    expect(key).toContain('de');
    expect(key.at(-1)).toBe('provider-language-v1');
  }
});
