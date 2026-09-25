import { useQuery } from '@tanstack/react-query';
import {
  buildDailySummary,
  loadDailySummaryRawData,
} from '../services/dailySummaryService';

import { useRefetchOnFocus } from './useRefetchOnFocus';
import { dailySummaryQueryKey } from './queryKeys';

export type { DailySummaryRawData } from '../services/dailySummaryService';

interface UseDailySummaryOptions {
  date: string;
  enabled?: boolean;
  /** Optional account scope for callers that can span an identity change. */
  scope?: string | null;
}

export function useDailySummary({
  date,
  enabled = true,
  scope,
}: UseDailySummaryOptions) {
  const query = useQuery({
    queryKey: scope
      ? [...dailySummaryQueryKey(date), scope]
      : dailySummaryQueryKey(date),
    queryFn: () => loadDailySummaryRawData(date),
    select: (raw) => buildDailySummary(date, raw),
    enabled,
  });

  useRefetchOnFocus(query.refetch, enabled);

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
