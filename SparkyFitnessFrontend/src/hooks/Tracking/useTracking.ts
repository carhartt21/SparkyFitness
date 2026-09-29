import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SetMealDayStatusRequest } from '@workspace/shared';
import { dailyProgressKeys } from '@/api/keys/diary';
import {
  getDailyProgress,
  getMealTrackingStatus,
  setMealDayStatus,
} from '@/api/Tracking/trackingService';

// Both queries live under dailyProgressKeys.all, so the food, exercise and
// medication mutations that already invalidate that family refresh them.

export const useDailyTrackingProgress = (date: string, enabled = true) =>
  useQuery({
    queryKey: dailyProgressKeys.tracking(date),
    queryFn: () => getDailyProgress(date),
    enabled,
    meta: { errorMessage: 'Failed to load Daily Progress.' },
  });

export const useMealTrackingStatus = (date: string, enabled = true) =>
  useQuery({
    queryKey: dailyProgressKeys.mealStatus(date),
    queryFn: () => getMealTrackingStatus(date),
    enabled,
  });

export const useSetMealDayStatus = (date: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetMealDayStatusRequest) => setMealDayStatus(body),
    onSuccess: (status) => {
      queryClient.setQueryData(dailyProgressKeys.mealStatus(date), status);
      void queryClient.invalidateQueries({
        queryKey: dailyProgressKeys.tracking(date),
      });
    },
    meta: { errorMessage: 'Could not save the meal status.' },
  });
};
