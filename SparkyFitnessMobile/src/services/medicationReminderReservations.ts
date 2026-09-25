import * as Notifications from 'expo-notifications';
import { toLocalDateString } from '../utils/dateUtils';

type ScheduledNotification = Pick<Notifications.NotificationRequest, 'content'>;

/** Read scheduled dose times without changing the medication reminder owner. */
export function medicationReminderTimes(
  requests: ScheduledNotification[]
): number[] {
  const times = new Set<number>();
  for (const request of requests) {
    const data = request.content.data;
    if (
      typeof data?.medicationId !== 'string' ||
      typeof data.scheduleId !== 'string' ||
      typeof data.entryDate !== 'string'
    )
      continue;

    const baseKey =
      typeof data.baseKey === 'string'
        ? data.baseKey
        : typeof data.key === 'string'
          ? data.key
          : '';
    const time = /_(\d{2}):(\d{2})$/.exec(baseKey);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.entryDate) || !time) continue;
    const hour = Number(time[1]);
    const minute = Number(time[2]);
    if (hour > 23 || minute > 59) continue;
    const [year, month, day] = data.entryDate.split('-').map(Number);
    const date = new Date(year, month - 1, day, hour, minute);
    if (toLocalDateString(date) !== data.entryDate) continue;

    const key = typeof data.key === 'string' ? data.key : baseKey;
    const offset =
      key === baseKey
        ? 0
        : /^_(10|20|30)$/.test(key.slice(baseKey.length)) &&
            key.startsWith(baseKey)
          ? Number(key.slice(baseKey.length + 1))
          : null;
    if (offset === null) continue;
    times.add(date.getTime() + offset * 60_000);
  }
  return [...times].sort((a, b) => a - b);
}

export async function getMedicationReminderReservations(): Promise<number[]> {
  return medicationReminderTimes(
    await Notifications.getAllScheduledNotificationsAsync()
  );
}
