import type { DailyProgressItem, Habit } from '@workspace/shared';
import type { IconName } from '../Icon';
import { habitIcon } from './habitIcons';

/** Use configured/category metadata, never guesses based on personal task names. */
export function progressTaskIcon(
  item: DailyProgressItem,
  habits: readonly Pick<Habit, 'id' | 'icon'>[]
): IconName {
  switch (item.domain) {
    case 'habit':
      return habitIcon(
        habits.find((habit) => habit.id === item.reference_id)?.icon ?? null
      );
    case 'measurement':
      return 'scale';
    case 'supplement':
      return 'medication';
    case 'meal':
      return 'food';
    case 'goal':
      return item.label === 'hydration'
        ? 'water'
        : item.label === 'activity_duration'
          ? 'exercise-running'
          : 'target';
    case 'workout':
      switch (item.activity_type) {
        case 'strength':
          return 'exercise-weights';
        case 'cycling':
          return 'exercise-cycling';
        case 'walking':
          return 'exercise-walking';
        case 'hiking':
          return 'exercise-hiking';
        case 'swimming':
          return 'exercise-swimming';
        case 'rowing':
          return 'exercise-rowing';
        case 'soccer':
          return 'exercise-soccer';
        case 'yoga':
          return 'exercise-yoga';
        case 'rest':
          return 'moon';
        default:
          return 'exercise-running';
      }
    case 'checkin':
      return 'daily-checkin';
  }
}
