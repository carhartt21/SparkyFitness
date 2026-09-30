import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type {
  CreateHabitRequest,
  CreateHealthContextPeriodRequest,
  DailyCheckin,
  HabitLog,
  LogHabitRequest,
  MealTrackingStatus,
  SaveDailyCheckinRequest,
  SetMealDayStatusRequest,
  UpdateDailyTrackingPreferencesRequest,
  UpdateHabitRequest,
  UpdateHealthContextPeriodRequest,
  UpsertMeasurementReminderRequest,
} from '@workspace/shared';
import {
  createHabit,
  createHealthContextPeriod,
  deleteDailyCheckin,
  deleteHabit,
  deleteHealthContextPeriod,
  getDailyCheckin,
  listDailyCheckins,
  getDailyProgress,
  getDailyProgressRange,
  getDailyTrackingPreferences,
  getMealTrackingStatus,
  listHabitLogs,
  listHabits,
  listHealthContextPeriods,
  listMeasurementReminders,
  logHabit,
  saveDailyCheckin,
  setMealDayStatus,
  skipDailyCheckin,
  updateDailyTrackingPreferences,
  updateHabit,
  updateHealthContextPeriod,
  upsertMeasurementReminder,
} from '../services/api/dailyTrackingApi';
import {
  dailyCheckinQueryKey,
  dailyCheckinsRangeQueryKey,
  dailyCheckinsRangeRootQueryKey,
  dailyProgressQueryKey,
  dailyProgressRangeQueryKey,
  dailyProgressRootQueryKey,
  dailyTrackingPreferencesQueryKey,
  habitLogsQueryKey,
  habitLogsRootQueryKey,
  habitsQueryKey,
  habitsRootQueryKey,
  healthContextQueryKey,
  mealTrackingStatusQueryKey,
  measurementRemindersQueryKey,
} from './queryKeys';
import { useRefetchOnFocus } from './useRefetchOnFocus';

interface QueryOptions {
  enabled?: boolean;
}

/**
 * Progress and meal status also move when foods, doses or measurements change
 * elsewhere, so they are refetched on focus and after a short stale window
 * instead of relying on every mutation in the app to invalidate them.
 */
const DERIVED_STALE_MS = 30_000;

function invalidateProgress(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: dailyProgressRootQueryKey });
}

// --- Daily check-in -------------------------------------------------------------

export function useDailyCheckin(date: string, options?: QueryOptions) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: dailyCheckinQueryKey(date),
    // A day without a check-in comes back as an empty body; keep it null.
    queryFn: async () => (await getDailyCheckin(date)) ?? null,
    enabled,
  });
  useRefetchOnFocus(query.refetch, enabled);
  return query;
}

export function useDailyCheckinsRange(
  startDate: string,
  endDate: string,
  options?: QueryOptions
) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: dailyCheckinsRangeQueryKey(startDate, endDate),
    queryFn: () => listDailyCheckins(startDate, endDate),
    enabled,
  });
  useRefetchOnFocus(query.refetch, enabled);
  return query;
}

export function useSaveDailyCheckin(date: string) {
  const queryClient = useQueryClient();
  const onSaved = (checkin: DailyCheckin | null) => {
    queryClient.setQueryData(dailyCheckinQueryKey(date), checkin);
    void queryClient.invalidateQueries({
      queryKey: dailyCheckinsRangeRootQueryKey,
    });
    invalidateProgress(queryClient);
  };
  const save = useMutation({
    mutationFn: (body: SaveDailyCheckinRequest) => saveDailyCheckin(date, body),
    onSuccess: onSaved,
  });
  const skip = useMutation({
    mutationFn: () => skipDailyCheckin(date),
    onSuccess: onSaved,
  });
  const reopen = useMutation({
    mutationFn: () => deleteDailyCheckin(date),
    onSuccess: () => onSaved(null),
  });
  return { save, skip, reopen };
}

// --- Habits ---------------------------------------------------------------------

export function useHabits(
  options?: QueryOptions & { includeInactive?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const includeInactive = options?.includeInactive ?? false;
  const query = useQuery({
    queryKey: habitsQueryKey(includeInactive),
    queryFn: () => listHabits(includeInactive),
    enabled,
  });
  useRefetchOnFocus(query.refetch, enabled);
  return query;
}

export function useHabitLogs(
  startDate: string,
  endDate: string,
  options?: QueryOptions & { habitId?: string }
) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: habitLogsQueryKey(startDate, endDate, options?.habitId),
    queryFn: () => listHabitLogs(startDate, endDate, options?.habitId),
    enabled,
  });
  useRefetchOnFocus(query.refetch, enabled);
  return query;
}

function invalidateHabits(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: habitsRootQueryKey });
  void queryClient.invalidateQueries({ queryKey: habitLogsRootQueryKey });
  invalidateProgress(queryClient);
}

export function useHabitMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => invalidateHabits(queryClient);
  return {
    create: useMutation({
      mutationFn: (body: CreateHabitRequest) => createHabit(body),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: UpdateHabitRequest }) =>
        updateHabit(id, body),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteHabit(id),
      onSuccess,
    }),
  };
}

/**
 * Saves an explicit habit value. The log list is updated optimistically so the
 * row reflects the tap at once; a failure restores the previous logs.
 */
export function useLogHabit(startDate: string, endDate: string) {
  const queryClient = useQueryClient();
  const key = habitLogsQueryKey(startDate, endDate);
  return useMutation({
    mutationFn: ({
      habitId,
      body,
    }: {
      habitId: string;
      body: LogHabitRequest;
    }) => logHabit(habitId, body),
    onMutate: async ({ habitId, body }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<HabitLog[]>(key);
      const others = (previous ?? []).filter(
        (log) =>
          !(log.habit_id === habitId && log.entry_date === body.entry_date)
      );
      const next =
        body.value === null
          ? others
          : [
              ...others,
              {
                habit_id: habitId,
                entry_date: body.entry_date,
                value:
                  typeof body.value === 'boolean'
                    ? Number(body.value)
                    : body.value,
                recorded_at: new Date().toISOString(),
              },
            ];
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: habitLogsRootQueryKey });
      invalidateProgress(queryClient);
    },
  });
}

// --- Health context ----------------------------------------------------------------

export function useHealthContextPeriods(options?: QueryOptions) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: healthContextQueryKey,
    queryFn: listHealthContextPeriods,
    enabled,
  });
  useRefetchOnFocus(query.refetch, enabled);
  return query;
}

export function useHealthContextMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    void queryClient.invalidateQueries({ queryKey: healthContextQueryKey });
  return {
    create: useMutation({
      mutationFn: (body: CreateHealthContextPeriodRequest) =>
        createHealthContextPeriod(body),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        body,
      }: {
        id: string;
        body: UpdateHealthContextPeriodRequest;
      }) => updateHealthContextPeriod(id, body),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteHealthContextPeriod(id),
      onSuccess,
    }),
  };
}

// --- Measurement reminders and preferences -------------------------------------------

export function useMeasurementReminders(options?: QueryOptions) {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: measurementRemindersQueryKey,
    queryFn: listMeasurementReminders,
    enabled,
  });
}

export function useSaveMeasurementReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertMeasurementReminderRequest) =>
      upsertMeasurementReminder(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: measurementRemindersQueryKey,
      });
      invalidateProgress(queryClient);
    },
  });
}

export function useDailyTrackingPreferences(options?: QueryOptions) {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: dailyTrackingPreferencesQueryKey,
    queryFn: getDailyTrackingPreferences,
    enabled,
  });
}

export function useUpdateDailyTrackingPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDailyTrackingPreferencesRequest) =>
      updateDailyTrackingPreferences(body),
    onSuccess: (preferences) => {
      queryClient.setQueryData(dailyTrackingPreferencesQueryKey, preferences);
      invalidateProgress(queryClient);
    },
  });
}

// --- Meal status and Daily Progress ------------------------------------------------

export function useMealTrackingStatus(date: string, options?: QueryOptions) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: mealTrackingStatusQueryKey(date),
    queryFn: () => getMealTrackingStatus(date),
    enabled,
    staleTime: DERIVED_STALE_MS,
  });
  useRefetchOnFocus(query.refetch, enabled);
  return query;
}

export function useSetMealStatus(date: string) {
  const queryClient = useQueryClient();
  const key = mealTrackingStatusQueryKey(date);
  return useMutation({
    mutationFn: (body: SetMealDayStatusRequest) => setMealDayStatus(body),
    onSuccess: (status: MealTrackingStatus) => {
      queryClient.setQueryData(key, status);
      invalidateProgress(queryClient);
    },
  });
}

export function useDailyProgress(date: string, options?: QueryOptions) {
  const enabled = options?.enabled ?? true;
  const query = useQuery({
    queryKey: dailyProgressQueryKey(date),
    queryFn: () => getDailyProgress(date),
    enabled,
    staleTime: DERIVED_STALE_MS,
  });
  useRefetchOnFocus(query.refetch, enabled);
  return query;
}

/** One bounded read for a calendar month; never one request per day. */
export function useDailyProgressRange(
  startDate: string,
  endDate: string,
  options?: QueryOptions
) {
  return useQuery({
    queryKey: dailyProgressRangeQueryKey(startDate, endDate),
    queryFn: () => getDailyProgressRange(startDate, endDate),
    enabled: options?.enabled ?? true,
    staleTime: DERIVED_STALE_MS,
  });
}
