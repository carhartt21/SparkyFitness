import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchWorkoutPlans,
  saveWorkoutPlan,
  deleteWorkoutPlan,
  type WorkoutPlanWrite,
} from '../services/api/workoutPlansApi';
import { useRefetchOnFocus } from './useRefetchOnFocus';
import {
  dailyProgressRootQueryKey,
  dailySummaryRootQueryKey,
} from './queryKeys';

export function useWorkoutPlans(enabled = true) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['workoutPlanTemplates', 'list'],
    queryFn: fetchWorkoutPlans,
    enabled,
    staleTime: 30_000,
  });
  useRefetchOnFocus(query.refetch, enabled);
  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['workoutPlanTemplates'] }),
      client.invalidateQueries({ queryKey: ['exerciseReview'] }),
      client.invalidateQueries({ queryKey: dailyProgressRootQueryKey }),
      client.invalidateQueries({ queryKey: dailySummaryRootQueryKey }),
    ]);
  };
  const save = useMutation({
    mutationFn: ({ data, id }: { data: WorkoutPlanWrite; id?: string }) =>
      saveWorkoutPlan(data, id),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: deleteWorkoutPlan,
    onSuccess: invalidate,
  });
  return { ...query, save, remove };
}
