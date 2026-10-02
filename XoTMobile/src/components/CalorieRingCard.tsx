import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useCSSVariable } from 'uniwind';
import EnergyGauge from './EnergyGauge';
import Icon, { type IconName } from './Icon';
import GlowCard from './ui/GlowCard';
import IconBadge from './ui/IconBadge';
import { formatLocalizedNumber } from '../localization';

interface StatRowProps {
  icon: IconName;
  color: string;
  label: string;
  value: number | null;
  unit: string;
  onPress?: () => void;
  testID?: string;
  last?: boolean;
}

const StatRow: React.FC<StatRowProps> = ({
  icon,
  color,
  label,
  value,
  unit,
  onPress,
  testID,
  last,
}) => {
  const chevron = useCSSVariable('--color-text-muted') as string;
  const shown = value == null ? '—' : formatLocalizedNumber(Math.round(value));
  const content = (
    <>
      <IconBadge icon={icon} color={color} size={38} />
      <View className="flex-1">
        <Text
          className="text-xs text-text-secondary"
          maxFontSizeMultiplier={1.8}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {label}
        </Text>
        <Text
          className="text-lg font-bold text-text-primary"
          maxFontSizeMultiplier={1.6}
        >
          {shown}
          {value == null ? null : (
            <Text className="text-xs font-medium text-text-secondary">
              {' '}
              {unit}
            </Text>
          )}
        </Text>
      </View>
      {onPress ? (
        <Icon name="chevron-forward" size={14} color={chevron} />
      ) : null}
    </>
  );
  const className = `min-h-14 flex-row items-center gap-3 py-2 ${
    last ? '' : 'border-b border-border-subtle'
  }`;
  return onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${shown} ${value == null ? '' : unit}`.trim()}
      onPress={onPress}
      className={`${className} active:opacity-70`}
    >
      {content}
    </Pressable>
  ) : (
    <View testID={testID} className={className}>
      {content}
    </View>
  );
};

interface CalorieRingCardProps {
  caloriesConsumed: number;
  caloriesBurned: number;
  burnedIncludesBmr: boolean;
  calorieGoal: number;
  remainingCalories: number;
  progressPercent: number;
  onEditGoal?: () => void;
  onConsumedPress?: () => void;
  onBurnedPress?: () => void;
}

/**
 * The reference's Calories card: a 270° energy gauge with the remaining
 * balance, and consumed / burned / goal rows that open their real details.
 */
const CalorieRingCard: React.FC<CalorieRingCardProps> = ({
  caloriesConsumed,
  caloriesBurned,
  burnedIncludesBmr,
  calorieGoal,
  remainingCalories,
  progressPercent,
  onEditGoal,
  onConsumedPress,
  onBurnedPress,
}) => {
  const { t } = useTranslation();
  const { fontScale, width } = useWindowDimensions();
  const expanded = fontScale > 1.3;
  const [flame, food, burn, neutral, cardGlow] = useCSSVariable([
    '--color-activity-energy',
    '--color-action-food',
    '--color-neon-green',
    '--color-text-secondary',
    '--color-card-glow',
  ]) as string[];

  const hasGoal = calorieGoal > 0;
  const isOverTarget = hasGoal && remainingCalories < 0;
  const centerValue = hasGoal
    ? Math.abs(Math.round(remainingCalories))
    : Math.round(caloriesConsumed);
  // This is the server balance's effective adjustment, which can differ from
  // total energy burned when only part of exercise is credited to the budget.
  const balanceAdjustment = hasGoal
    ? Math.round(remainingCalories - (calorieGoal - caloriesConsumed))
    : 0;
  const kcal = t('dashboard.kcal', { defaultValue: 'kcal' });
  const gaugeSize = Math.min(168, Math.max(132, Math.round(width * 0.4)));

  return (
    <GlowCard
      glowColor={cardGlow}
      accessibilityLabel={t('dashboard.dailyEnergy', {
        defaultValue: 'Daily energy',
      })}
      className="p-4 mb-3"
    >
      <View className="mb-1 flex-row items-center gap-3">
        <Icon name="flame" size={24} color={flame} />
        <View className="flex-1">
          <Text
            className="text-lg font-semibold text-text-primary"
            accessibilityRole="header"
            maxFontSizeMultiplier={1.8}
          >
            {t('dashboard.calories', { defaultValue: 'Calories' })}
          </Text>
        </View>
      </View>
      <View
        style={{ flexDirection: expanded ? 'column' : 'row', gap: 12 }}
        className={expanded ? 'items-center' : 'items-start'}
      >
        <View className="items-center">
          <View className="items-center justify-center">
            {!expanded && (
              <EnergyGauge
                progress={hasGoal ? progressPercent : 0}
                size={gaugeSize}
                strokeWidth={14}
              />
            )}
            <View
              className="items-center justify-center"
              style={
                expanded
                  ? undefined
                  : { position: 'absolute', width: gaugeSize - 40, top: 32 }
              }
            >
              <Text
                className="text-[32px] font-bold text-text-primary"
                maxFontSizeMultiplier={1.6}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatLocalizedNumber(centerValue)}
              </Text>
              <Text
                className="text-sm font-medium text-text-primary"
                maxFontSizeMultiplier={1.8}
              >
                {kcal}
              </Text>
              <Text
                className="text-text-secondary text-xs text-center"
                maxFontSizeMultiplier={1.8}
              >
                {hasGoal
                  ? isOverTarget
                    ? t('dashboard.overTarget', { defaultValue: 'over target' })
                    : t('dashboard.remaining', { defaultValue: 'remaining' })
                  : t('dashboard.consumed', { defaultValue: 'Consumed' })}
              </Text>
            </View>
          </View>
          {onEditGoal ? (
            <Pressable
              testID="dashboard-edit-goal"
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.editGoal', {
                defaultValue: 'Edit goal',
              })}
              className="min-h-11 min-w-11 items-center justify-center rounded-xl active:opacity-70"
              style={expanded ? undefined : { marginTop: -20 }}
              onPress={onEditGoal}
            >
              <Icon name="target" size={22} color={neutral} />
            </Pressable>
          ) : null}
        </View>
        <View style={expanded ? { width: '100%' } : { flex: 1 }}>
          <StatRow
            testID="dashboard-energy-consumed"
            icon="food"
            color={food}
            label={t('dashboard.consumed', { defaultValue: 'Consumed' })}
            value={caloriesConsumed}
            unit={kcal}
            onPress={onConsumedPress}
          />
          <StatRow
            testID="dashboard-energy-burned"
            icon="flame"
            color={burn}
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
            unit={kcal}
            onPress={onBurnedPress}
          />
          <StatRow
            testID="dashboard-energy-goal"
            icon="target"
            color={neutral}
            label={t('dashboard.target', { defaultValue: 'Base target' })}
            value={hasGoal ? calorieGoal : null}
            unit={kcal}
            onPress={onEditGoal}
            last
          />
        </View>
      </View>
      {balanceAdjustment !== 0 && (
        <Text className="mt-2 text-center text-xs text-text-secondary">
          {t('dashboard.balanceAdjustment', {
            defaultValue: 'Allowance adjustment',
          })}{' '}
          {balanceAdjustment > 0 ? '+' : '−'}
          {formatLocalizedNumber(Math.abs(balanceAdjustment))} {kcal}
        </Text>
      )}
    </GlowCard>
  );
};

export default CalorieRingCard;
