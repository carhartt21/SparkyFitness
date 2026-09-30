import { apiCall } from '@/api/api';
import { searchFoodsV2, getFoodDetailsV2 } from '@/api/Foods/foodService';
import {
  searchFoodsV2Options,
  foodDetailsV2Options,
} from '@/hooks/Foods/useFoodsV2';
import i18n from '@/i18n';

jest.mock('@/api/api', () => ({ apiCall: jest.fn() }));
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { resolvedLanguage: 'de', language: 'de-DE' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  i18n.resolvedLanguage = 'de';
  i18n.language = 'de-DE';
});

it('sends the effective app language with provider searches and details', async () => {
  await searchFoodsV2('bls4', 'hafer');
  await getFoodDetailsV2('bls4', 'fixture-oats');
  expect(apiCall).toHaveBeenNthCalledWith(1, '/v2/foods/search/bls4', {
    method: 'GET',
    params: { query: 'hafer', language: 'de' },
  });
  expect(apiCall).toHaveBeenNthCalledWith(
    2,
    '/v2/foods/details/bls4/fixture-oats',
    {
      method: 'GET',
      params: { language: 'de' },
    }
  );
});

it('captures the same locale in each query key and its request', async () => {
  const germanSearch = searchFoodsV2Options('bls4', 'hafer');
  const germanDetails = foodDetailsV2Options('bls4', 'fixture-oats');
  i18n.resolvedLanguage = 'en';
  const englishSearch = searchFoodsV2Options('bls4', 'hafer');
  const englishDetails = foodDetailsV2Options('bls4', 'fixture-oats');
  expect(germanSearch.queryKey).not.toEqual(englishSearch.queryKey);
  expect(germanDetails.queryKey).not.toEqual(englishDetails.queryKey);
  expect(germanSearch.queryKey).toContain('provider-language-v1');
  expect(germanDetails.queryKey).toContain('provider-language-v1');
  await germanSearch.queryFn();
  await germanDetails.queryFn();
  expect(apiCall).toHaveBeenNthCalledWith(1, '/v2/foods/search/bls4', {
    method: 'GET',
    params: { query: 'hafer', language: 'de' },
  });
  expect(apiCall).toHaveBeenNthCalledWith(
    2,
    '/v2/foods/details/bls4/fixture-oats',
    {
      method: 'GET',
      params: { language: 'de' },
    }
  );
});

it('uses the app locale before resolvedLanguage is available', async () => {
  i18n.resolvedLanguage = undefined;
  await searchFoodsV2('bls4', 'hafer');
  expect(apiCall).toHaveBeenCalledWith('/v2/foods/search/bls4', {
    method: 'GET',
    params: { query: 'hafer', language: 'de-DE' },
  });
});
