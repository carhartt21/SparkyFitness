import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import type { ReminderCandidate } from './healthEngagementPolicy';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import {
  NUTRITION_CAPTURE_ACTION,
  NUTRITION_CAPTURE_CATEGORY,
  NUTRITION_REVIEW_ACTION,
  NUTRITION_REVIEW_CATEGORY,
} from './notifications';
import i18n from '../localization/i18n';
import { getTodayDate } from '../utils/dateUtils';
import { reconcileScheduledEngagementReminders } from './engagementReminderScheduler';

const PREFIX = 'engagement:nutrition:';
let initialized = false;
const handledResponses = new Set<string>();
const inFlightResponses = new Set<string>();

/** The sole owner of nutrition capture notifications. No other family is cancelled. */
export function reconcileNutritionEngagementReminders(input: {
  identity: NutritionActionIdentity | null;
  candidates: ReminderCandidate[];
  enabled: boolean;
}): Promise<void> {
  return reconcileScheduledEngagementReminders({
    ...input,
    prefix: PREFIX,
    accepts: (candidate) =>
      candidate.kind === 'capture' || candidate.kind === 'review',
    contentFor: (candidate) => {
      const isReview = candidate.kind === 'review';
      return {
        title: isReview
          ? i18n.t('engagement.reviewReminderTitle', {
              defaultValue: 'Meal photos to review',
            })
          : i18n.t('engagement.captureReminderTitle', {
              defaultValue: 'Meal check-in',
            }),
        body: isReview
          ? i18n.t('engagement.reviewReminderBody', {
              defaultValue: "Review today's meal photos when convenient.",
            })
          : i18n.t('engagement.captureReminderBody', {
              defaultValue: 'A photo is enough for now.',
            }),
        categoryIdentifier: isReview
          ? NUTRITION_REVIEW_CATEGORY
          : NUTRITION_CAPTURE_CATEGORY,
      };
    },
  });
}

/** Opening a camera records nothing. The normal photo flow owns durable save. */
export function initNutritionEngagementResponses(): void {
  if (initialized) return;
  initialized = true;
  const handle = async (response: Notifications.NotificationResponse) => {
    if (
      response.actionIdentifier !== NUTRITION_CAPTURE_ACTION &&
      response.actionIdentifier !== NUTRITION_REVIEW_ACTION &&
      response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
    )
      return;
    const request = response.notification.request;
    if (!request.identifier.startsWith(PREFIX)) return;
    const responseKey = `${request.identifier}:${response.actionIdentifier}`;
    if (handledResponses.has(responseKey) || inFlightResponses.has(responseKey))
      return;
    const data = request.content.data;
    const isCapture =
      data?.candidateId === `nutrition:capture:${getTodayDate()}:selected`;
    const isReview = data?.candidateId === `nutrition:review:${getTodayDate()}`;
    if (
      data?.version !== 1 ||
      typeof data.serverConfigId !== 'string' ||
      typeof data.userId !== 'string' ||
      (!isCapture && !isReview) ||
      (response.actionIdentifier === NUTRITION_CAPTURE_ACTION && !isCapture) ||
      (response.actionIdentifier === NUTRITION_REVIEW_ACTION && !isReview)
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
      await Linking.openURL(
        isReview
          ? 'sparkyfitnessmobile://diary'
          : 'sparkyfitnessmobile://meal-photo'
      );
      handledResponses.add(responseKey);
    } finally {
      inFlightResponses.delete(responseKey);
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
