import i18n from '../localization/i18n';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import type { ReminderCandidate } from './healthEngagementPolicy';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import { reconcileScheduledEngagementReminders } from './engagementReminderScheduler';
import { getTodayDate } from '../utils/dateUtils';
import { engagementNotificationCopy } from './engagementNotificationCopy';

const PREFIX = 'engagement:tracking:';
let initialized = false;
const handled = new Set<string>();
const inFlight = new Set<string>();

/** Where a tracking reminder leads. Opening it never records anything. */
export function trackingReminderUrl(candidateId: string): string | null {
  const [, kind, day] = candidateId.split(':');
  if (day !== getTodayDate()) return null;
  if (kind === 'checkin') return 'sparkyfitnessmobile://checkin';
  if (kind === 'habit') return 'sparkyfitnessmobile://habits';
  if (kind === 'measurement') return 'sparkyfitnessmobile://measurements';
  return null;
}

/** The sole owner of check-in, habit and measurement reminders. */
export function reconcileTrackingEngagementReminders(input: {
  identity: NutritionActionIdentity | null;
  candidates: ReminderCandidate[];
  enabled: boolean;
  /** Habit names by candidate ID, for the notification title. */
  habitNames: ReadonlyMap<string, string>;
}): Promise<void> {
  return reconcileScheduledEngagementReminders({
    identity: input.identity,
    candidates: input.candidates,
    enabled: input.enabled,
    prefix: PREFIX,
    accepts: (candidate) => candidate.domain === 'tracking',
    contentFor: (candidate) => {
      if (candidate.kind === 'checkin')
        return engagementNotificationCopy(i18n.t.bind(i18n), 'check_in');
      if (candidate.kind === 'measurement')
        return engagementNotificationCopy(i18n.t.bind(i18n), 'weigh_in');
      const copy = engagementNotificationCopy(i18n.t.bind(i18n), 'habit');
      const name = input.habitNames.get(candidate.id);
      return {
        ...copy,
        title: name ? `🌱 ${name}` : copy.title,
      };
    },
  });
}

export function initTrackingEngagementResponses(): void {
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
      typeof data.candidateId !== 'string' ||
      typeof data.serverConfigId !== 'string' ||
      typeof data.userId !== 'string'
    )
      return;
    const url = trackingReminderUrl(data.candidateId);
    if (!url) return;
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
      await Linking.openURL(url);
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
