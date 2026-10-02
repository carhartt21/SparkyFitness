import type {
  CreateHabitRequest,
  Habit,
  HabitLog,
  LogHabitRequest,
  DailyProgress,
  MealTrackingStatus,
  SetMealDayStatusRequest,
} from '@workspace/shared';
import { apiCall } from '@/api/api';

export const listHabits = (): Promise<Habit[]> =>
  apiCall('/v2/tracking/habits', {
    method: 'GET',
    params: { include_inactive: true },
  });

export const createHabit = (body: CreateHabitRequest): Promise<Habit> =>
  apiCall('/v2/tracking/habits', { method: 'POST', body });

export const listHabitLogs = (
  startDate: string,
  endDate: string
): Promise<HabitLog[]> =>
  apiCall('/v2/tracking/habit-logs', {
    method: 'GET',
    params: { start_date: startDate, end_date: endDate },
  });

export const logHabit = (
  id: string,
  body: LogHabitRequest
): Promise<HabitLog | null> =>
  apiCall(`/v2/tracking/habits/${id}/logs`, { method: 'PUT', body });

export const getDailyProgress = (date: string): Promise<DailyProgress> =>
  apiCall(`/v2/tracking/daily-progress/${date}?version=2`, { method: 'GET' });

export const getMealTrackingStatus = (
  date: string
): Promise<MealTrackingStatus> =>
  apiCall(`/v2/tracking/meal-status/${date}`, { method: 'GET' });

export const setMealDayStatus = (
  body: SetMealDayStatusRequest
): Promise<MealTrackingStatus> =>
  apiCall('/v2/tracking/meal-status', { method: 'PUT', body });
