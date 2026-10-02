import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { DailyProgressDomain, DailyProgressItem } from '@workspace/shared';
import {
  plannedActivityLabel,
  progressGoalLabel,
} from '../components/tracking/trackingLabels';
import { getMealTypeDisplayLabel } from '../utils/mealNutrition';
import { useMealTypes } from './useMealTypes';
import type { RootStackParamList } from '../types/navigation';

/** Check-in is an end-of-day reflection; it follows actionable daily tasks. */
export const PROGRESS_DOMAIN_ORDER: DailyProgressDomain[] = [
  'habit',
  'measurement',
  'supplement',
  'meal',
  'goal',
  'workout',
  'activity',
  'checkin',
];

export function nextProgressTasks(
  items: readonly DailyProgressItem[],
  limit = 3
): DailyProgressItem[] {
  return items
    .filter((item) => item.state === 'pending' || item.state === 'started')
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        PROGRESS_DOMAIN_ORDER.indexOf(a.item.domain) -
          PROGRESS_DOMAIN_ORDER.indexOf(b.item.domain) || a.index - b.index
    )
    .slice(0, limit)
    .map(({ item }) => item);
}

export function useProgressActions(date: string, onHydration: () => void) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const { mealTypes } = useMealTypes();
  const itemLabel = (item: DailyProgressItem): string => {
    if (item.domain === 'workout' && item.activity_type)
      return plannedActivityLabel(t, item.activity_type);
    if (item.domain === 'goal') return progressGoalLabel(t, item.label);
    if (item.domain === 'meal') {
      const type = mealTypes.find((type) => type.id === item.reference_id);
      return type ? getMealTypeDisplayLabel(type, t) : item.label;
    }
    if (item.domain === 'checkin')
      return t('progress.checkinItem', { defaultValue: 'Daily check-in' });
    if (item.domain === 'measurement' && item.label === 'weight')
      return t('progress.weighIn', { defaultValue: 'Weigh-in' });
    if (item.domain === 'measurement')
      return t('progress.measurement', { defaultValue: 'Measurement' });
    return item.label;
  };
  const openItem = (item: DailyProgressItem): void => {
    switch (item.domain) {
      case 'checkin':
        navigation.navigate('DailyCheckIn', { date });
        break;
      case 'habit':
        navigation.navigate('Habits', {
          date,
          habitId: item.reference_id ?? undefined,
        });
        break;
      case 'supplement':
        navigation.navigate('Supplements', {
          date,
          scheduleId: item.reference_id ?? undefined,
        });
        break;
      case 'activity':
        if (item.id.startsWith('mobility:'))
          navigation.navigate('GuidedMobility');
        else navigation.navigate('ExerciseReview', { date });
        break;
      case 'measurement':
        navigation.navigate('MeasurementsAdd', {
          date,
          measurementKey: item.label,
        });
        break;
      case 'workout':
        navigation.navigate('WorkoutPlans', {
          date,
          assignmentId: item.reference_id ?? undefined,
        });
        break;
      case 'goal':
        if (item.label === 'hydration') onHydration();
        else if (item.label === 'activity_duration')
          navigation.navigate('ExerciseReview', { date });
        else navigation.navigate('DailyNutritionDetails', { date });
        break;
      case 'meal':
        navigation.navigate('MealTypeDetail', {
          date,
          mealTypeId: item.reference_id ?? undefined,
          mealLabel: itemLabel(item),
        });
        break;
    }
  };
  return { itemLabel, openItem };
}
