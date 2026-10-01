import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createInstance } from 'i18next';
import de from '../../../public/locales/de/translation.json';
import en from '../../../public/locales/en/translation.json';
import { dailyProgressKeys, diaryReportKeys } from '@/api/keys/diary';
import { reportKeys } from '@/api/keys/reports';
import {
  useCreateMedicationMutation,
  useUpdateMedicationMutation,
  useDeleteMedicationMutation,
  useAddScheduleMutation,
  useCreateMedicationEntryMutation,
} from '@/hooks/useMedications';
import * as medicationService from '@/api/Medications/medicationService';

const mockI18n = createInstance();
beforeAll(async () => {
  await mockI18n.init({
    lng: 'de',
    fallbackLng: 'en',
    resources: { de: { translation: de }, en: { translation: en } },
  });
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockI18n.t.bind(mockI18n) }),
}));
jest.mock('@/api/Medications/medicationService', () => ({
  createMedication: jest.fn().mockResolvedValue({ is_supplement: true }),
  updateMedication: jest.fn().mockResolvedValue({ is_supplement: true }),
  deleteMedication: jest.fn().mockResolvedValue(undefined),
  addSchedule: jest.fn().mockResolvedValue({ id: 'schedule-1' }),
  createMedicationEntry: jest.fn().mockResolvedValue({ id: 'entry-1' }),
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const keys = [
    dailyProgressKeys.all,
    diaryReportKeys.nutritionTrends(),
    reportKeys.all,
    ['medications'],
  ];
  keys.forEach((key) => client.setQueryData(key, { stale: false }));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, keys, wrapper };
}

function expectRefreshed(
  client: QueryClient,
  keys: readonly (readonly unknown[])[]
) {
  keys.forEach((key) =>
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  );
}

it('refreshes supplement progress after an explicit category change without rewriting the patch', async () => {
  const { client, keys, wrapper } = setup();
  const { result } = renderHook(() => useUpdateMedicationMutation(), {
    wrapper,
  });
  const patch = { id: 'item-1', body: { is_supplement: true } };
  await act(async () => {
    await result.current.mutateAsync(patch);
  });
  expect(medicationService.updateMedication).toHaveBeenCalledWith(
    'item-1',
    patch.body
  );
  expectRefreshed(client, keys);
});

it('uses German, category-neutral feedback for a supplement save', async () => {
  const { client, keys, wrapper } = setup();
  const { result } = renderHook(() => useCreateMedicationMutation(), {
    wrapper,
  });
  await act(async () => {
    await result.current.mutateAsync({
      name: 'Vitamin D',
      is_supplement: true,
    });
  });
  expectRefreshed(client, keys);
  expect(client.getMutationCache().getAll()[0]?.meta).toMatchObject({
    successMessage: 'Eintrag hinzugefügt.',
    errorMessage: 'Eintrag konnte nicht hinzugefügt werden.',
  });
});

it('refreshes the derived supplement views after deletion and schedule changes', async () => {
  const deleted = setup();
  const deletion = renderHook(() => useDeleteMedicationMutation(), {
    wrapper: deleted.wrapper,
  });
  await act(async () => {
    await deletion.result.current.mutateAsync('item-1');
  });
  expectRefreshed(deleted.client, deleted.keys);

  const scheduled = setup();
  const schedule = renderHook(() => useAddScheduleMutation('item-1'), {
    wrapper: scheduled.wrapper,
  });
  await act(async () => {
    await schedule.result.current.mutateAsync({
      schedule_type_id: 'daily',
      time_of_day: '08:00',
    });
  });
  expectRefreshed(scheduled.client, scheduled.keys);
});

it('keeps supplement intake feedback translated and refreshes nutrition totals', async () => {
  const { client, keys, wrapper } = setup();
  const { result } = renderHook(() => useCreateMedicationEntryMutation(), {
    wrapper,
  });
  await act(async () => {
    await result.current.mutateAsync({
      medication_id: 'item-1',
      entry_date: '2026-10-01',
      status: 'taken',
    });
  });
  expectRefreshed(client, keys);
  expect(client.getMutationCache().getAll()[0]?.meta?.successMessage).toBe(
    'Einnahme erfasst.'
  );
});
