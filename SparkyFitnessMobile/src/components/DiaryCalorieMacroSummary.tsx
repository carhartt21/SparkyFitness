import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, LayoutAnimation } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';

import Icon from './Icon';
import NutrientPill from './NutrientPill';
import ProgressRing from './ProgressRing';
import { glowSurfaceStyle, useGlowTheme } from './ui/glow';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { getNetCarbsValue } from '../utils/nutrientUtils';
import { NUTRIENT_META, getNutrientLabel } from '../constants/nutrients';
import type { DailySummary } from '../types/dailySummary';
import type { UserCustomNutrient } from '../hooks/useCustomNutrients';
import { formatLocalizedNumber } from '../localization';

const CORE_MACROS = ['protein', 'carbs', 'fat', 'dietary_fiber'] as const;
const RING_MACROS = ['carbs', 'protein', 'fat'] as const;

interface SummaryRingProps {
  label: string;
  displayLabel?: string;
  consumed: number;
  goal?: number;
  unit: string;
  color: string;
  trackColor: string;
  testID: string;
}

/** One nutrient in the Diary's ring row; a missing goal shows no denominator. */
const SummaryRing: React.FC<SummaryRingProps> = ({
  label,
  displayLabel,
  consumed,
  goal,
  unit,
  color,
  trackColor,
  testID,
}) => {
  const { t } = useTranslation();
  const hasGoal = goal != null && goal > 0;
  const value = formatLocalizedNumber(Math.round(consumed));
  const goalText = hasGoal
    ? t('diarySummary.ofGoal', {
        defaultValue: 'of {{value}}',
        value: formatLocalizedNumber(Math.round(goal)),
      })
    : null;
  return (
    <View
      className="flex-1 items-center"
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${value} ${goalText ? `${goalText} ` : ''}${unit}`}
    >
      <View
        className="items-center justify-center"
        style={{ width: RING_SIZE, height: RING_SIZE }}
      >
        <ProgressRing
          progress={hasGoal ? consumed / goal : 0}
          size={RING_SIZE}
          strokeWidth={6}
          color={color}
          backgroundColor={trackColor}
        />
        <View className="absolute items-center px-1">
          <Text
            className="text-sm font-bold text-text-primary"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {value}
          </Text>
          {goalText ? (
            <Text
              className="text-[10px] text-text-secondary text-center"
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {goalText}
            </Text>
          ) : null}
          <Text className="text-[10px] text-text-secondary text-center">
            {unit}
          </Text>
        </View>
      </View>
      <Text
        className="mt-1 text-xs font-medium text-text-secondary text-center"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {displayLabel ?? label}
      </Text>
    </View>
  );
};

const RING_SIZE = 76;

interface DiaryCalorieMacroSummaryProps {
  summary: DailySummary;
  showNetCarbs: boolean;
  /** Diary-specific custom nutrient keys (view_group='diary'), already capped to 4. */
  customNutrientKeys: string[];
  customNutrients: UserCustomNutrient[];
}

const DiaryCalorieMacroSummary: React.FC<DiaryCalorieMacroSummaryProps> = ({
  summary,
  showNetCarbs,
  customNutrientKeys,
  customNutrients,
}) => {
  const { t } = useTranslation();
  const diarySummaryVisible = useAppPreferencesStore(
    (s) => s.diarySummaryVisible
  );
  const diarySummaryExpanded = useAppPreferencesStore(
    (s) => s.diarySummaryExpanded
  );
  const setDiarySummaryExpanded = useAppPreferencesStore(
    (s) => s.setDiarySummaryExpanded
  );
  const [
    textSecondary,
    trackColor,
    caloriesColor,
    proteinColor,
    carbsColor,
    fatColor,
  ] = useCSSVariable([
    '--color-text-secondary',
    '--color-progress-track',
    '--color-calories',
    '--color-macro-protein',
    '--color-macro-carbs',
    '--color-macro-fat',
  ]) as string[];
  const glowing = useGlowTheme();
  const cardGlow = useCSSVariable('--color-card-glow') as string;
  const macroColors = {
    protein: proteinColor,
    carbs: carbsColor,
    fat: fatColor,
  };

  const rotation = useSharedValue(diarySummaryExpanded ? 0 : -90);
  useEffect(() => {
    rotation.value = withTiming(diarySummaryExpanded ? 0 : -90, {
      duration: 200,
    });
  }, [diarySummaryExpanded, rotation]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (!diarySummaryVisible) {
    return null;
  }

  const { eaten, goal, remaining } = summary.calorieBalance;
  const projection = summary.calorieBalance.tdeeProjection;

  const handleToggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDiarySummaryExpanded(!diarySummaryExpanded);
  };

  const resolveCoreMacro = (key: (typeof CORE_MACROS)[number]) => {
    if (key === 'protein') {
      return {
        label: t('nutrients.protein', { defaultValue: 'Protein' }),
        consumed: summary.protein.consumed,
        goal: summary.protein.goal || undefined,
      };
    }
    if (key === 'carbs') {
      const consumed = showNetCarbs
        ? getNetCarbsValue(summary.carbs.consumed, summary.fiber.consumed)
        : summary.carbs.consumed;
      return {
        label: showNetCarbs
          ? t('nutrients.netCarbs', { defaultValue: 'Net Carbs' })
          : t('nutrients.carbs', { defaultValue: 'Carbs' }),
        displayLabel: showNetCarbs
          ? t('diarySummary.netCarbsShort', { defaultValue: 'Net carbs' })
          : t('diarySummary.carbsShort', { defaultValue: 'Carbs' }),
        consumed,
        goal: summary.carbs.goal || undefined,
      };
    }
    if (key === 'fat') {
      return {
        label: t('nutrients.fat', { defaultValue: 'Fat' }),
        consumed: summary.fat.consumed,
        goal: summary.fat.goal || undefined,
      };
    }
    return {
      label: t('nutrients.fiber', { defaultValue: 'Fiber' }),
      consumed: summary.fiber.consumed,
      goal: summary.fiber.goal || undefined,
    };
  };

  return (
    <View
      className="mb-4 rounded-2xl border border-border-subtle bg-surface p-3"
      style={glowSurfaceStyle(cardGlow, glowing)}
    >
      <TouchableOpacity
        onPress={handleToggleExpanded}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: diarySummaryExpanded }}
        accessibilityHint={
          diarySummaryExpanded
            ? t('diarySummary.collapse', {
                defaultValue: 'Collapse this section',
              })
            : t('diarySummary.expand', { defaultValue: 'Expand this section' })
        }
      >
        <View className="flex-row items-center mb-3 gap-2">
          <Text className="flex-1 text-md font-bold text-text-secondary">
            {t('diarySummary.title', { defaultValue: 'Summary' })}
          </Text>
          {goal > 0 && (
            <Text className="text-sm font-bold text-text-primary">
              {formatLocalizedNumber(Math.abs(Math.round(remaining)))}
              <Text className="text-sm font-normal text-text-muted">
                {' '}
                {t('nutrition.caloriesShort', { defaultValue: 'kcal' })}{' '}
                {remaining >= 0
                  ? t('diarySummary.remaining', { defaultValue: 'remaining' })
                  : t('diarySummary.over', { defaultValue: 'over' })}
              </Text>
            </Text>
          )}
          <Animated.View style={chevronStyle}>
            <Icon name="chevron-down" size={20} color={textSecondary} />
          </Animated.View>
        </View>
        <View className="flex-row justify-between">
          <SummaryRing
            testID="diary-summary-calories"
            label={t('nutrients.calories', { defaultValue: 'Calories' })}
            consumed={eaten}
            goal={goal}
            unit={t('nutrition.caloriesShort', { defaultValue: 'kcal' })}
            color={caloriesColor}
            trackColor={trackColor}
          />
          {RING_MACROS.map((key) => {
            const macro = resolveCoreMacro(key);
            return (
              <SummaryRing
                key={key}
                testID={`diary-summary-${key}`}
                label={macro.label}
                displayLabel={
                  'displayLabel' in macro ? macro.displayLabel : undefined
                }
                consumed={macro.consumed}
                goal={macro.goal}
                unit={t('diarySummary.gramsUnit', { defaultValue: 'g' })}
                color={macroColors[key]}
                trackColor={trackColor}
              />
            );
          })}
        </View>
      </TouchableOpacity>
      {projection && (
        <View className="mt-2 rounded-lg bg-surface px-3 py-2">
          <Text className="text-xs font-semibold text-text-primary">
            {t('diarySummary.projectedTdee', {
              defaultValue: 'Projected TDEE: {{value}} kcal',
              value: formatLocalizedNumber(
                Math.round(projection.projectedBurn)
              ),
            })}
          </Text>
          <Text className="text-xs text-text-secondary mt-0.5">
            {t('diarySummary.goalModeTarget', {
              defaultValue: 'Goal Mode target: {{value}} kcal',
              value: formatLocalizedNumber(
                Math.round(projection.targetCalories ?? goal)
              ),
            })}
          </Text>
          <Text className="text-xs text-text-muted mt-0.5">
            {projection.source === 'health_connect_total'
              ? t('diarySummary.healthConnectProjectionSource', {
                  defaultValue: 'Health Connect total calories',
                })
              : projection.source === 'active_plus_bmr'
                ? t('diarySummary.fallbackProjectionSource', {
                    defaultValue: 'BMR + active calories fallback',
                  })
                : t('diarySummary.legacyProjectionSource', {
                    defaultValue: 'Device projection',
                  })}
          </Text>
        </View>
      )}
      {diarySummaryExpanded && (
        <View className="flex-row flex-wrap justify-between gap-y-2 mt-3">
          {CORE_MACROS.filter(
            (key) => !(RING_MACROS as readonly string[]).includes(key)
          ).map((key) => {
            const { label, consumed, goal: macroGoal } = resolveCoreMacro(key);
            return (
              <NutrientPill
                key={key}
                label={label}
                consumed={consumed}
                goal={macroGoal}
              />
            );
          })}
          {customNutrientKeys.map((name) => {
            const customDef = customNutrients.find((cn) => cn.name === name);
            const meta = NUTRIENT_META[name];
            const label = meta
              ? getNutrientLabel(t, name)
              : (customDef?.name ?? name);
            const unit = meta?.unit ?? customDef?.unit ?? 'g';
            const consumed = summary.customNutrientTotals[name] ?? 0;
            const nutrientGoal = summary.customNutrientGoals[name] || undefined;
            return (
              <NutrientPill
                key={name}
                label={label}
                consumed={consumed}
                goal={nutrientGoal}
                unit={unit}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

export default DiaryCalorieMacroSummary;
