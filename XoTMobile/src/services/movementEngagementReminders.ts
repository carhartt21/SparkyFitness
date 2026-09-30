import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import type { ReminderCandidate } from './healthEngagementPolicy';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import { reconcileScheduledEngagementReminders } from './engagementReminderScheduler';
import { getTodayDate } from '../utils/dateUtils';
import i18n from '../localization/i18n';

const PREFIX = 'engagement:movement:';
const URL = 'sparkyfitnessmobile://movement-break';
let initialized = false;
const handled = new Set<string>();
const inFlight = new Set<string>();

export function reconcileMovementEngagementReminders(input: {
  identity: NutritionActionIdentity | null;
  candidates: ReminderCandidate[];
  enabled: boolean;
}): Promise<void> {
  return reconcileScheduledEngagementReminders({
    ...input,
    prefix: PREFIX,
    accepts: (candidate) => candidate.kind === 'move',
    contentFor: () => ({
      title: i18n.t('engagement.movementReminderTitle', {
        defaultValue: 'Time for a movement break?',
      }),
      body: i18n.t('engagement.movementReminderBody', {
        defaultValue: 'Open a short timer if this works for you.',
      }),
    }),
  });
}

/** Opening the timer never records movement or starts a session. */
export function initMovementEngagementResponses(): void {
  if (initialized) return;
  initialized = true;
  const handle = async (response: Notifications.NotificationResponse) => {
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER)
      return;
    const request = response.notification.request;
    if (!request.identifier.startsWith(PREFIX)) return;
    const key = `${request.identifier}:${response.actionIdentifier}`;
    if (handled.has(key) || inFlight.has(key)) return;
    const data = request.content.data;
    if (
      data?.version !== 1 ||
      data.candidateId !== `movement:break:${getTodayDate()}` ||
      typeof data.serverConfigId !== 'string' ||
      typeof data.userId !== 'string'
    )
      return;
    const identity = await getActiveNutritionIdentity();
    if (
      !identity ||
      identity.serverConfigId !== data.serverConfigId ||
      identity.userId !== data.userId
    )
      return;
    if (handled.has(key) || inFlight.has(key)) return;
    inFlight.add(key);
    try {
      await Linking.openURL(URL);
      handled.add(key);
    } finally {
      inFlight.delete(key);
    }
  };
  Notifications.addNotificationResponseReceivedListener((response) => {
    void handle(response).catch(() => undefined);
  });
  const initial = Notifications.getLastNotificationResponse();
  if (initial?.notification.request.identifier.startsWith(PREFIX)) {
    Notifications.clearLastNotificationResponse();
    void handle(initial).catch(() => undefined);
  }
}
