import { apiFetch } from './apiClient';
import type {
  CreateHabitRequest,
  CreateHealthContextPeriodRequest,
  DailyCheckin,
  DailyProgress,
  DailyProgressDay,
  DailyTrackingPreferences,
  Habit,
  HabitLog,
  HealthContextPeriod,
  LogHabitRequest,
  MealTrackingStatus,
  MeasurementReminder,
  SaveDailyCheckinRequest,
  SetMealDayStatusRequest,
  UpdateDailyTrackingPreferencesRequest,
  UpdateHabitRequest,
  UpdateHealthContextPeriodRequest,
  UpsertMeasurementReminderRequest,
} from '@workspace/shared';

const SERVICE_NAME = 'Daily Tracking API';
const BASE = '/api/v2/tracking';

// --- Check-in ---------------------------------------------------------------

export const getDailyCheckin = (date: string) =>
  apiFetch<DailyCheckin | null>({
    endpoint: `${BASE}/checkins/${date}`,
    serviceName: SERVICE_NAME,
    operation: 'get daily check-in',
  });

export const listDailyCheckins = async (startDate: string, endDate: string) =>
  (await apiFetch<DailyCheckin[] | null>({
    endpoint: `${BASE}/checkins?start_date=${startDate}&end_date=${endDate}&include_activity=true`,
    serviceName: SERVICE_NAME,
    operation: 'list daily check-ins',
  })) ?? [];

export const saveDailyCheckin = (date: string, body: SaveDailyCheckinRequest) =>
  apiFetch<DailyCheckin>({
    endpoint: `${BASE}/checkins/${date}`,
    serviceName: SERVICE_NAME,
    operation: 'save daily check-in',
    method: 'PUT',
    body,
  });

export const skipDailyCheckin = (date: string) =>
  apiFetch<DailyCheckin>({
    endpoint: `${BASE}/checkins/${date}/skip`,
    serviceName: SERVICE_NAME,
    operation: 'skip daily check-in',
    method: 'POST',
  });

export const deleteDailyCheckin = (date: string) =>
  apiFetch<void>({
    endpoint: `${BASE}/checkins/${date}`,
    serviceName: SERVICE_NAME,
    operation: 'reopen daily check-in',
    method: 'DELETE',
  });

// --- Habits -------------------------------------------------------------------

export const listHabits = async (includeInactive = false) =>
  (await apiFetch<Habit[] | null>({
    endpoint: `${BASE}/habits${includeInactive ? '?include_inactive=true' : ''}`,
    serviceName: SERVICE_NAME,
    operation: 'list habits',
  })) ?? [];

export const createHabit = (body: CreateHabitRequest) =>
  apiFetch<Habit>({
    endpoint: `${BASE}/habits`,
    serviceName: SERVICE_NAME,
    operation: 'create habit',
    method: 'POST',
    body,
  });

export const updateHabit = (id: string, body: UpdateHabitRequest) =>
  apiFetch<Habit>({
    endpoint: `${BASE}/habits/${id}`,
    serviceName: SERVICE_NAME,
    operation: 'update habit',
    method: 'PUT',
    body,
  });

export const deleteHabit = (id: string) =>
  apiFetch<void>({
    endpoint: `${BASE}/habits/${id}`,
    serviceName: SERVICE_NAME,
    operation: 'delete habit',
    method: 'DELETE',
  });

export const listHabitLogs = async (
  startDate: string,
  endDate: string,
  habitId?: string
) =>
  (await apiFetch<HabitLog[] | null>({
    endpoint: `${BASE}/habit-logs?start_date=${startDate}&end_date=${endDate}${habitId ? `&habit_id=${habitId}` : ''}`,
    serviceName: SERVICE_NAME,
    operation: 'list habit logs',
  })) ?? [];

export const logHabit = (id: string, body: LogHabitRequest) =>
  apiFetch<HabitLog | null>({
    endpoint: `${BASE}/habits/${id}/logs`,
    serviceName: SERVICE_NAME,
    operation: 'log habit',
    method: 'PUT',
    body,
  });

// --- Context periods ------------------------------------------------------------

export const listHealthContextPeriods = async () =>
  (await apiFetch<HealthContextPeriod[] | null>({
    endpoint: `${BASE}/context-periods`,
    serviceName: SERVICE_NAME,
    operation: 'list context periods',
  })) ?? [];

export const createHealthContextPeriod = (
  body: CreateHealthContextPeriodRequest
) =>
  apiFetch<HealthContextPeriod>({
    endpoint: `${BASE}/context-periods`,
    serviceName: SERVICE_NAME,
    operation: 'create context period',
    method: 'POST',
    body,
  });

export const updateHealthContextPeriod = (
  id: string,
  body: UpdateHealthContextPeriodRequest
) =>
  apiFetch<HealthContextPeriod>({
    endpoint: `${BASE}/context-periods/${id}`,
    serviceName: SERVICE_NAME,
    operation: 'update context period',
    method: 'PUT',
    body,
  });

export const deleteHealthContextPeriod = (id: string) =>
  apiFetch<void>({
    endpoint: `${BASE}/context-periods/${id}`,
    serviceName: SERVICE_NAME,
    operation: 'delete context period',
    method: 'DELETE',
  });

// --- Measurement reminders ----------------------------------------------------------

export const listMeasurementReminders = async () =>
  (await apiFetch<MeasurementReminder[] | null>({
    endpoint: `${BASE}/measurement-reminders`,
    serviceName: SERVICE_NAME,
    operation: 'list measurement reminders',
  })) ?? [];

export const upsertMeasurementReminder = (
  body: UpsertMeasurementReminderRequest
) =>
  apiFetch<MeasurementReminder>({
    endpoint: `${BASE}/measurement-reminders`,
    serviceName: SERVICE_NAME,
    operation: 'save measurement reminder',
    method: 'PUT',
    body,
  });

// --- Meals, preferences and progress ----------------------------------------------

export const getMealTrackingStatus = (date: string) =>
  apiFetch<MealTrackingStatus>({
    endpoint: `${BASE}/meal-status/${date}`,
    serviceName: SERVICE_NAME,
    operation: 'get meal status',
  });

export const setMealDayStatus = (body: SetMealDayStatusRequest) =>
  apiFetch<MealTrackingStatus>({
    endpoint: `${BASE}/meal-status`,
    serviceName: SERVICE_NAME,
    operation: 'set meal status',
    method: 'PUT',
    body,
  });

export const getDailyTrackingPreferences = () =>
  apiFetch<DailyTrackingPreferences>({
    endpoint: `${BASE}/preferences`,
    serviceName: SERVICE_NAME,
    operation: 'get tracking preferences',
  });

export const updateDailyTrackingPreferences = (
  body: UpdateDailyTrackingPreferencesRequest
) =>
  apiFetch<DailyTrackingPreferences>({
    endpoint: `${BASE}/preferences`,
    serviceName: SERVICE_NAME,
    operation: 'update tracking preferences',
    method: 'PATCH',
    body,
  });

export const getDailyProgress = (date: string) =>
  apiFetch<DailyProgress>({
    endpoint: `${BASE}/daily-progress/${date}?version=2&include_activity=true`,
    serviceName: SERVICE_NAME,
    operation: 'get daily progress',
  });

/** Per-day Daily Progress states for a calendar range (at most 42 days). */
export const getDailyProgressRange = async (
  startDate: string,
  endDate: string
) =>
  (await apiFetch<DailyProgressDay[] | null>({
    endpoint: `${BASE}/daily-progress?start_date=${startDate}&end_date=${endDate}&version=2&include_activity=true`,
    serviceName: SERVICE_NAME,
    operation: 'get daily progress range',
  })) ?? [];
