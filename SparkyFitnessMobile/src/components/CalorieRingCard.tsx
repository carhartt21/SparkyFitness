import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, useWindowDimensions } from 'react-native';
import { useCSSVariable } from 'uniwind';
import ProgressRing from './ProgressRing';
import Icon, { type IconName } from './Icon';
import { formatLocalizedNumber } from '../localization';

interface SideStatProps {
  icon: IconName;
  color: string;
  label: string;
  value: number | string;
}

const SideStat: React.FC<SideStatProps> = ({ label, value, icon, color }) => (
  <View className="flex-row items-center gap-2">
    <View className="w-7 items-center">
      <Icon name={icon} size={22} color={color} />
    </View>
    <View className="flex-1">
      <Text className="text-lg font-semibold text-text-primary">
        {typeof value === 'number'
          ? formatLocalizedNumber(Math.round(value))
          : value}
      </Text>
      <Text className="text-text-secondary text-xs">{label}</Text>
    </View>
  </View>
);

interface CalorieRingCardProps {
  caloriesConsumed: number;
  caloriesBurned: number;
  burnedIncludesBmr: boolean;
  calorieGoal: number;
  remainingCalories: number;
  progressPercent: number;
  children?: React.ReactNode;
}

const CalorieRingCard: React.FC<CalorieRingCardProps> = ({
  caloriesConsumed,
  caloriesBurned,
  burnedIncludesBmr,
  calorieGoal,
  remainingCalories,
  progressPercent,
  children,
}) => {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const expanded = fontScale > 1.3;
  const [
    progressTrackColor,
    progressFillColor,
    burnedColor,
    secondaryColor,
    separatorColor,
  ] = useCSSVariable([
    '--color-energy-track',
    '--color-calories',
    '--color-activity-energy',
    '--color-text-secondary',
    '--color-border-subtle',
  ]) as [string, string, string, string, string];

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
    <View
      accessibilityLabel={t('dashboard.dailyEnergy', {
        defaultValue: 'Daily energy',
      })}
      className="bg-surface rounded-2xl border border-border-subtle p-3 mb-3"
    >
      <View
        style={{ flexDirection: expanded ? 'column' : 'row', gap: 16 }}
        className="items-center"
      >
        <View className="relative items-center justify-center">
          {!expanded && (
            <ProgressRing
              progress={progressPercent}
              size={144}
              strokeWidth={10}
              color={progressFillColor}
              backgroundColor={progressTrackColor}
            />
          )}
          <View
            className="items-center justify-center"
            style={expanded ? undefined : { position: 'absolute', width: 116 }}
          >
            <Text className="text-[28px] font-bold text-text-primary">
              {formatLocalizedNumber(ringValue)}
            </Text>
            <Text className="text-text-secondary text-xs text-center">
              {hasGoal
                ? isOverTarget
                  ? t('dashboard.overTarget', { defaultValue: 'over target' })
                  : t('dashboard.remaining', { defaultValue: 'remaining' })
                : t('dashboard.consumed', { defaultValue: 'Consumed' })}
            </Text>
            <Text className="text-text-secondary text-xs">
              {t('dashboard.kcal', { defaultValue: 'kcal' })}
            </Text>
          </View>
        </View>
        <View
          className="gap-2"
          style={
            expanded
              ? { width: '100%' }
              : {
                  flex: 1,
                  borderLeftWidth: 1,
                  borderLeftColor: separatorColor,
                  paddingLeft: 12,
                }
          }
        >
          <SideStat
            icon="food"
            color={progressFillColor}
            label={t('dashboard.consumed', { defaultValue: 'Consumed' })}
            value={caloriesConsumed}
          />
          <SideStat
            icon="target"
            color={secondaryColor}
            label={t('dashboard.target', { defaultValue: 'Base target' })}
            value={hasGoal ? calorieGoal : '—'}
          />
          <SideStat
            icon="exercise"
            color={burnedColor}
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
      {children}
    </View>
  );
};

export default CalorieRingCard;
