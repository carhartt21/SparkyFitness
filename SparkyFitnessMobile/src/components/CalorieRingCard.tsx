import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { useCSSVariable } from 'uniwind';
import ProgressRing from './ProgressRing';
import { formatLocalizedNumber } from '../localization';

interface SideStatProps {
  label: string;
  value: number | string;
}

const SideStat: React.FC<SideStatProps> = ({ label, value }) => (
  <View className="items-center justify-center flex-1">
    <Text className="text-xl font-bold text-text-primary">
      {typeof value === 'number'
        ? formatLocalizedNumber(Math.round(value))
        : value}
    </Text>
    <Text className="text-text-secondary text-xs mt-1">{label}</Text>
  </View>
);

interface CalorieRingCardProps {
  caloriesConsumed: number;
  caloriesBurned: number;
  burnedIncludesBmr: boolean;
  calorieGoal: number;
  remainingCalories: number;
  progressPercent: number;
}

const CalorieRingCard: React.FC<CalorieRingCardProps> = ({
  caloriesConsumed,
  caloriesBurned,
  burnedIncludesBmr,
  calorieGoal,
  remainingCalories,
  progressPercent,
}) => {
  const { t } = useTranslation();
  const [progressTrackColor, progressFillColor] = useCSSVariable([
    '--color-progress-track',
    '--color-calories',
  ]) as [string, string];

  const hasGoal = calorieGoal > 0;
  const isOverTarget = hasGoal && remainingCalories < 0;
  const ringValue = hasGoal
    ? Math.abs(Math.round(remainingCalories))
    : Math.round(caloriesConsumed);
  // This is the server balance's effective adjustment, which can differ from
  // total energy burned when only part of exercise is credited to the budget.
  const balanceAdjustment = hasGoal
    ? Math.round(remainingCalories - (calorieGoal - caloriesConsumed))
    : 0;

  return (
    <View className="bg-surface rounded-2xl border border-border-subtle p-4 mb-3">
      <Text className="text-lg font-bold text-text-primary mb-3">
        {t('dashboard.dailyEnergy', { defaultValue: 'Daily energy' })}
      </Text>
      <View className="items-center">
        <View className="relative items-center justify-center">
          <View>
            <ProgressRing
              progress={progressPercent}
              size={160}
              strokeWidth={12}
              color={progressFillColor}
              backgroundColor={progressTrackColor}
            />
          </View>
          <View className="absolute items-center justify-center">
            <Text className="text-2xl font-bold text-text-primary">
              {formatLocalizedNumber(ringValue)}
            </Text>
            <Text className="text-text-secondary text-xs">
              {hasGoal
                ? isOverTarget
                  ? t('dashboard.overTarget', { defaultValue: 'over target' })
                  : t('dashboard.remaining', { defaultValue: 'remaining' })
                : t('dashboard.consumed', { defaultValue: 'Consumed' })}
            </Text>
            <Text className="text-text-muted text-xs mt-0.5">
              {t('dashboard.kcal', { defaultValue: 'kcal' })}
            </Text>
          </View>
        </View>
      </View>
      <View className="flex-row items-start mt-4 border-t border-border-subtle pt-4">
        <SideStat
          label={t('dashboard.consumed', { defaultValue: 'Consumed' })}
          value={caloriesConsumed}
        />
        <SideStat
          label={t('dashboard.target', { defaultValue: 'Target' })}
          value={hasGoal ? calorieGoal : '—'}
        />
        <SideStat
          label={
            burnedIncludesBmr
              ? t('dashboard.totalExpenditure', {
                  defaultValue: 'Total expenditure',
                })
              : t('dashboard.activityBurned', {
                  defaultValue: 'Activity burned',
                })
          }
          value={caloriesBurned}
        />
      </View>
      {balanceAdjustment !== 0 && (
        <Text className="mt-3 text-center text-xs text-text-secondary">
          {t('dashboard.balanceAdjustment', {
            defaultValue: 'Allowance adjustment',
          })}{' '}
          {balanceAdjustment > 0 ? '+' : '−'}
          {formatLocalizedNumber(Math.abs(balanceAdjustment))}{' '}
          {t('dashboard.kcal', { defaultValue: 'kcal' })}
        </Text>
      )}
    </View>
  );
};

export default CalorieRingCard;
