import type { TFunction } from 'i18next';
import type { DailyProgressItem, Habit } from '@workspace/shared';
import type { WatchProgressItemPayload } from '../../modules/watch-connectivity';
import {
  progressActivityLabel,
  progressGoalLabel,
} from '../components/tracking/trackingLabels';

const icons: Record<DailyProgressItem['domain'], string> = {
  habit: 'checklist',
  meal: 'fork.knife',
  supplement: 'pills',
  measurement: 'scalemass',
  goal: 'target',
  activity: 'figure.run',
  workout: 'dumbbell',
  checkin: 'face.smiling',
};
/** System labels are translated; personal habit/food names remain literal. */
export function buildWatchProgressItems(
  items: readonly DailyProgressItem[],
  habits: readonly Habit[],
  meals: readonly { id: string; name: string }[],
  t: TFunction
): WatchProgressItemPayload[] {
  return items
    .filter((item) => item.state === 'pending' || item.state === 'started')
    .slice(0, 64)
    .map((item) => {
      const habit = habits.find((row) => row.id === item.reference_id);
      const label =
        (item.domain === 'activity' || item.domain === 'workout') &&
        item.activity_type
          ? progressActivityLabel(t, item.label, item.activity_type)
          : item.domain === 'goal'
            ? progressGoalLabel(t, item.label)
            : item.domain === 'checkin'
              ? t('progress.checkinItem', { defaultValue: 'Daily check-in' })
              : item.domain === 'measurement'
                ? item.label === 'weight'
                  ? t('progress.weighIn', { defaultValue: 'Weigh-in' })
                  : t('progress.measurement', { defaultValue: 'Measurement' })
                : item.domain === 'meal'
                  ? (meals.find((row) => row.id === item.reference_id)?.name ??
                    item.label)
                  : item.label;
      return {
        id: item.id,
        label,
        domain: item.domain,
        state: item.state,
        canComplete:
          item.applicable &&
          !!item.reference_id &&
          (item.domain === 'meal' ||
            (item.domain === 'habit' &&
              habit?.habit_type === 'completion' &&
              habit.active &&
              habit.category !== 'wellness')),
        ...(item.recorded_at ? { recordedAt: item.recorded_at } : {}),
        icon: icons[item.domain],
      };
    });
}
