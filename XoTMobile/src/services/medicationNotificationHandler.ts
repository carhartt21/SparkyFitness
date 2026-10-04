import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import {
  addNotificationResponseListener,
  dismissDeliveredNotification,
  MEDICATION_TAKEN_ACTION,
  MEDICATION_SKIP_ACTION,
  SUPPLEMENT_GROUP_CATEGORY,
  SUPPLEMENT_GROUP_REVIEW_ACTION,
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
import { medicationReminderTime } from './medicationReminderReservations';

let initialized = false;
const openedGroups = new Set<string>();
const openingGroups = new Set<string>();
let navigationReady = false;
let pendingGroupResponse: Notifications.NotificationResponse | null = null;

/** Delay cold-start links until the authenticated navigation tree can receive them. */
export function setSupplementReminderNavigationReady(ready: boolean): void {
  navigationReady = ready;
  if (!ready || !pendingGroupResponse) return;
  const pending = pendingGroupResponse;
  pendingGroupResponse = null;
  handleGroupResponse(pending);
}

/** Group actions only open the dated list; each intake remains an individual decision. */
async function openSupplementGroup(
  response: Notifications.NotificationResponse
): Promise<void> {
  const request = response.notification.request;
  const data = request.content.data;
  if (
    request.content.categoryIdentifier !== SUPPLEMENT_GROUP_CATEGORY ||
    ![
      Notifications.DEFAULT_ACTION_IDENTIFIER,
      SUPPLEMENT_GROUP_REVIEW_ACTION,
    ].includes(response.actionIdentifier) ||
    data?.isSupplement !== 'true' ||
    medicationReminderTime(data) === null ||
    typeof data.accountUserId !== 'string' ||
    typeof data.serverConfigId !== 'string'
  )
    return;
  const id = request.identifier;
  if (openedGroups.has(id) || openingGroups.has(id)) return;
  openingGroups.add(id);
  try {
    const identity = await getActiveNutritionIdentity();
    if (
      !identity ||
      identity.userId !== data.accountUserId ||
      identity.serverConfigId !== data.serverConfigId
    )
      return;
    if (!navigationReady) {
      pendingGroupResponse = response;
      return;
    }
    await Linking.openURL(
      `sparkyfitnessmobile://supplements?date=${data.entryDate}`
    );
    openedGroups.add(id);
    if (openedGroups.size > 128)
      openedGroups.delete(openedGroups.values().next().value!);
    if (
      Notifications.getLastNotificationResponse()?.notification.request
        .identifier === id
    )
      Notifications.clearLastNotificationResponse();
  } finally {
    openingGroups.delete(id);
  }
}

function handleGroupResponse(
  response: Notifications.NotificationResponse
): void {
  if (!navigationReady) {
    pendingGroupResponse = response;
    return;
  }
  void openSupplementGroup(response).catch(() => {
    addLog(
      '[MedicationNotificationAction] Could not open supplement reminder group',
      'WARNING'
    );
  });
}

export function initMedicationNotificationActions(): void {
  if (initialized) return;
  initialized = true;

  addNotificationResponseListener((response) => {
    if (
      response.notification.request.content.data?.supplementGroupVersion === '1'
    ) {
      handleGroupResponse(response);
      return;
    }
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
      data?.baseKey ?? data?.key ?? null,
      data?.accountUserId,
      data?.serverConfigId
    );
  });
  const initial = Notifications.getLastNotificationResponse();
  if (
    initial?.notification.request.content.data?.supplementGroupVersion === '1'
  )
    handleGroupResponse(initial);
}

async function clearMatchingReminders(
  key: string | null,
  accountUserId: string | undefined,
  serverConfigId: string | undefined
): Promise<void> {
  if (!key) return;
  const matches = (data: Record<string, unknown> | undefined) =>
    (data?.baseKey ?? data?.key) === key &&
    (!accountUserId || data?.accountUserId === accountUserId) &&
    (!serverConfigId || data?.serverConfigId === serverConfigId);

  // Cleanup is best effort after persistence. Native read failures must not make
  // an already saved intake look like a failed write or trigger a second write.
  const [pending, presented] = await Promise.all([
    Notifications.getAllScheduledNotificationsAsync().catch(() => []),
    Notifications.getPresentedNotificationsAsync().catch(() => []),
  ]);
  await Promise.all([
    ...pending
      .filter((notification) => matches(notification.content.data))
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(
          notification.identifier
        ).catch(() => {})
      ),
    ...presented
      .filter((notification) => matches(notification.request.content.data))
      .map((notification) =>
        Notifications.dismissNotificationAsync(
          notification.request.identifier
        ).catch(() => {})
      ),
  ]);
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
    await clearMatchingReminders(key, accountUserId, serverConfigId);
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
  key: string | null,
  accountUserId: string | undefined,
  serverConfigId: string | undefined
): Promise<void> {
  try {
    const existing = await listEntries({
      fromDate: entryDate,
      toDate: entryDate,
      medicationId,
    });
    if (isDoseLogged(existing, medicationId, scheduleId)) {
      await clearMatchingReminders(key, accountUserId, serverConfigId);
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

    await clearMatchingReminders(key, accountUserId, serverConfigId);

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
