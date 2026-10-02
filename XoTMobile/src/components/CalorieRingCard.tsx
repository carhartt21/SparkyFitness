import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import EnergyGauge from './EnergyGauge';
import Icon, { type IconName } from './Icon';
import DashboardSummaryCard, {
  DashboardSummaryRow,
} from './ui/DashboardSummaryCard';
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
  const shown = value == null ? '—' : formatLocalizedNumber(Math.round(value));
  return (
    <DashboardSummaryRow
      icon={icon}
      color={color}
      onPress={onPress}
      testID={testID}
      last={last}
      accessibilityLabel={`${label}: ${shown} ${value == null ? '' : unit}`.trim()}
    >
      <Text className="text-xs text-text-secondary" maxFontSizeMultiplier={1.8}>
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
    </DashboardSummaryRow>
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
  const [food, burn, neutral] = useCSSVariable([
    '--color-action-food',
    '--color-neon-green',
    '--color-text-secondary',
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

  return (
    <DashboardSummaryCard
      testID="dashboard-energy"
      headingIcon="flame"
      title={t('dashboard.calories', { defaultValue: 'Calories' })}
      accessibilityLabel={t('dashboard.dailyEnergy', {
        defaultValue: 'Daily energy',
      })}
      renderVisual={({ size: gaugeSize, stacked: expanded, trackColor }) => (
        <View className="items-center">
          <View className="items-center justify-center">
            {!expanded && (
              <EnergyGauge
                progress={hasGoal ? progressPercent : 0}
                size={gaugeSize}
                strokeWidth={14}
                trackColor={trackColor}
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
      )}
      footer={
        balanceAdjustment !== 0 ? (
          <Text className="mt-2 text-center text-xs text-text-secondary">
            {t('dashboard.balanceAdjustment', {
              defaultValue: 'Allowance adjustment',
            })}{' '}
            {balanceAdjustment > 0 ? '+' : '−'}
            {formatLocalizedNumber(Math.abs(balanceAdjustment))} {kcal}
          </Text>
        ) : null
      }
    >
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
    </DashboardSummaryCard>
  );
};

export default CalorieRingCard;
