import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useRefetchOnFocus } from './useRefetchOnFocus';
import { getTodayDate } from '../utils/dateUtils';
import { useQuery } from '@tanstack/react-query';
import { fetchActiveCaffeine } from '../services/api/caffeineApi';
import { caffeineActiveQueryKey } from './queryKeys';

/**
 * Active caffeine for a day, plus a clock that advances on its own.
 *
 * The circulating figure decays continuously, so a value fetched once is stale
 * within minutes. The doses come back from the server and the curve is
 * evaluated locally against `nowMs`, which ticks every 30 s — the same trade
 * the web card makes, and the reason the API ships doses rather than only
 * scalars.
 */
export function useCaffeineKinetics(date: string, enabled: boolean = true) {
  const query = useQuery({
    queryKey: caffeineActiveQueryKey(date),
    queryFn: () => fetchActiveCaffeine(date),
    enabled: Boolean(date) && enabled,
    staleTime: 30_000,
    refetchInterval: date === getTodayDate() && enabled ? 5 * 60_000 : false,
  });

  const { refetch } = query;
  useRefetchOnFocus(refetch, enabled);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const refreshClock = setTimeout(() => setNowMs(Date.now()), 0);
    const interval = setInterval(() => setNowMs(Date.now()), 30000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNowMs(Date.now());
        void refetch();
      }
    });
    return () => {
      clearTimeout(refreshClock);
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, date, refetch]);

  return {
    kinetics: query.data,
    nowMs,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
