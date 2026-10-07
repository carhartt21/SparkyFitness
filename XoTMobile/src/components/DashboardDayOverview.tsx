import Button from './ui/Button';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { DailySummary } from '../types/dailySummary';
import { useMealTypes } from '../hooks/useMealTypes';
import {
  calculateMealNutrition,
  getFoodEntryMealTypeLabel,
  groupFoodEntriesByMealType,
} from '../utils/mealNutrition';
import { MEAL_CONFIG } from '../constants/meals';
import { formatLocalizedNumber } from '../localization';
import Icon, { type IconName } from './Icon';
import GlowCard from './ui/GlowCard';
import IconBadge from './ui/IconBadge';

interface GlanceChip {
  key: string;
  icon: IconName;
  color: string;
  title: string;
  value: string;
  onPress: () => void;
}

/**
 * "Today at a glance" from the reference: one chip per logged meal, plus
 * workout and water when the day has them. Every value is logged data.
 */
export default function DashboardDayOverview({
  summary,
  onOpenDiary,
  isToday = false,
  water,
  onOpenExercise,
  onOpenWater,
}: {
  summary: DailySummary;
  onOpenDiary: () => void;
  isToday?: boolean;
  /** Pre-formatted water total, shown only when water was logged. */
  water?: string | null;
  onOpenExercise?: () => void;
  onOpenWater?: () => void;
}) {
  const { t } = useTranslation();
  const { mealTypes } = useMealTypes({ includeReadOnly: true });
  const [link, green, food, training, hydration, secondary] = useCSSVariable([
    '--color-text-link',
    '--color-neon-green',
    '--color-action-food',
    '--color-action-training',
    '--color-hydration',
    '--color-text-secondary',
  ]) as string[];
  const kcal = t('dashboard.kcal', { defaultValue: 'kcal' });
  const groups = groupFoodEntriesByMealType(summary.foodEntries, mealTypes);

  const chips: GlanceChip[] = groups.map((group) => {
    const system = group.isSystem
      ? MEAL_CONFIG[group.name.toLowerCase()]
      : undefined;
    return {
      key: `meal:${group.mealTypeId ?? group.name}`,
      icon: system?.icon ?? 'meal-snack',
      color: food,
      title: getFoodEntryMealTypeLabel(group.entries[0], mealTypes, t),
      value: `${formatLocalizedNumber(
        Math.round(calculateMealNutrition(group.entries).values.calories)
      )} ${kcal}`,
      onPress: onOpenDiary,
    };
  });
  const exerciseCalories = summary.otherExerciseCalories ?? 0;
  const exerciseMinutes = summary.exerciseMinutes ?? 0;
  if (onOpenExercise && (exerciseCalories > 0 || exerciseMinutes > 0)) {
    chips.push({
      key: 'workout',
      icon: 'exercise-weights',
      color: training,
      title: t('dashboard.workout', { defaultValue: 'Workout' }),
      value:
        exerciseCalories > 0
          ? `${formatLocalizedNumber(Math.round(exerciseCalories))} ${kcal}`
          : `${formatLocalizedNumber(Math.round(exerciseMinutes))} ${t(
              'dashboard.minutesUnit',
              { defaultValue: 'min' }
            )}`,
      onPress: onOpenExercise,
    });
  }
  if (water && onOpenWater) {
    chips.push({
      key: 'water',
      icon: 'water',
      color: hydration,
      title: t('dashboard.water', { defaultValue: 'Water' }),
      value: water,
      onPress: onOpenWater,
    });
  }

  return (
    <GlowCard glowColor={green} className="p-3 mb-3">
      <Pressable
        accessibilityRole="button"
        onPress={onOpenDiary}
        className="min-h-11 flex-row items-center gap-2 mb-1"
      >
        <Icon name="list" size={20} color={secondary} />
        <Text className="flex-1 text-[17px] font-semibold text-text-primary">
          {isToday
            ? t('dashboard.todayOverview', {
                defaultValue: 'Today at a glance',
              })
            : t('dashboard.dayOverview', { defaultValue: 'Day at a glance' })}
        </Text>
        <Text className="text-xs font-medium text-text-link">
          {t('dashboard.viewAll', { defaultValue: 'View all' })}
        </Text>
        <Icon name="chevron-forward" size={14} color={link} />
      </Pressable>
      {chips.length === 0 ? (
        <Text className="text-sm text-text-secondary">
          {t('dashboard.noFoodLogged', {
            defaultValue: 'No food logged for this day.',
          })}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {chips.map((chip) => (
            <Button
              variant="secondary"
              key={chip.key}
              accessibilityRole="button"
              accessibilityLabel={`${chip.title}: ${chip.value}`}
              onPress={chip.onPress}
              className="min-h-14 flex-row items-center gap-2 py-2 pl-2 pr-3 active:opacity-70"
            >
              <IconBadge icon={chip.icon} color={chip.color} size={36} />
              <View>
                <Text className="text-xs font-semibold text-text-primary">
                  {chip.title}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {chip.value}
                </Text>
              </View>
            </Button>
          ))}
        </ScrollView>
      )}
      <Text className="text-[11px] text-text-secondary mt-2">
        {t('dashboard.loggedOnly', {
          defaultValue: 'Based on logged entries. Your day may be incomplete.',
        })}
      </Text>
    </GlowCard>
  );
}
