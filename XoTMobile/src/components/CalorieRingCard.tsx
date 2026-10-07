import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import EnergyGauge from './EnergyGauge';
import GlowCard from './ui/GlowCard';
import Icon from './Icon';
import { formatLocalizedNumber } from '../localization';
import { useGlowTheme, withAlpha } from './ui/glow';
import { useTweenedValue } from '../hooks/useTweenedValue';
import type { MacroSummary } from '../types/dailySummary';

function IntakeProgressBar({
  id,
  label,
  shortLabel = label,
  value,
  unit = 'g',
  color,
  track,
}: {
  id: string;
  label: string;
  shortLabel?: string;
  value?: MacroSummary;
  unit?: string;
  color: string;
  track: string;
}) {
  const { t } = useTranslation();
  const known =
    value !== undefined &&
    Number.isFinite(value.consumed) &&
    value.consumed >= 0;
  const hasGoal = known && Number.isFinite(value.goal) && value.goal > 0;
  const percent = hasGoal ? (value.consumed / value.goal) * 100 : null;
  const fill = useTweenedValue(
    percent === null ? null : Math.min(100, percent)
  );
  const percentText =
    percent === null ? '—' : `${formatLocalizedNumber(Math.round(percent))}%`;
  const amount = known
    ? formatLocalizedNumber(value.consumed, { maximumFractionDigits: 1 })
    : '';
  const accessibleLabel = !known
    ? t('dashboard.intakeProgressUnavailable', {
        defaultValue: '{{label}} unavailable.',
        label,
      })
    : !hasGoal
      ? t('dashboard.intakeProgressNoGoal', {
          defaultValue: '{{label}}: {{value}} {{unit}}. No target set.',
          label,
          value: amount,
          unit,
        })
      : t('dashboard.intakeProgressA11y', {
          defaultValue:
            '{{label}}: {{value}} of {{goal}} {{unit}}, {{percent}}%.',
          label,
          value: amount,
          goal: formatLocalizedNumber(value.goal, { maximumFractionDigits: 1 }),
          unit,
          percent: formatLocalizedNumber(Math.round(percent!)),
        });
  return (
    <View
      testID={`intake-progress-${id}`}
      accessible
      accessibilityRole={hasGoal ? 'progressbar' : 'text'}
      accessibilityLabel={accessibleLabel}
      accessibilityValue={
        hasGoal
          ? {
              min: 0,
              max: 100,
              now: Math.min(100, Math.round(percent!)),
              text: percentText,
            }
          : undefined
      }
      className="w-full gap-1"
    >
      <Text
        className="text-[11px] leading-[14px] font-medium text-text-secondary"
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
      >
        {shortLabel}
      </Text>
      <View
        className="h-1 w-full rounded-full"
        style={{ backgroundColor: track }}
      >
        <View
          testID={`intake-progress-${id}-fill`}
          style={{
            height: '100%',
            width: `${fill ?? 0}%`,
            backgroundColor: color,
            borderRadius: 2,
          }}
        />
      </View>
      <Text
        className="text-[11px] leading-[14px] text-text-secondary"
        numberOfLines={1}
        maxFontSizeMultiplier={1.6}
      >
        {percentText}
      </Text>
    </View>
  );
}

interface CalorieRingCardProps {
  caloriesConsumed: number;
  caloriesBurned: number;
  burnedIncludesBmr: boolean;
  calorieGoal: number;
  remainingCalories: number;
  progressPercent: number;
  protein?: MacroSummary;
  carbs?: MacroSummary;
  showNetCarbs?: boolean;
  fat?: MacroSummary;
  water?: MacroSummary;
  waterUnit?: string;
  onEditGoal?: () => void;
  onConsumedPress?: () => void;
  onBurnedPress?: () => void;
}

export default function CalorieRingCard({
  caloriesConsumed,
  calorieGoal,
  remainingCalories,
  progressPercent,
  protein,
  carbs,
  showNetCarbs = false,
  fat,
  water,
  waterUnit = 'ml',
  onEditGoal,
  onConsumedPress,
}: CalorieRingCardProps) {
  const { t } = useTranslation();
  const expandedText = useWindowDimensions().fontScale > 1.3;
  const glowing = useGlowTheme();
  const gaugeSize = 130;
  const [
    neutral,
    track,
    food,
    proteinColor,
    carbsColor,
    fatColor,
    waterColor,
    green,
    red,
  ] = useCSSVariable([
    '--color-card-glow',
    '--color-border-subtle',
    '--color-action-food',
    '--color-macro-protein',
    '--color-macro-carbs',
    '--color-macro-fat',
    '--color-hydration',
    '--color-neon-green',
    '--color-neon-red',
  ]) as string[];
  const hasGoal = Number.isFinite(calorieGoal) && calorieGoal > 0;
  // The allowance includes exactly the adjustment already applied by the server.
  const allowance = remainingCalories + caloriesConsumed;
  const effectiveGoal =
    hasGoal && Number.isFinite(allowance) && allowance > 0 ? allowance : null;
  const intakeGlow =
    effectiveGoal !== null && Number.isFinite(caloriesConsumed)
      ? caloriesConsumed > effectiveGoal
        ? red
        : green
      : undefined;
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
      <View
        testID="dashboard-intake-body"
        className="flex-row items-center gap-2"
      >
        <View
          className="flex-1 min-w-0 gap-3"
          style={expandedText ? { flex: 0, width: 64 } : undefined}
        >
          <IntakeProgressBar
            id="protein"
            label={t('nutrients.protein', { defaultValue: 'Protein' })}
            value={protein}
            color={proteinColor}
            track={track}
          />
          <IntakeProgressBar
            id="carbs"
            label={
              showNetCarbs
                ? t('nutrients.netCarbs', { defaultValue: 'Net Carbs' })
                : t('nutrients.carbs', { defaultValue: 'Carbs' })
            }
            shortLabel={
              showNetCarbs
                ? t('diarySummary.netCarbsShort', { defaultValue: 'Net carbs' })
                : t('diarySummary.carbsShort', { defaultValue: 'Carbs' })
            }
            value={carbs}
            color={carbsColor}
            track={track}
          />
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
          className="min-w-0 items-center active:opacity-70"
          style={expandedText ? { flex: 1 } : { width: gaugeSize }}
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
                  : {
                      position: 'absolute',
                      width: 106,
                      // Optical centering uses the open bottom of the arc.
                      transform: [{ translateY: 8 }],
                    }
              }
            >
              <Text
                testID="dashboard-energy-intake"
                className={
                  expandedText
                    ? 'w-full text-center text-[34px] font-bold text-text-primary'
                    : 'w-full text-center text-[26px] leading-[30px] font-bold text-text-primary'
                }
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={expandedText ? undefined : 1.6}
                style={
                  intakeGlow
                    ? {
                        textShadowColor: withAlpha(
                          intakeGlow,
                          glowing ? 0.4 : 0.18
                        ),
                        textShadowRadius: glowing ? 6 : 3,
                        textShadowOffset: { width: 0, height: 0 },
                      }
                    : undefined
                }
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
                    className={`w-full text-center font-medium text-text-secondary ${expandedText ? 'text-xl' : 'text-base leading-5'}`}
                    numberOfLines={1}
                    adjustsFontSizeToFit
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
                  maxFontSizeMultiplier={1.6}
                  className={`w-full text-center text-text-secondary ${expandedText ? 'text-base' : 'text-xs'}`}
                >
                  {goal}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
        <View
          className="flex-1 min-w-0 gap-3"
          style={expandedText ? { flex: 0, width: 64 } : undefined}
        >
          <IntakeProgressBar
            id="fat"
            label={t('nutrients.fat', { defaultValue: 'Fat' })}
            value={fat}
            color={fatColor}
            track={track}
          />
          <IntakeProgressBar
            id="water"
            label={t('dashboard.intakeWater', { defaultValue: 'Water' })}
            value={water}
            unit={waterUnit}
            color={waterColor}
            track={track}
          />
        </View>
      </View>
    </GlowCard>
  );
}
