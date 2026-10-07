import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import EnergyGauge from './EnergyGauge';
import GlowCard from './ui/GlowCard';
import Icon from './Icon';
import { formatLocalizedNumber } from '../localization';

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

export default function CalorieRingCard({
  caloriesConsumed,
  calorieGoal,
  remainingCalories,
  progressPercent,
  onEditGoal,
  onConsumedPress,
}: CalorieRingCardProps) {
  const { t } = useTranslation();
  const expandedText = useWindowDimensions().fontScale > 1.3;
  const gaugeSize = 130;
  const [neutral, track, food] = useCSSVariable([
    '--color-card-glow',
    '--color-border-subtle',
    '--color-action-food',
  ]) as string[];
  const hasGoal = Number.isFinite(calorieGoal) && calorieGoal > 0;
  // The allowance includes exactly the adjustment already applied by the server.
  const effectiveGoal = hasGoal ? remainingCalories + caloriesConsumed : null;
  const intakeValue = formatLocalizedNumber(Math.round(caloriesConsumed));
  const goalValue =
    effectiveGoal === null
      ? null
      : formatLocalizedNumber(Math.round(effectiveGoal));
  const intake = `${intakeValue} kcal`;
  const goal =
    effectiveGoal === null
      ? t('dashboard.noCalorieGoal', {
          defaultValue: 'No daily calorie target set',
        })
      : t('dashboard.intakeGoal', {
          defaultValue: 'of {{value}} kcal',
          value: goalValue,
        });
  const amount = `${intake}, ${goal}`;
  return (
    <GlowCard
      testID="dashboard-energy"
      glowColor={neutral}
      className="mb-2 px-3 py-1"
    >
      <View className="flex-row items-center gap-3">
        <Icon name="flame" size={24} color={food} />
        <Text
          accessibilityRole="header"
          className="flex-1 text-lg font-bold text-text-primary"
        >
          {t('dashboard.calories', { defaultValue: 'Calories' })}
        </Text>
        <Pressable
          testID="dashboard-edit-goal"
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.editGoal', {
            defaultValue: 'Edit goal',
          })}
          onPress={onEditGoal}
          disabled={!onEditGoal}
          className="min-h-11 min-w-11 items-center justify-center"
        >
          <Icon name="target" size={22} color={neutral} />
        </Pressable>
      </View>
      <Pressable
        testID="dashboard-energy-consumed"
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.openMealsA11y', {
          defaultValue: '{{amount}}. Open daily meals.',
          amount,
        })}
        onPress={onConsumedPress}
        disabled={!onConsumedPress}
        className="items-center active:opacity-70"
      >
        <View
          className="items-center justify-center"
          style={
            expandedText
              ? { width: '100%', paddingVertical: 8 }
              : { width: gaugeSize, height: gaugeSize }
          }
        >
          {!expandedText && (
            <EnergyGauge
              size={gaugeSize}
              strokeWidth={12}
              progress={hasGoal ? progressPercent : 0}
              trackColor={track}
            />
          )}
          <View
            pointerEvents="none"
            className="items-center justify-center gap-0.5"
            style={
              expandedText
                ? { width: '100%' }
                : { position: 'absolute', width: 106 }
            }
          >
            <Text
              className={
                expandedText
                  ? 'w-full text-center text-[34px] font-bold text-text-primary'
                  : 'w-full text-center text-[26px] leading-[30px] font-bold text-text-primary'
              }
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={expandedText ? undefined : 1.6}
            >
              {intakeValue}
            </Text>
            {goalValue !== null && (
              <>
                <Text
                  className={`text-center text-text-secondary ${expandedText ? 'text-base' : 'text-xs leading-[14px]'}`}
                >
                  {t('dashboard.intakeOf', { defaultValue: 'of' })}
                </Text>
                <Text
                  testID="dashboard-energy-goal"
                  className={`w-full text-center font-semibold text-text-secondary ${expandedText ? 'text-2xl' : 'text-xl leading-6'}`}
                  numberOfLines={1}
                  adjustsFontSizeToFit={!expandedText}
                >
                  {goalValue}
                </Text>
              </>
            )}
            <Text
              className={`text-center text-text-secondary ${expandedText ? 'text-base' : 'text-xs leading-[14px]'}`}
            >
              {t('dashboard.kcal', { defaultValue: 'kcal' })}
            </Text>
            {goalValue === null && (
              <Text
                className={`w-full text-center text-text-secondary ${expandedText ? 'text-base' : 'text-xs'}`}
              >
                {goal}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </GlowCard>
  );
}
