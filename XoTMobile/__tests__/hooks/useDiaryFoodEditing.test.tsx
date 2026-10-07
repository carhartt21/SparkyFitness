import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDiaryFoodEditing } from '../../src/hooks/useDiaryFoodEditing';
import { applyBulkFoodEntryAction } from '../../src/services/api/foodEntriesApi';
import type { FoodEntry } from '../../src/types/foodEntries';
jest.mock('../../src/services/api/foodEntriesApi', () => ({
  applyBulkFoodEntryAction: jest.fn(),
}));
const api = jest.mocked(applyBulkFoodEntryAction);
const food = { id: 'food-1', meal_type_id: 'breakfast' } as FoodEntry;
beforeEach(() => jest.clearAllMocks());
it('submits one bulk request during a repeated press and invalidates both dates', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  let finish!: () => void;
  api.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({ affectedCount: 1 } as Awaited<
            ReturnType<typeof applyBulkFoodEntryAction>
          >);
      })
  );
  const view = renderHook(() => useDiaryFoodEditing('2026-10-03'), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  act(() => view.result.current.toggleFoodSelection(food));
  let first!: Promise<void>;
  act(() => {
    first = view.result.current.runBulkAction('copy', '2026-10-04', 'lunch');
    void view.result.current.runBulkAction('copy', '2026-10-04', 'lunch');
  });
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith({
    ids: ['food-1'],
    action: 'copy',
    sourceDate: '2026-10-03',
    targetDate: '2026-10-04',
    targetMealTypeId: 'lunch',
  });
  await act(async () => {
    finish();
    await first;
  });
  expect(invalidate).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: ['dailySummary', '2026-10-03'] })
  );
  expect(invalidate).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: ['dailySummary', '2026-10-04'] })
  );
  expect(view.result.current.selectedFoodIds.size).toBe(0);
});
it('does not write when a single entry is dropped back on its current meal', () => {
  const client = new QueryClient();
  const view = renderHook(() => useDiaryFoodEditing('2026-10-03'), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  act(() => view.result.current.moveDroppedFood(food, 'breakfast'));
  expect(api).not.toHaveBeenCalled();
});
