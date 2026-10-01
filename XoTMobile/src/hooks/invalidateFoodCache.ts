import { addDays } from '@workspace/shared';
import type { QueryClient } from '@tanstack/react-query';
import {
  caffeineActiveQueryKey,
  caffeineActiveRootQueryKey,
  dailyProgressRootQueryKey,
  dailySummaryQueryKey,
  dailySummaryRootQueryKey,
  foodsQueryKey,
  waterIntakeLogQueryKey,
} from './queryKeys';

export function invalidateFoodCache(
  queryClient: QueryClient,
  entryDate?: string
) {
  void queryClient.invalidateQueries({ queryKey: dailyProgressRootQueryKey });
  if (entryDate) {
    void queryClient.invalidateQueries({
      queryKey: dailySummaryQueryKey(entryDate),
      refetchType: 'all',
    });
    // The server reads the selected day plus the preceding two calendar days.
    for (let offset = 0; offset <= 2; offset++) {
      void queryClient.invalidateQueries({
        queryKey: caffeineActiveQueryKey(addDays(entryDate, offset)),
        refetchType: 'all',
      });
    }
    void queryClient.invalidateQueries({
      queryKey: waterIntakeLogQueryKey(entryDate),
      refetchType: 'all',
    });
  } else {
    void queryClient.invalidateQueries({
      queryKey: dailySummaryRootQueryKey,
      refetchType: 'all',
    });
    void queryClient.invalidateQueries({
      queryKey: caffeineActiveRootQueryKey,
      refetchType: 'all',
    });
  }
  void queryClient.invalidateQueries({
    queryKey: [...foodsQueryKey],
  });
}
