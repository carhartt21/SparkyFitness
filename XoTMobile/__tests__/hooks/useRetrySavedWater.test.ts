import { act, renderHook } from '@testing-library/react-native';
import { useRetrySavedWater } from '../../src/hooks/useRetrySavedWater';
const mockList = jest.fn();
const mockRetry = jest.fn();
const mockReconcile = jest.fn();
const identity = { serverConfigId: 'server-a', userId: 'owner-a' };
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: async () => identity,
}));
jest.mock('../../src/services/nutritionActionOutbox', () => ({
  listNutritionActions: (...args: unknown[]) => mockList(...args),
  retryNutritionAction: (...args: unknown[]) => mockRetry(...args),
}));
jest.mock('../../src/services/nutritionActionSync', () => ({
  reconcileNutritionActions: (...args: unknown[]) => mockReconcile(...args),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockRetry.mockResolvedValue(undefined);
  mockReconcile.mockResolvedValue(undefined);
});
it('retries only water needing attention on the selected day, in the active account', async () => {
  mockList.mockResolvedValue([
    {
      type: 'logManualWater',
      payload: { entry_date: '2026-10-05' },
      syncState: 'attentionRequired',
      clientOperationId: 'manual',
    },
    {
      type: 'logContainerWater',
      payload: { entry_date: '2026-10-05' },
      syncState: 'attentionRequired',
      clientOperationId: 'container',
    },
    {
      type: 'logManualWater',
      payload: { entry_date: '2026-10-04' },
      syncState: 'attentionRequired',
      clientOperationId: 'other-day',
    },
    {
      type: 'logManualWater',
      payload: { entry_date: '2026-10-05' },
      syncState: 'pending',
      clientOperationId: 'pending',
    },
    {
      type: 'createFoodEntry',
      payload: { entry_date: '2026-10-05' },
      syncState: 'attentionRequired',
      clientOperationId: 'food',
    },
  ]);
  const { result } = renderHook(() => useRetrySavedWater('2026-10-05'));
  await act(async () => {
    await result.current.retry();
  });
  expect(mockList).toHaveBeenCalledWith(identity);
  expect(mockRetry.mock.calls).toEqual([
    [identity, 'manual'],
    [identity, 'container'],
  ]);
  expect(mockReconcile).toHaveBeenCalledTimes(1);
  expect(result.current.retrying).toBe(false);
});
it('does not duplicate retries while a storage read is in flight and resets after failure', async () => {
  let reject!: (error: Error) => void;
  mockList.mockImplementation(
    () =>
      new Promise((_, rejectPromise) => {
        reject = rejectPromise;
      })
  );
  const { result } = renderHook(() => useRetrySavedWater('2026-10-05'));
  await act(async () => {
    const first = result.current.retry();
    await result.current.retry();
    await Promise.resolve();
    reject(new Error('Storage unavailable'));
    await first;
  });
  expect(mockList).toHaveBeenCalledTimes(1);
  expect(mockRetry).not.toHaveBeenCalled();
  expect(result.current.retrying).toBe(false);
});
