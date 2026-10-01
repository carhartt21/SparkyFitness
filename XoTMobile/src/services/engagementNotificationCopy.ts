import type { EngagementReminderKindV2 } from '@workspace/shared';
import type { TFunction } from 'i18next';

/** Static keys/fallbacks are audited; the parity test checks the shared delivery copy. */
export function engagementNotificationCopy(
  t: TFunction,
  kind: EngagementReminderKindV2
) {
  switch (kind) {
    case 'check_in':
      return {
        title: t('engagement.checkinReminderTitle', {
          defaultValue: '📝 Your daily check-in',
        }),
        body: t('engagement.checkinReminderBody', {
          defaultValue: 'How are you today? A few details are enough.',
        }),
      };
    case 'habit':
      return {
        title: t('engagement.habitReminderTitle', {
          defaultValue: '🌱 Your habit',
        }),
        body: t('engagement.habitReminderBody', {
          defaultValue:
            'Already done? Record your planned habit when you are ready.',
        }),
      };
    case 'weigh_in':
      return {
        title: t('engagement.weighInReminderTitle', {
          defaultValue: '⚖️ Record your weight',
        }),
        body: t('engagement.weighInReminderBody', {
          defaultValue:
            'Would you like to record today’s weight? Open your check-in.',
        }),
      };
    case 'hydration':
      return {
        title: t('notifications.hydration.title', {
          defaultValue: '💧 Log a drink',
        }),
        body: t('notifications.hydration.body', {
          defaultValue:
            'Had something to drink? Record it when it works for you.',
        }),
      };
    case 'meal_capture':
      return {
        title: t('engagement.captureReminderTitle', {
          defaultValue: '🍽️ Your meal check-in',
        }),
        body: t('engagement.captureReminderBody', {
          defaultValue:
            'Have you eaten? Record your meal or take a photo. You can also mark “No meal”.',
        }),
      };
    case 'meal_review':
      return {
        title: t('engagement.reviewReminderTitle', {
          defaultValue: '📷 Review your meal photo',
        }),
        body: t('engagement.reviewReminderBody', {
          defaultValue:
            'Your meal photo is saved. Add the details when you have a moment.',
        }),
      };
    case 'movement_break':
      return {
        title: t('engagement.movementReminderTitle', {
          defaultValue: '🚶 A moment to move?',
        }),
        body: t('engagement.movementReminderBody', {
          defaultValue:
            'If it fits your day, open a short movement-break timer.',
        }),
      };
    case 'mobility':
      return {
        title: t('mobility.reminderTitle', {
          defaultValue: '🧘 Your mobility routine',
        }),
        body: t('mobility.reminderBody', {
          defaultValue:
            'Your planned routine is ready. Open it when it works for you.',
        }),
      };
  }
}
