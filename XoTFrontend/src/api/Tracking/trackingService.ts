import type {
  DailyProgress,
  MealTrackingStatus,
  SetMealDayStatusRequest,
} from '@workspace/shared';
import { apiCall } from '@/api/api';

export const getDailyProgress = (date: string): Promise<DailyProgress> =>
  apiCall(`/v2/tracking/daily-progress/${date}?include_activity=true`, {
    method: 'GET',
  });

export const getMealTrackingStatus = (
  date: string
): Promise<MealTrackingStatus> =>
  apiCall(`/v2/tracking/meal-status/${date}`, { method: 'GET' });

export const setMealDayStatus = (
  body: SetMealDayStatusRequest
): Promise<MealTrackingStatus> =>
  apiCall('/v2/tracking/meal-status', { method: 'PUT', body });
