import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activityPlanningResponseSchema,
  type ActivityResolutionRequest,
} from '@workspace/shared';
import { apiFetch } from '../services/api/apiClient';
import { dailyProgressRootQueryKey } from './queryKeys';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { NutritionActionIdentity } from '../services/nutritionActionOutbox';
import { useRefetchOnFocus } from './useRefetchOnFocus';
export function useActivityPlanning(
  from: string,
  to: string,
  enabled: boolean
) {
  const [identity, setIdentity] = useState<NutritionActionIdentity | null>(
    null
  );
  useEffect(() => {
    let live = true;
    let generation = 0;
    const refresh = () => {
      const request = ++generation;
      setIdentity(null);
      void getActiveNutritionIdentity()
        .then((value) => {
          if (live && generation === request) setIdentity(value);
        })
        .catch(() => {
          if (live && generation === request) setIdentity(null);
        });
    };
    const unsubscribe = subscribeNutritionIdentity(refresh);
    void getActiveNutritionIdentity()
      .then((value) => {
        if (live && generation === 0) setIdentity(value);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  const client = useQueryClient();
  const active = enabled && !!identity;
  const query = useQuery({
    queryKey: [
      ...dailyProgressRootQueryKey,
      'activityPlanning',
      identity?.serverConfigId,
      identity?.userId,
      from,
      to,
    ],
    enabled: active,
    staleTime: 30000,
    queryFn: async () => {
      if (!identity) throw new Error('Account identity unavailable.');
      return activityPlanningResponseSchema.parse(
        await apiFetch({
          endpoint: `/api/v2/activity-planning?start_date=${from}&end_date=${to}`,
          serviceName: 'Activity Planning',
          operation: 'read weekly activity',
          expectedIdentity: identity,
        })
      );
    },
  });
  useRefetchOnFocus(query.refetch, active);
  const mutation = useMutation({
    mutationFn: async (body: ActivityResolutionRequest) => {
      const current = await getActiveNutritionIdentity();
      if (
        !identity ||
        current?.serverConfigId !== identity.serverConfigId ||
        current.userId !== identity.userId
      )
        throw new Error('Account changed.');
      return activityPlanningResponseSchema.parse(
        await apiFetch({
          endpoint: '/api/v2/activity-planning',
          serviceName: 'Activity Planning',
          operation: 'resolve activity',
          expectedIdentity: identity,
          method: 'PUT',
          body,
        })
      );
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: dailyProgressRootQueryKey }),
  });
  return { query, mutation };
}
