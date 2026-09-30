import type { TFunction } from 'i18next';

/** Explicit keys keep every delivery state covered by the localization audit. */
export function notificationStatusLabels(t: TFunction) {
  return {
    kind: {
      hydration: t('notificationSettings.kind.hydration', {
        defaultValue: 'Hydration',
      }),
      meal_capture: t('notificationSettings.kind.meal_capture', {
        defaultValue: 'Meal capture',
      }),
      meal_review: t('notificationSettings.kind.meal_review', {
        defaultValue: 'Meal photo review',
      }),
      movement_break: t('notificationSettings.kind.movement_break', {
        defaultValue: 'Movement break',
      }),
      mobility: t('notificationSettings.kind.mobility', {
        defaultValue: 'Mobility',
      }),
      check_in: t('notificationSettings.kind.check_in', {
        defaultValue: 'Check-in',
      }),
      habit: t('notificationSettings.kind.habit', { defaultValue: 'Habit' }),
      weigh_in: t('notificationSettings.kind.weigh_in', {
        defaultValue: 'Weigh-in',
      }),
    },
    deliveryState: {
      pending: t('notificationSettings.deliveryState.pending', {
        defaultValue: 'Scheduled',
      }),
      claimed: t('notificationSettings.deliveryState.claimed', {
        defaultValue: 'Send claimed',
      }),
      sending: t('notificationSettings.deliveryState.sending', {
        defaultValue: 'Send pending',
      }),
      sent: t('notificationSettings.deliveryState.sent', {
        defaultValue: 'Push accepted',
      }),
      accepted: t('notificationSettings.deliveryState.accepted', {
        defaultValue: 'Push accepted',
      }),
      delivered: t('notificationSettings.deliveryState.delivered', {
        defaultValue: 'Receipt confirmed',
      }),
      failed: t('notificationSettings.deliveryState.failed', {
        defaultValue: 'Failed or unknown',
      }),
      cancelled: t('notificationSettings.deliveryState.cancelled', {
        defaultValue: 'Cancelled',
      }),
      skipped: t('notificationSettings.deliveryState.skipped', {
        defaultValue: 'Skipped',
      }),
    },
    reason: {
      disabled: t('notificationSettings.reason.disabled', {
        defaultValue: 'Disabled',
      }),
      paused: t('notificationSettings.reason.paused', {
        defaultValue: 'Optional reminders paused',
      }),
      resolved: t('notificationSettings.reason.resolved', {
        defaultValue: 'Already recorded or skipped',
      }),
      expired: t('notificationSettings.reason.expired', {
        defaultValue: 'Today’s time window has passed',
      }),
      scheduled: t('notificationSettings.reason.scheduled', {
        defaultValue:
          'Eligible at the configured time; quiet hours, spacing and the daily limit still apply',
      }),
      data_unavailable: t('notificationSettings.reason.data_unavailable', {
        defaultValue: 'Required data unavailable; no reminder inferred',
      }),
      local_delivery: t('notificationSettings.reason.local_delivery', {
        defaultValue: 'Scheduled on this phone; server delivery is off.',
      }),
      no_device: t('notificationSettings.reason.no_device', {
        defaultValue:
          'No reachable phone registered for this reminder. Open the app on your phone to reconnect.',
      }),
      daily_limit: t('notificationSettings.reason.daily_limit', {
        defaultValue: 'The daily reminder limit has been reached.',
      }),
      quiet_hours: t('notificationSettings.reason.quiet_hours', {
        defaultValue: 'Paused during quiet hours.',
      }),
      spacing: t('notificationSettings.reason.spacing', {
        defaultValue: 'Spaced away from another reminder.',
      }),
    },
  };
}
