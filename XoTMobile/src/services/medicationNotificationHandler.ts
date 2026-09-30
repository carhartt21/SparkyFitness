import * as Notifications from 'expo-notifications';
import {
  addNotificationResponseListener,
  dismissDeliveredNotification,
  MEDICATION_TAKEN_ACTION,
  MEDICATION_SKIP_ACTION,
} from './notifications';
import { createEntry, listEntries } from './api/medicationsApi';
import { queryClient } from '../hooks/queryClient';
import { invalidateMedicationEntryCaches } from '../hooks/invalidateMedicationEntryCaches';
import { addLog } from '../services/LogService';
import type { MedicationEntryStatus } from '@workspace/shared';
import { isDoseLogged } from '../utils/medications';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import { enqueuePlannedSupplementAction } from './nutritionActionOutbox';
import { reconcileNutritionActions } from './nutritionActionSync';

let initialized = false;

export function initMedicationNotificationActions(): void {
  if (initialized) return;
  initialized = true;

  addNotificationResponseListener((response) => {
    const actionId = response.actionIdentifier;

    let status: MedicationEntryStatus | null = null;
    if (actionId === MEDICATION_TAKEN_ACTION) {
      status = 'taken';
    } else if (actionId === MEDICATION_SKIP_ACTION) {
      status = 'skipped';
    }

    if (!status) return;

    const content = response.notification.request.content;
    const data = content.data as Record<string, string | undefined>;
    const medicationId = data?.medicationId;
    const scheduleId = data?.scheduleId;
    const entryDate = data?.entryDate;

    if (!medicationId || !entryDate) {
      addLog(
        '[MedicationNotificationAction] Missing required data in notification',
        'WARNING'
      );
      return;
    }

    if (data?.isSupplement === 'true') {
      void handlePlannedSupplementAction(
        status,
        medicationId,
        scheduleId ?? null,
        entryDate,
        response.notification.request.identifier,
        data?.baseKey ?? data?.key ?? null,
        data?.accountUserId,
        data?.serverConfigId
      );
      return;
    }

    void handleNotificationAction(
      status,
      medicationId,
      scheduleId ?? null,
      entryDate,
      response.notification.request.identifier,
      data?.baseKey ?? data?.key ?? null
    );
  });
}

async function cancelMatchingReminders(key: string | null): Promise<void> {
  if (!key) return;
  const allPending = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = allPending.filter(
    (notification) => notification.content.data?.baseKey === key
  );
  await Promise.all(
    toCancel.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      ).catch(() => {})
    )
  );
}

async function handlePlannedSupplementAction(
  status: MedicationEntryStatus,
  medicationId: string,
  scheduleId: string | null,
  entryDate: string,
  notificationId: string,
  key: string | null,
  accountUserId: string | undefined,
  serverConfigId: string | undefined
): Promise<void> {
  try {
    const identity = await getActiveNutritionIdentity();
    if (
      !scheduleId ||
      !identity ||
      !accountUserId ||
      !serverConfigId ||
      identity.userId !== accountUserId ||
      identity.serverConfigId !== serverConfigId
    ) {
      addLog(
        '[MedicationNotificationAction] Supplement reminder does not match the active account',
        'WARNING'
      );
      return;
    }

    // Persist before dismissing the OS notification. Repeated taps reuse the
    // occurrence's operation ID, including after a lost server response.
    await enqueuePlannedSupplementAction({
      ...identity,
      medicationId,
      scheduleId,
      entryDate,
      status: status === 'taken' ? 'taken' : 'skipped',
      occurredAt: new Date().toISOString(),
    });
    await cancelMatchingReminders(key);
    await dismissDeliveredNotification(notificationId);
    void reconcileNutritionActions(queryClient).catch((error: unknown) => {
      addLog(
        `[MedicationNotificationAction] Supplement action remains queued: ${(error as Error).message}`,
        'WARNING'
      );
    });
  } catch (error) {
    addLog(
      `[MedicationNotificationAction] Failed to queue supplement action: ${(error as Error).message}`,
      'ERROR'
    );
  }
}

async function handleNotificationAction(
  status: MedicationEntryStatus,
  medicationId: string,
  scheduleId: string | null,
  entryDate: string,
  notificationId: string,
  key: string | null
): Promise<void> {
  try {
    const existing = await listEntries({
      fromDate: entryDate,
      toDate: entryDate,
      medicationId,
    });
    if (isDoseLogged(existing, medicationId, scheduleId)) {
      await dismissDeliveredNotification(notificationId);
      return;
    }

    await createEntry({
      medication_id: medicationId,
      schedule_id: scheduleId,
      status,
      entry_date: entryDate,
      taken_at: status === 'taken' ? new Date().toISOString() : undefined,
    });

    // This path writes the entry through the API directly rather than through the
    // mutations, so nothing else marks the caches stale. With an infinite stale time the
    // app can resume onto an already-focused dashboard, skip the focus refetch, and show
    // calories that do not include the dose the user just marked taken from the reminder.
    invalidateMedicationEntryCaches(queryClient);

    await cancelMatchingReminders(key);

    await dismissDeliveredNotification(notificationId);
    addLog(
      `[MedicationNotificationAction] Logged medication ${medicationId} as ${status}`,
      'DEBUG'
    );
  } catch (error) {
    addLog(
      `[MedicationNotificationAction] Failed to log medication: ${(error as Error).message}`,
      'ERROR'
    );
  }
}
