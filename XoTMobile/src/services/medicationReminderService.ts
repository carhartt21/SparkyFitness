import * as Notifications from 'expo-notifications';
import i18n from '../localization/i18n';

import { addDays, getDeviceTimezone, getTodayDate } from '../utils/dateUtils';
import { getDueDosesForDate } from '@workspace/shared';
import {
  ensureMedicationReminderChannel,
  hasNotificationPermission,
  MEDICATION_REMINDER_CATEGORY,
  MEDICATION_REMINDER_CHANNEL_ID,
  SUPPLEMENT_GROUP_CATEGORY,
} from './notifications';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import type { MedicationDetail, MedicationEntry } from '@workspace/shared';
import { isDoseLogged } from '../utils/medications';
import { addLog } from './LogService';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import { listNutritionActions } from './nutritionActionOutbox';
import {
  groupSupplementReminders,
  isIntakeReminder,
  supplementGroupMembers,
  type IntakeReminderPlan,
} from './supplementReminderGroups';
import { medicationReminderTime } from './medicationReminderReservations';

const REPEAT_MINUTES = [10, 20, 30];
// iOS keeps only the 64 soonest pending notifications, so base reminders get a
// bounded lookahead and the repeat pings stay today-only.
const REMINDER_LOOKAHEAD_DAYS = 7;
let schedulingQueue: Promise<void> = Promise.resolve();

function medReminderKey(
  medicationId: string,
  scheduleId: string,
  date: string,
  timeOfDay: string
) {
  return `med_${date}_${medicationId}_${scheduleId}_${timeOfDay}`;
}

function repeatMedReminderKey(baseKey: string, offset: number) {
  return `${baseKey}_${offset}`;
}

async function cancelReminders(ids: string[]): Promise<Set<string>> {
  const cancelled = new Set<string>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
        cancelled.add(id);
      } catch {
        // An unconfirmed cancellation must never create another native request.
        addLog(
          'Intake reminder cancellation failed; replacement deferred',
          'WARNING'
        );
      }
    })
  );
  return cancelled;
}

async function scheduleReminder(
  body: string,
  triggerDate: Date,
  data: Record<string, string>
): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      // Native scheduling replaces this occurrence instead of appending a UUID
      // if a background/foreground pass receives a stale pending snapshot.
      identifier: `medication:${data.serverConfigId || 'local'}:${data.accountUserId}:${data.key}`,
      content: {
        title:
          data.supplementGroupVersion === '1'
            ? data.followUp === 'true'
              ? i18n.t('medications.notificationSupplementGroupRepeatTitle', {
                  defaultValue: '🌿 Supplement follow-up',
                })
              : i18n.t('medications.notificationSupplementGroupTitle', {
                  defaultValue: '🌿 {{count}} supplements',
                  defaultValue_one: '🌿 {{count}} supplement',
                  defaultValue_other: '🌿 {{count}} supplements',
                  count: Number(data.count),
                })
            : data.repeatNumber
              ? data.isSupplement === 'true'
                ? i18n.t('medications.notificationSupplementRepeatTitle', {
                    defaultValue: '🌿 Supplement · follow-up {{number}}',
                    number: data.repeatNumber,
                  })
                : i18n.t('medications.notificationRepeatTitle', {
                    defaultValue: '💊 Intake · follow-up {{number}}',
                    number: data.repeatNumber,
                  })
              : data.isSupplement === 'true'
                ? i18n.t('medications.notificationSupplementTitle', {
                    defaultValue: '🌿 Supplement reminder',
                  })
                : i18n.t('medications.notificationTitle', {
                    defaultValue: '💊 Medication reminder',
                  }),
        body,
        sound: true,
        categoryIdentifier:
          data.supplementGroupVersion === '1'
            ? SUPPLEMENT_GROUP_CATEGORY
            : MEDICATION_REMINDER_CATEGORY,
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: MEDICATION_REMINDER_CHANNEL_ID,
      },
    });
  } catch (err) {
    addLog(`scheduleReminder failed: ${(err as Error).message}`, 'ERROR');
    return null;
  }
}

/**
 * Reconcile medication reminder notifications.
 * Can be called from the foreground or background.
 *
 * Base reminders cover the next REMINDER_LOOKAHEAD_DAYS days so doses still
 * fire on days the app never wakes; repeat pings are today-only.
 *
 * Uses Notifications.getAllScheduledNotificationsAsync() instead of an
 * AsyncStorage ledger — every pending request already carries its content.data.
 *
 * @param medications - Active medications from the API
 * @param entries - Today's medication entries from the API
 */
export function reconcileMedicationReminders(
  medications: MedicationDetail[],
  entries: MedicationEntry[]
): Promise<void> {
  // Intake responses can arrive during a native read/cancel pass. Serialize the
  // existing owner instead of dropping the newer state while a pass is running.
  const task = schedulingQueue.then(() =>
    reconcileReminders(medications, entries)
  );
  schedulingQueue = task.catch(() => undefined);
  return task;
}

async function reconcileReminders(
  medications: MedicationDetail[],
  entries: MedicationEntry[]
): Promise<void> {
  const prefs = useAppPreferencesStore.getState();
  if (!prefs.medicationRemindersEnabled || !prefs.notificationsEnabled) {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const medIds = all
      .filter((n) => isIntakeReminder(n.content.data))
      .map((n) => n.identifier);
    if (medIds.length > 0) await cancelReminders(medIds);
    return;
  }

  const granted = await hasNotificationPermission();
  if (!granted) {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const medIds = all
      .filter((n) => isIntakeReminder(n.content.data))
      .map((n) => n.identifier);
    if (medIds.length > 0) await cancelReminders(medIds);
    return;
  }

  await ensureMedicationReminderChannel();

  const today = getTodayDate();
  const tz = getDeviceTimezone();
  const hideNames = prefs.medicationReminderHideNames;
  const reminderLocale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const identity = await getActiveNutritionIdentity().catch(() => null);
  let queuedSupplementOccurrences = new Set<string>();
  let supplementOutboxUnreadable = false;
  if (identity) {
    try {
      const actions = await listNutritionActions(identity);
      queuedSupplementOccurrences = new Set(
        actions
          .filter((action) => action.type === 'logPlannedSupplement')
          .map(
            (action) =>
              `${action.payload.schedule_id}:${action.payload.entry_date}`
          )
      );
    } catch (error) {
      supplementOutboxUnreadable = true;
      addLog(
        `Supplement reminder outbox unreadable: ${(error as Error).message}`,
        'ERROR'
      );
    }
  }

  const occurrenceKeys = new Set<string>();
  const dosesToSchedule: {
    due: ReturnType<typeof getDueDosesForDate<MedicationDetail>>[number];
    timeOfDay: string;
    date: string;
    withRepeats: boolean;
  }[] = [];

  for (let dayOffset = 0; dayOffset < REMINDER_LOOKAHEAD_DAYS; dayOffset++) {
    const date = addDays(today, dayOffset);
    const isToday = dayOffset === 0;

    for (const due of getDueDosesForDate(medications, date, tz)) {
      const timeOfDay = due.schedule.time_of_day;
      if (!timeOfDay) continue;
      if (
        due.medication.is_supplement === true &&
        // A supplement response must be durably queued for this exact account.
        // Without that identity the notification's action buttons cannot work.
        (!identity ||
          identity.userId !== due.medication.user_id ||
          supplementOutboxUnreadable ||
          queuedSupplementOccurrences.has(`${due.schedule.id}:${date}`))
      ) {
        continue;
      }

      // Entries only cover today; future doses can't have been logged yet.
      if (
        isToday &&
        isDoseLogged(entries, due.medication.id, due.schedule.id)
      ) {
        continue;
      }

      const baseKey = medReminderKey(
        due.medication.id,
        due.schedule.id,
        date,
        timeOfDay
      );
      // Duplicate API/cache representations are one occurrence. Different
      // schedule IDs remain separate even if their names and times match.
      if (occurrenceKeys.has(baseKey)) continue;
      occurrenceKeys.add(baseKey);

      const withRepeats = isToday && prefs.medicationReminderRepeats;

      dosesToSchedule.push({ due, timeOfDay, date, withRepeats });
    }
  }

  const plans: IntakeReminderPlan[] = [];

  for (const { due, timeOfDay, date, withRepeats } of dosesToSchedule) {
    const baseKey = medReminderKey(
      due.medication.id,
      due.schedule.id,
      date,
      timeOfDay
    );

    const [hours, minutes] = timeOfDay.split(':').map(Number);
    const doseSuffix =
      (due.schedule.dose_amount ?? due.medication.dose_amount) != null
        ? ` (${due.schedule.dose_amount ?? due.medication.dose_amount}${due.medication.dose_unit ? ` ${due.medication.dose_unit}` : ''})`
        : '';
    const body =
      due.medication.is_supplement === true
        ? hideNames
          ? i18n.t('medications.notificationSupplementDose', {
              defaultValue:
                'Record your planned supplement if you have taken it.',
            })
          : i18n.t('medications.notificationSupplementDoseNamed', {
              defaultValue: 'Your planned supplement: {{name}}{{dose}}',
              name: due.medication.name,
              dose: doseSuffix,
            })
        : hideNames
          ? i18n.t('medications.notificationScheduledDose', {
              defaultValue:
                'Record your scheduled intake if you have taken it.',
            })
          : i18n.t('medications.notificationScheduledDoseNamed', {
              defaultValue: 'Your scheduled intake: {{name}}{{dose}}',
              name: due.medication.name,
              dose: doseSuffix,
            });
    const data = {
      medicationId: due.medication.id,
      scheduleId: due.schedule.id,
      entryDate: date,
      key: baseKey,
      baseKey,
      hideNames: String(hideNames),
      locale: reminderLocale,
      responseVersion: '2',
      copyRevision: '20261001b',
      accountUserId: due.medication.user_id,
      serverConfigId: identity?.serverConfigId ?? '',
      isSupplement: due.medication.is_supplement === true ? 'true' : 'false',
    };

    const [year, month, day] = date.split('-').map(Number);
    const triggerDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const itemLabel = `${due.medication.name}${doseSuffix}`;
    plans.push({ body, triggerDate, data, itemLabel });

    // Checked per key, not per dose: enabling repeats mid-day must still add
    // the repeat pings behind an already-pending base reminder.
    if (withRepeats) {
      for (const offset of REPEAT_MINUTES) {
        const repeatKey = repeatMedReminderKey(baseKey, offset);
        const repeatDate = new Date(triggerDate.getTime() + offset * 60000);
        const repeatBody = hideNames
          ? i18n.t('medications.notificationRepeatBody', {
              defaultValue:
                'Already recorded? Check your scheduled intake status in the app.',
            })
          : i18n.t('medications.notificationRepeatNamed', {
              defaultValue:
                'Already recorded? Check the status of {{name}}{{dose}} in the app.',
              name: due.medication.name,
              dose: doseSuffix,
            });
        plans.push({
          body: repeatBody,
          triggerDate: repeatDate,
          itemLabel,
          data: {
            ...data,
            key: repeatKey,
            repeatNumber: String(REPEAT_MINUTES.indexOf(offset) + 1),
          },
        });
      }
    }
  }
  await reconcilePlans(groupSupplementReminders(plans));
}

async function reconcilePlans(plans: IntakeReminderPlan[]): Promise<void> {
  const desired = new Map(plans.map((plan) => [plan.data.key, plan]));
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const retained = new Set<string>();
  const toCancel = pending.filter((request) => {
    const data = request.content.data;
    if (!isIntakeReminder(data)) return false;
    const plan =
      typeof data?.key === 'string' ? desired.get(data.key) : undefined;
    if (!plan || !data) return true;
    const outdated =
      (data.hideNames === 'true') !== (plan.data.hideNames === 'true') ||
      (data.locale ?? 'en') !== plan.data.locale ||
      data.responseVersion !== plan.data.responseVersion ||
      data.copyRevision !== plan.data.copyRevision ||
      data.serverConfigId !== plan.data.serverConfigId ||
      data.accountUserId !== plan.data.accountUserId ||
      data.isSupplement !== plan.data.isSupplement ||
      data.supplementGroupVersion !== plan.data.supplementGroupVersion ||
      (plan.data.supplementGroupVersion === '1' &&
        (data.memberKeys !== plan.data.memberKeys ||
          data.followUp !== plan.data.followUp ||
          request.content.body !== plan.body));
    if (outdated || retained.has(plan.data.key)) return true;
    retained.add(plan.data.key);
    return false;
  });
  const cancelled = await cancelReminders(
    toCancel.map((request) => request.identifier)
  );
  const remaining = pending.filter(
    (request) =>
      isIntakeReminder(request.content.data) &&
      !cancelled.has(request.identifier)
  );
  const pendingKeys = new Set(
    remaining.map((request) => request.content.data?.key)
  );

  for (const plan of plans) {
    if (
      plan.triggerDate.getTime() <= Date.now() ||
      pendingKeys.has(plan.data.key)
    )
      continue;
    // Old individual requests and new groups have different identifiers. If a
    // cancellation failed, block any replacement that overlaps their occurrence
    // at this instant, rather than delivering both representations.
    if (plan.data.isSupplement === 'true') {
      const keys = supplementGroupMembers(plan.data) ?? [plan.data.key];
      const overlaps = remaining.some((request) => {
        const data = request.content.data;
        if (
          !data ||
          (data.accountUserId &&
            data.accountUserId !== plan.data.accountUserId) ||
          (data.serverConfigId &&
            data.serverConfigId !== plan.data.serverConfigId)
        )
          return false;
        const oldKeys = supplementGroupMembers(data) ?? [data.key];
        return (
          oldKeys.some((key) => keys.includes(String(key))) ||
          (data.supplementGroupVersion === '1' &&
            medicationReminderTime(data) === plan.triggerDate.getTime())
        );
      });
      if (overlaps) continue;
    }
    if (await scheduleReminder(plan.body, plan.triggerDate, plan.data))
      pendingKeys.add(plan.data.key);
  }
}
