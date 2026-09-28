import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocalizedNumber } from '../localization';
import Icon from './Icon';
import DashboardSectionHeader from './DashboardSectionHeader';
import GlowCard from './ui/GlowCard';
import { View, Text, Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

interface ExerciseProgressCardProps {
  compact?: boolean;
  onLog?: () => void;
  onDetails?: () => void;
  exerciseMinutes: number;
  exerciseMinutesGoal: number;
  exerciseCalories: number;
  exerciseCaloriesGoal: number;
}

const ExerciseProgressCard: React.FC<ExerciseProgressCardProps> = ({
  compact = false,
  onLog,
  onDetails,
  exerciseMinutes,
  exerciseMinutesGoal,
  exerciseCalories,
  exerciseCaloriesGoal,
}) => {
  const { t } = useTranslation();
  const [exerciseColor, burnedColor] = useCSSVariable([
    '--color-exercise',
    '--color-activity-energy',
  ]) as [string, string];

  const hasEntries = exerciseMinutes > 0 || exerciseCalories > 0;

  if (compact)
    return (
      <GlowCard glowColor={exerciseColor} className="p-3 mb-3 w-full">
        <DashboardSectionHeader
          compact={compact}
          title={t('dashboard.exercise', { defaultValue: 'Exercise' })}
          icon="exercise-running"
          color={exerciseColor}
          onDetails={onDetails}
          testID="dashboard-exercise-details"
        />
        <View style={{ minHeight: 92 }}>
          <View className="flex-row items-center gap-2">
            <Icon name="clock" size={20} color={exerciseColor} />
            <Text className="text-xl font-bold text-text-primary flex-shrink">
              {formatLocalizedNumber(Math.round(exerciseMinutes))}
              <Text className="text-xs font-normal text-text-secondary">
                {exerciseMinutesGoal > 0
                  ? ` / ${formatLocalizedNumber(exerciseMinutesGoal)}`
                  : ''}{' '}
                {t('dashboard.minutesUnit', { defaultValue: 'min' })}
              </Text>
            </Text>
          </View>
          <View className="flex-row items-center gap-2 mt-1">
            <Icon name="exercise" size={20} color={burnedColor} />
            <Text className="text-sm text-text-secondary flex-shrink">
              {formatLocalizedNumber(Math.round(exerciseCalories))}
              {exerciseCaloriesGoal > 0
                ? ` / ${formatLocalizedNumber(exerciseCaloriesGoal)}`
                : ''}{' '}
              {t('dashboard.kcal', { defaultValue: 'kcal' })}
            </Text>
          </View>
          {!hasEntries && (
            <Text className="text-xs text-text-secondary mt-2">
              {t('dashboard.noExerciseEntries', {
                defaultValue: 'No exercise entries yet',
              })}
            </Text>
          )}
        </View>
        {onLog && (
          <Pressable
            accessibilityRole="button"
            onPress={onLog}
            className="min-h-11 mt-3 rounded-md bg-accent-primary px-2 justify-center items-center"
          >
            <Text className="text-sm font-semibold text-accent-text text-center">
              {t('dashboard.logExercise', { defaultValue: 'Log exercise' })}
            </Text>
          </Pressable>
        )}
      </GlowCard>
    );

  const stat = (
    value: number,
    unit: string,
    label: string,
    goal: number,
    testID: string
  ) => (
    <View className="flex-1" testID={testID}>
      <Text
        className="text-2xl font-bold text-text-primary"
        maxFontSizeMultiplier={1.6}
      >
        {formatLocalizedNumber(Math.round(value))}
        <Text className="text-base font-semibold"> {unit}</Text>
      </Text>
      <Text className="text-xs text-text-secondary" maxFontSizeMultiplier={1.8}>
        {goal > 0
          ? t('dashboard.statOfGoal', {
              defaultValue: '{{label}} · of {{goal}}',
              label,
              goal: formatLocalizedNumber(Math.round(goal)),
            })
          : label}
      </Text>
    </View>
  );

  return (
    <GlowCard glowColor={exerciseColor} className="p-3 mb-3">
      <DashboardSectionHeader
        compact={compact}
        title={t('dashboard.exercise', { defaultValue: 'Exercise' })}
        icon="exercise-running"
        color={exerciseColor}
        onDetails={onDetails}
        testID="dashboard-exercise-details"
      />
      {hasEntries ? (
        <View className="flex-row items-center gap-3 pl-1">
          {stat(
            exerciseCalories,
            t('dashboard.kcal', { defaultValue: 'kcal' }),
            t('dashboard.burnedToday', { defaultValue: 'burned' }),
            exerciseCaloriesGoal,
            'exercise-calories'
          )}
          <View className="w-px self-stretch bg-border-subtle" />
          {stat(
            exerciseMinutes,
            t('dashboard.minutesUnit', { defaultValue: 'min' }),
            t('dashboard.totalTime', { defaultValue: 'total time' }),
            exerciseMinutesGoal,
            'exercise-minutes'
          )}
        </View>
      ) : (
        <Text className="text-sm text-text-secondary py-2">
          {t('dashboard.noExerciseEntries', {
            defaultValue: 'No exercise entries yet',
          })}
        </Text>
      )}
      {onLog && (
        <Pressable
          accessibilityRole="button"
          onPress={onLog}
          className="min-h-11 mt-3 rounded-full bg-accent-primary px-2 justify-center items-center"
        >
          <Text className="text-sm font-semibold text-accent-text">
            {t('dashboard.logExercise', { defaultValue: 'Log exercise' })}
          </Text>
        </Pressable>
      )}
    </GlowCard>
  );
};

export default ExerciseProgressCard;
