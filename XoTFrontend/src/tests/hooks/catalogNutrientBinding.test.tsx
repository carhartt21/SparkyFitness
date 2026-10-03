import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { customNutrientService } from '@/api/Foods/customNutrients';
import { customNutrientsKeys } from '@/api/keys/meals';
import { useEnsureCatalogNutrientsMutation } from '@/hooks/Foods/useCustomNutrients';

jest.mock('@/api/Foods/customNutrients', () => ({
  customNutrientService: { ensureCatalogNutrients: jest.fn() },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback ?? key,
  }),
}));

const bound = {
  id: 'nutrient-1',
  user_id: 'owner',
  name: 'Magnesium',
  unit: 'g',
  catalog_id: 'magnesium',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  aliases: [],
};
const setup = () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(customNutrientsKeys.all, [
    { ...bound, catalog_id: null },
  ]);
  client.setQueryData(['preferences', 'nutrients'], { goals: [] });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(() => useEnsureCatalogNutrientsMutation(), { wrapper }),
  };
};
beforeEach(() => jest.clearAllMocks());
it('refreshes a retained identity even when provisioning creates no new row', async () => {
  (customNutrientService.ensureCatalogNutrients as jest.Mock).mockResolvedValue(
    {
      resolved: [{ catalogId: 'magnesium', name: 'Magnesium' }],
      created: [],
      nutrients: [bound],
    }
  );
  const { client, result } = setup();
  await act(async () => {
    await result.current.mutateAsync(['magnesium']);
  });
  expect(client.getQueryData(customNutrientsKeys.all)).toEqual([bound]);
  expect(client.getQueryState(customNutrientsKeys.all)?.isInvalidated).toBe(
    true
  );
  expect(client.getQueryData(['preferences', 'nutrients'])).toEqual({
    goals: [],
  });
  await act(async () => {
    await result.current.mutateAsync(['magnesium']);
  });
  expect(client.getQueryData(customNutrientsKeys.all)).toEqual([bound]);
});
it('leaves the retained cache untouched on an incompatible-unit failure', async () => {
  (customNutrientService.ensureCatalogNutrients as jest.Mock).mockRejectedValue(
    new Error('incompatible unit')
  );
  const { client, result } = setup();
  const before = client.getQueryData(customNutrientsKeys.all);
  await act(async () => {
    await expect(result.current.mutateAsync(['magnesium'])).rejects.toThrow(
      'incompatible unit'
    );
  });
  expect(client.getQueryData(customNutrientsKeys.all)).toEqual(before);
  expect(client.getQueryState(customNutrientsKeys.all)?.isInvalidated).toBe(
    false
  );
});
