import * as Notifications from 'expo-notifications';
import { toLocalDateString } from '../utils/dateUtils';
import { supplementGroupMembers } from './supplementReminderGroups';

type ScheduledNotification = Pick<Notifications.NotificationRequest, 'content'>;

function occurrenceTime(key: string, entryDate: string): number | null {
  const time = /_(\d{2}):(\d{2})(?:_(10|20|30))?$/.exec(key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || !time) return null;
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return null;
  const [year, month, day] = entryDate.split('-').map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (toLocalDateString(date) !== entryDate) return null;
  return date.getTime() + Number(time[3] ?? 0) * 60_000;
}

/** Read individual and consolidated intake times, including midnight follow-ups. */
export function medicationReminderTime(
  data: Record<string, unknown> | undefined
): number | null {
  if (typeof data?.entryDate !== 'string') return null;
  if (data.supplementGroupVersion === '1') {
    const members = supplementGroupMembers(data);
    if (!members || typeof data.triggerAt !== 'string') return null;
    const declaredTime = Number(data.triggerAt);
    return Number.isFinite(declaredTime) &&
      members.every(
        (key) =>
          key.startsWith(`med_${data.entryDate}_`) &&
          occurrenceTime(key, String(data.entryDate)) === declaredTime
      )
      ? declaredTime
      : null;
  }
  if (
    typeof data.medicationId !== 'string' ||
    typeof data.scheduleId !== 'string'
  )
    return null;
  const baseKey =
    typeof data.baseKey === 'string'
      ? data.baseKey
      : typeof data.key === 'string'
        ? data.key
        : '';
  const key = typeof data.key === 'string' ? data.key : baseKey;
  if (
    key !== baseKey &&
    (!key.startsWith(baseKey) ||
      !/^_(10|20|30)$/.test(key.slice(baseKey.length)))
  )
    return null;
  return occurrenceTime(key, data.entryDate);
}

/** Reserve each firing instant once without changing the intake reminder owner. */
export function medicationReminderTimes(
  requests: ScheduledNotification[]
): number[] {
  return [
    ...new Set(
      requests.flatMap((request) => {
        const time = medicationReminderTime(request.content.data);
        return time === null ? [] : [time];
      })
    ),
  ].sort((a, b) => a - b);
}

export async function getMedicationReminderReservations(): Promise<number[]> {
  return medicationReminderTimes(
    await Notifications.getAllScheduledNotificationsAsync()
  );
}
