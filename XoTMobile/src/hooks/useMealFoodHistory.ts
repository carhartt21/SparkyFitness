import { nutritionIdentityGeneration } from '../services/nutritionIdentityLifecycle';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';
import {
  readMealFoodHistory,
  mealHistoryWindow,
} from '../services/mealFoodSuggestions';
import { getTodayDate } from '../utils/dateUtils';
import { mealFoodHistoryRootQueryKey } from './queryKeys';

export function useMealFoodHistory(
  userId: string | undefined,
  day: string | undefined,
  enabled: boolean
) {
  const [scope, setScope] = useState<{
    identity: NutritionActionIdentity;
    transportRevision: number;
  } | null>(null);
  useEffect(() => {
    let generation = 0;
    let disposed = false;
    const refresh = async () => {
      const current = ++generation;
      setScope(null);
      const transportRevision = nutritionIdentityGeneration();
      try {
        const next = await getActiveNutritionIdentity();
        if (
          !disposed &&
          generation === current &&
          transportRevision === nutritionIdentityGeneration()
        )
          setScope(
            next && next.userId === userId
              ? { identity: next, transportRevision }
              : null
          );
      } catch {
        /* Unknown scope keeps ordinary suggestions unchanged. */
      }
    };
    void refresh();
    const stop = subscribeNutritionIdentity(() => {
      void refresh();
    });
    return () => {
      disposed = true;
      stop();
    };
  }, [userId]);
  const window = mealHistoryWindow(day, getTodayDate());
  const current =
    scope &&
    scope.identity.userId === userId &&
    scope.transportRevision === nutritionIdentityGeneration()
      ? scope.identity
      : null;
  const query = useQuery({
    queryKey: [
      ...mealFoodHistoryRootQueryKey,
      current?.serverConfigId,
      current?.userId,
      window.start,
      window.end,
      scope?.transportRevision,
    ],
    queryFn: () => {
      if (!current) throw new Error('Unknown history identity');
      return readMealFoodHistory(current, window.start, window.end);
    },
    enabled: enabled && !!current,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return {
    entries: current && enabled && !query.isError ? (query.data ?? []) : [],
    ...window,
  };
}
