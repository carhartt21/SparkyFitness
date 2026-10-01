import { invalidateFoodCache } from '../../src/hooks/invalidateFoodCache';
import {
  caffeineActiveQueryKey,
  caffeineActiveRootQueryKey,
  dailySummaryQueryKey,
  dailyProgressRootQueryKey,
  dailySummaryRootQueryKey,
  foodsQueryKey,
  waterIntakeLogQueryKey,
} from '../../src/hooks/queryKeys';
import { createTestQueryClient, type QueryClient } from './queryTestUtils';

describe('invalidateFoodCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test('invalidates day-specific queries and foods when entryDate is supplied', () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const testDate = '2026-09-18';

    invalidateFoodCache(queryClient, testDate);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: dailySummaryQueryKey(testDate),
      refetchType: 'all',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: caffeineActiveQueryKey(testDate),
      refetchType: 'all',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: waterIntakeLogQueryKey(testDate),
      refetchType: 'all',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [...foodsQueryKey],
    });

    invalidateSpy.mockRestore();
  });

  test('refreshes the residual window across month boundaries and daily objectives', () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    invalidateFoodCache(queryClient, '2026-09-30');
    for (const day of ['2026-09-30', '2026-10-01', '2026-10-02']) {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: caffeineActiveQueryKey(day),
        refetchType: 'all',
      });
    }
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: caffeineActiveQueryKey('2026-10-03'),
      refetchType: 'all',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: dailyProgressRootQueryKey,
    });
  });

  test('invalidates root summary, root caffeine, and foods when entryDate is omitted', () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    invalidateFoodCache(queryClient);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: dailySummaryRootQueryKey,
      refetchType: 'all',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: caffeineActiveRootQueryKey,
      refetchType: 'all',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [...foodsQueryKey],
    });

    invalidateSpy.mockRestore();
  });
});
