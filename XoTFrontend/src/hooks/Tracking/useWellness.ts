import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { addDays, recordWellnessActivity } from '@workspace/shared';
import {
  createHabit,
  listHabits,
  listHabitLogs,
  logHabit,
} from '@/api/Tracking/trackingService';
import { checkInKeys } from '@/api/keys/checkin';
import { dailyProgressKeys } from '@/api/keys/diary';
import { useActiveUser } from '@/contexts/ActiveUserContext';

export function useWellness(date: string) {
  const { t } = useTranslation();
  const { activeUserId, hasPermission, hasWritePermission } = useActiveUser();
  const queryClient = useQueryClient();
  const enabled = Boolean(activeUserId) && hasPermission('checkin');
  const canWrite = enabled && hasWritePermission('checkin');
  const rootKey = ['wellness', activeUserId] as const;
  const habits = useQuery({
    queryKey: [...rootKey, 'activities'],
    queryFn: listHabits,
    enabled,
  });
  const logs = useQuery({
    queryKey: [...rootKey, 'logs', date],
    queryFn: () => listHabitLogs(addDays(date, -29), date),
    enabled,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: rootKey }),
      queryClient.invalidateQueries({ queryKey: checkInKeys.all }),
      queryClient.invalidateQueries({ queryKey: dailyProgressKeys.all }),
    ]);
  };
  const save = useMutation({
    mutationFn: async (name: string) => {
      if (!canWrite) throw new Error('Check-in write permission required.');
      return recordWellnessActivity({
        name,
        date,
        habits: habits.data ?? [],
        create: createHabit,
        log: logHabit,
      });
    },
    onSettled: refresh,
    meta: {
      errorMessage: t(
        'wellness.saveFailed',
        'Could not save the activity. Please try again.'
      ),
    },
  });
  const remove = useMutation({
    mutationFn: async (activityId: string) => {
      if (!canWrite) throw new Error('Check-in write permission required.');
      return logHabit(activityId, { entry_date: date, value: null });
    },
    onSettled: refresh,
    meta: {
      errorMessage: t(
        'wellness.removeFailed',
        'Could not remove the activity. Please try again.'
      ),
    },
  });
  return { habits, logs, save, remove, enabled, canWrite };
}
