import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import type { ReminderCandidate } from './healthEngagementPolicy';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import { addLog } from './LogService';
import {
  hasNotificationPermission,
  NUTRITION_CAPTURE_ACTION,
  NUTRITION_CAPTURE_CATEGORY,
} from './notifications';
import i18n from '../localization/i18n';
import { getTodayDate } from '../utils/dateUtils';

const PREFIX = 'engagement:nutrition:';
let queue: Promise<void> = Promise.resolve();
let initialized = false;
const handledResponses = new Set<string>();
const inFlightResponses = new Set<string>();

function scopedIdentifier(
  identity: NutritionActionIdentity,
  candidate: ReminderCandidate
): string {
  return `${PREFIX}${encodeURIComponent(identity.serverConfigId)}:${encodeURIComponent(identity.userId)}:${candidate.id}`;
}

/** The sole owner of nutrition capture notifications. No other family is cancelled. */
export function reconcileNutritionEngagementReminders(input: {
  identity: NutritionActionIdentity | null;
  candidates: ReminderCandidate[];
  enabled: boolean;
}): Promise<void> {
  const task = queue.then(async () => {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const owned = pending.filter((item) => item.identifier.startsWith(PREFIX));
    const permitted =
      input.enabled &&
      input.identity !== null &&
      (await hasNotificationPermission());
    const desired = new Map<string, ReminderCandidate>();
    if (permitted && input.identity) {
      for (const candidate of input.candidates) {
        if (
          candidate.kind === 'capture' &&
          candidate.preferredAt > Date.now()
        ) {
          desired.set(scopedIdentifier(input.identity, candidate), candidate);
        }
      }
    }
    const desiredIds = new Set(desired.keys());
    for (const item of owned) {
      const candidate = desired.get(item.identifier);
      const scheduledAt = item.content.data?.scheduledAt;
      if (!candidate || scheduledAt !== candidate.preferredAt) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      } else {
        desired.delete(item.identifier);
      }
    }
    // A local save should clear an already delivered capture prompt too.
    // Keep cancellation within this feature's namespace and active scope.
    const delivered = await Notifications.getPresentedNotificationsAsync();
    for (const item of delivered) {
      const identifier = item.request.identifier;
      if (identifier.startsWith(PREFIX) && !desiredIds.has(identifier)) {
        await Notifications.dismissNotificationAsync(identifier);
      }
    }
    if (!permitted || !input.identity) return;
    for (const [identifier, candidate] of desired) {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: i18n.t('engagement.captureReminderTitle', {
            defaultValue: 'Meal check-in',
          }),
          body: i18n.t('engagement.captureReminderBody', {
            defaultValue: 'A photo is enough for now.',
          }),
          categoryIdentifier: NUTRITION_CAPTURE_CATEGORY,
          data: {
            version: 1,
            serverConfigId: input.identity.serverConfigId,
            userId: input.identity.userId,
            candidateId: candidate.id,
            scheduledAt: candidate.preferredAt,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(candidate.preferredAt),
        },
      });
    }
  });
  queue = task.catch((error: unknown) => {
    addLog(
      `[NutritionEngagement] Reminder reconciliation failed: ${error instanceof Error ? error.name : 'unknown'}`,
      'ERROR'
    );
  });
  return task;
}

/** Opening a camera records nothing. The normal photo flow owns durable save. */
export function initNutritionEngagementResponses(): void {
  if (initialized) return;
  initialized = true;
  const handle = async (response: Notifications.NotificationResponse) => {
    if (
      response.actionIdentifier !== NUTRITION_CAPTURE_ACTION &&
      response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
    )
      return;
    const request = response.notification.request;
    if (!request.identifier.startsWith(PREFIX)) return;
    const responseKey = `${request.identifier}:${response.actionIdentifier}`;
    if (handledResponses.has(responseKey) || inFlightResponses.has(responseKey))
      return;
    const data = request.content.data;
    if (
      data?.version !== 1 ||
      typeof data.serverConfigId !== 'string' ||
      typeof data.userId !== 'string' ||
      data.candidateId !== `nutrition:capture:${getTodayDate()}:selected`
    )
      return;
    const identity = await getActiveNutritionIdentity();
    if (
      !identity ||
      identity.serverConfigId !== data.serverConfigId ||
      identity.userId !== data.userId
    )
      return;
    if (handledResponses.has(responseKey) || inFlightResponses.has(responseKey))
      return;
    inFlightResponses.add(responseKey);
    try {
      await Linking.openURL('sparkyfitnessmobile://meal-photo');
      handledResponses.add(responseKey);
    } finally {
      inFlightResponses.delete(responseKey);
    }
  };
  Notifications.addNotificationResponseReceivedListener((response) => {
    void handle(response).catch(() => undefined);
  });
  const initial = Notifications.getLastNotificationResponse();
  if (initial) {
    Notifications.clearLastNotificationResponse();
    void handle(initial).catch(() => undefined);
  }
}
