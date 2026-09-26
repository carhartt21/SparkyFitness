import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { DailySummary } from '../types/dailySummary';
import { useMealTypes } from '../hooks/useMealTypes';
import {
  calculateMealNutrition,
  getFoodEntryMealTypeLabel,
  groupFoodEntriesByMealType,
} from '../utils/mealNutrition';
import { formatLocalizedNumber } from '../localization';
import Icon from './Icon';

export default function DashboardDayOverview({
  summary,
  onOpenDiary,
}: {
  summary: DailySummary;
  onOpenDiary: () => void;
}) {
  const { t } = useTranslation();
  const { mealTypes } = useMealTypes();
  const color = useCSSVariable('--color-text-link') as string;
  const groups = groupFoodEntriesByMealType(summary.foodEntries, mealTypes);
  return (
    <View className="bg-surface rounded-2xl border border-border-subtle p-3 mb-3">
      <Pressable
        accessibilityRole="button"
        onPress={onOpenDiary}
        className="min-h-11 flex-row items-center justify-between gap-3 mb-1"
      >
        <Text className="text-base font-semibold text-text-primary flex-shrink">
          {t('dashboard.dayOverview', { defaultValue: 'Day at a glance' })}
        </Text>
        <Icon name="chevron-forward" size={18} color={color} />
      </Pressable>
      {groups.length === 0 ? (
        <Text className="text-sm text-text-secondary">
          {t('dashboard.noFoodLogged', {
            defaultValue: 'No food logged for this day.',
          })}
        </Text>
      ) : (
        groups.map((group) => (
          <Pressable
            key={group.mealTypeId ?? group.name}
            accessibilityRole="button"
            onPress={onOpenDiary}
            className="min-h-11 py-2 flex-row items-center gap-3 border-b border-border-subtle"
          >
            <View className="flex-1">
              <Text className="text-sm font-semibold text-text-primary">
                {getFoodEntryMealTypeLabel(group.entries[0], mealTypes, t)}
              </Text>
              <Text className="text-xs text-text-secondary" numberOfLines={2}>
                {group.entries
                  .map((entry) => entry.food_name)
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </View>
            <Text className="text-sm text-text-primary">
              {formatLocalizedNumber(
                Math.round(
                  calculateMealNutrition(group.entries).values.calories
                )
              )}{' '}
              {t('dashboard.kcal', { defaultValue: 'kcal' })}
            </Text>
          </Pressable>
        ))
      )}
      <Text className="text-xs text-text-secondary mt-3">
        {t('dashboard.loggedOnly', {
          defaultValue: 'Based on logged entries. Your day may be incomplete.',
        })}
      </Text>
    </View>
  );
}
