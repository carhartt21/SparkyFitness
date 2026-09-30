import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import i18n from '../localization/i18n';
import { getTodayDate } from '../utils/dateUtils';
import { reconcileScheduledEngagementReminders } from './engagementReminderScheduler';
import type { ReminderCandidate } from './healthEngagementPolicy';
import { getMobilityState } from './mobilityRoutineStore';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import { getActiveNutritionIdentity } from './nutritionIdentity';

const PREFIX = 'engagement:mobility:';
const URL = 'sparkyfitnessmobile://guided-mobility';
let initialized = false;
const handled = new Set<string>();
const inFlight = new Set<string>();

export function reconcileMobilityEngagementReminders(input: {
  identity: NutritionActionIdentity | null;
  candidates: ReminderCandidate[];
  enabled: boolean;
}): Promise<void> {
  return reconcileScheduledEngagementReminders({
    ...input,
    prefix: PREFIX,
    accepts: (candidate) => candidate.kind === 'mobility',
    contentFor: () => ({
      title: i18n.t('mobility.reminderTitle', {
        defaultValue: 'Time for your mobility routine?',
      }),
      body: i18n.t('mobility.reminderBody', {
        defaultValue: 'Open your saved routine when it works for you.',
      }),
    }),
  });
}

/** A notification tap only opens the list; it cannot start or record movement. */
export function initMobilityEngagementResponses(): void {
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
    const prefix = `movement:mobility:${getTodayDate()}:`;
    if (!data.candidateId.startsWith(prefix)) return;
    const routineId = data.candidateId.slice(prefix.length);
    const identity = await getActiveNutritionIdentity();
    if (
      !identity ||
      identity.serverConfigId !== data.serverConfigId ||
      identity.userId !== data.userId
    )
      return;
    const state = await getMobilityState(identity);
    if (
      !state.routines.some(
        (routine) => routine.id === routineId && routine.reminderTime !== null
      )
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
