import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDailySummary, usePreferences, useServerConnection } from '../hooks';
import {
  useNutritionTrends,
  type TrendRange,
} from '../hooks/useNutritionTrends';
import { useMeasurementsRange } from '../hooks/useMeasurementsRange';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import TabScreenHeader from '../components/TabScreenHeader';
import SegmentedControl from '../components/SegmentedControl';
import GlowCard from '../components/ui/GlowCard';
import ScreenBackground from '../components/ui/ScreenBackground';
import StatusView from '../components/StatusView';
import NutrientBarChart from '../components/NutrientBarChart';
import WeightLineChart from '../components/WeightLineChart';
import MacroCompositionRing from '../components/MacroCompositionRing';
import Icon, { type IconName } from '../components/Icon';
import { formatLocalizedNumber } from '../localization';
import { getTodayDate } from '../utils/dateUtils';
import { weightFromKg } from '../utils/unitConversions';
import { summarizeNutritionTrends, summarizeWeight } from '../utils/insights';
import type { RootStackParamList, TabParamList } from '../types/navigation';

type InsightsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Insights'>,
  NativeStackScreenProps<RootStackParamList>
>;

const RANGES: TrendRange[] = ['7d', '30d', '90d'];

const formatWhole = (value: number) =>
  formatLocalizedNumber(Math.round(value), { maximumFractionDigits: 0 });
const formatOneDecimal = (value: number) =>
  formatLocalizedNumber(value, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

const InsightCard: React.FC<{
  icon: IconName;
  iconColor: string;
  title: string;
  action?: { label: string; onPress: () => void };
  testID: string;
  children: React.ReactNode;
}> = ({ icon, iconColor, title, action, testID, children }) => {
  const link = useCSSVariable('--color-text-link') as string;
  return (
    <GlowCard testID={testID} glowColor={iconColor} className="mb-3 p-4">
      <View className="mb-2 flex-row flex-wrap items-center gap-2">
        <Icon name={icon} size={20} color={iconColor} />
        <Text
          className="flex-1 text-base font-semibold text-text-primary"
          accessibilityRole="header"
        >
          {title}
        </Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            onPress={action.onPress}
            className="min-h-11 flex-row items-center gap-1 px-1 active:opacity-70"
          >
            <Text className="text-xs font-medium text-text-link">
              {action.label}
            </Text>
            <Icon name="chevron-forward" size={12} color={link} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </GlowCard>
  );
};

const Stat: React.FC<{ value: string; label: string; testID?: string }> = ({
  value,
  label,
  testID,
}) => (
  <View className="flex-1" testID={testID}>
    <Text className="text-2xl font-bold text-text-primary">{value}</Text>
    <Text className="text-xs text-text-secondary">{label}</Text>
  </View>
);

const InsightsScreen: React.FC<InsightsScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding();
  const usesNativeTabs = useNativeIOSTabsActive();
  const [range, setRange] = useState<TrendRange>('30d');
  const rangeLabels: Record<TrendRange, string> = {
    '7d': t('ranges.7d', { defaultValue: '7d' }),
    '30d': t('ranges.30d', { defaultValue: '30d' }),
    '90d': t('ranges.90d', { defaultValue: '90d' }),
  };
  const [refreshing, setRefreshing] = useState(false);
  const today = getTodayDate();

  const { isConnected, isLoading: isConnectionLoading } = useServerConnection();
  const { preferences } = usePreferences({ enabled: isConnected });
  const { summary } = useDailySummary({ date: today, enabled: isConnected });
  const nutrition = useNutritionTrends({ range, enabled: isConnected });
  const measurements = useMeasurementsRange({ range, enabled: isConnected });

  const [
    accent,
    calories,
    protein,
    carbs,
    fat,
    track,
    hydration,
    exercise,
    secondary,
  ] = useCSSVariable([
    '--color-accent-primary',
    '--color-activity-energy',
    '--color-macro-protein',
    '--color-macro-carbs',
    '--color-macro-fat',
    '--color-progress-track',
    '--color-hydration',
    '--color-exercise',
    '--color-text-secondary',
  ]) as string[];

  const insights = useMemo(
    () => summarizeNutritionTrends(nutrition.data, nutrition.recordedDates),
    [nutrition.data, nutrition.recordedDates]
  );
  const calorieSeries = useMemo(
    () =>
      nutrition.data
        .filter((point) => nutrition.recordedDates.has(point.date))
        .map((point) => ({ day: point.date, value: point.calories })),
    [nutrition.data, nutrition.recordedDates]
  );

  const weightUnit: 'kg' | 'lbs' =
    (preferences?.default_weight_unit ?? 'kg') === 'kg' ? 'kg' : 'lbs';
  const weightSeries = useMemo(
    () =>
      weightUnit === 'kg'
        ? measurements.weightData
        : measurements.weightData.map((point) => ({
            ...point,
            weight: weightFromKg(point.weight, weightUnit),
          })),
    [measurements.weightData, weightUnit]
  );
  const weight = summarizeWeight(weightSeries);

  const calorieGoal = summary?.calorieGoal ?? 0;
  const kcal = t('dashboard.kcal', { defaultValue: 'kcal' });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([nutrition.refetch(), measurements.refetch()]);
    setRefreshing(false);
  }, [nutrition, measurements]);

  const title = (
    <View className="px-4" style={{ paddingTop: insets.top + 12 }}>
      <TabScreenHeader
        title={t('navigation.insights', { defaultValue: 'Insights' })}
        subtitle={t('insights.subtitle', {
          defaultValue: 'Trends from your logged data.',
        })}
        onSettings={() => navigation.navigate('Settings')}
      />
    </View>
  );

  if (!isConnectionLoading && !isConnected) {
    return (
      <View className="flex-1 bg-background">
        <ScreenBackground />
        {!usesNativeTabs && title}
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          iconSize={64}
          title={t('insights.unavailableTitle', {
            defaultValue: 'Insights unavailable',
          })}
          subtitle={t('insights.unavailableSubtitle', {
            defaultValue:
              'Connect to your server in Settings to see trends from your logged data.',
          })}
          action={{
            label: t('dashboard.goToSettings', {
              defaultValue: 'Go to Settings',
            }),
            onPress: () => navigation.navigate('Settings'),
            variant: 'primary',
          }}
        />
      </View>
    );
  }

  const shares = insights.macroShares;
  const macroRows = [
    {
      key: 'protein',
      label: t('nutrients.protein', { defaultValue: 'Protein' }),
      color: protein,
      grams: insights.averageProtein,
      share: shares?.protein,
    },
    {
      key: 'carbs',
      label: t('nutrients.carbs', { defaultValue: 'Carbs' }),
      color: carbs,
      grams: insights.averageCarbs,
      share: shares?.carbs,
    },
    {
      key: 'fat',
      label: t('nutrients.fat', { defaultValue: 'Fat' }),
      color: fat,
      grams: insights.averageFat,
      share: shares?.fat,
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScreenBackground />
      {!usesNativeTabs && title}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: usesNativeTabs ? 8 : 0,
          paddingBottom: 80 + activeWorkoutBarPadding,
        }}
        contentInsetAdjustmentBehavior={usesNativeTabs ? 'automatic' : 'never'}
        automaticallyAdjustsScrollIndicatorInsets={usesNativeTabs}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent}
          />
        }
      >
        <View className="mb-3">
          <SegmentedControl<TrendRange>
            segments={RANGES.map((key) => ({ key, label: rangeLabels[key] }))}
            activeKey={range}
            onSelect={setRange}
          />
        </View>

        <InsightCard
          testID="insights-calories"
          icon="flame"
          iconColor={calories}
          title={t('nutrients.calories', { defaultValue: 'Calories' })}
          action={{
            label: t('insights.viewDetails', { defaultValue: 'View details' }),
            onPress: () =>
              navigation.navigate('DailyNutritionDetails', { date: today }),
          }}
        >
          <View className="flex-row gap-3">
            <Stat
              testID="insights-average-calories"
              value={
                insights.averageCalories == null
                  ? '—'
                  : formatWhole(insights.averageCalories)
              }
              label={t('insights.averagePerLoggedDay', {
                defaultValue: '{{unit}} per logged day',
                unit: kcal,
              })}
            />
            {insights.averageCalories != null && calorieGoal > 0 ? (
              <Stat
                testID="insights-vs-goal"
                value={`${insights.averageCalories - calorieGoal > 0 ? '+' : ''}${formatWhole(insights.averageCalories - calorieGoal)}`}
                label={t('insights.vsTodayGoal', {
                  defaultValue: "vs. today's goal of {{goal}}",
                  goal: formatWhole(calorieGoal),
                })}
              />
            ) : null}
          </View>
          <NutrientBarChart
            data={calorieSeries}
            isLoading={nutrition.isLoading}
            isError={nutrition.isError}
            range={range}
            nutrientLabel={t('nutrients.calories', {
              defaultValue: 'Calories',
            })}
            unit={kcal}
            goal={calorieGoal > 0 ? calorieGoal : undefined}
          />
        </InsightCard>

        <InsightCard
          testID="insights-macros"
          icon="chart-bar"
          iconColor={protein}
          title={t('insights.macronutrients', {
            defaultValue: 'Macronutrients',
          })}
        >
          {shares ? (
            <View className="flex-row items-center gap-4">
              <View className="items-center justify-center">
                <MacroCompositionRing
                  size={132}
                  strokeWidth={16}
                  shares={shares}
                  colors={{ protein, carbs, fat }}
                  trackColor={track}
                />
                <View className="absolute items-center">
                  <Text className="text-lg font-bold text-text-primary">
                    {formatWhole(insights.averageCalories ?? 0)}
                  </Text>
                  <Text className="text-xs text-text-secondary">{kcal}</Text>
                </View>
              </View>
              <View className="flex-1 gap-3">
                {macroRows.map((row) => (
                  <View
                    key={row.key}
                    className="flex-row items-center gap-2"
                    testID={`insights-macro-${row.key}`}
                  >
                    <View
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-text-primary">
                        {row.label}
                      </Text>
                      <Text className="text-xs text-text-secondary">
                        {t('insights.gramsPerDay', {
                          defaultValue: '{{value}} g / day',
                          value: formatWhole(row.grams ?? 0),
                        })}
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold text-text-primary">
                      {formatWhole((row.share ?? 0) * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text className="text-sm text-text-secondary">
              {nutrition.isLoading
                ? t('common.loading', { defaultValue: 'Loading...' })
                : t('insights.noNutrition', {
                    defaultValue: 'No food logged in this period.',
                  })}
            </Text>
          )}
          {shares ? (
            <Text className="mt-3 text-xs text-text-secondary">
              {t('insights.macroShareNote', {
                defaultValue:
                  'Share of energy from protein, carbs and fat, averaged over logged days.',
              })}
            </Text>
          ) : null}
        </InsightCard>

        <InsightCard
          testID="insights-weight"
          icon="scale"
          iconColor={hydration}
          title={t('insights.weightTrend', { defaultValue: 'Weight trend' })}
          action={{
            label: t('insights.logWeight', { defaultValue: 'Log weight' }),
            onPress: () =>
              navigation.navigate('MeasurementsAdd', { date: today }),
          }}
        >
          {weight ? (
            <View className="flex-row gap-3">
              <Stat
                value={`${formatOneDecimal(weight.latest)} ${weightUnit}`}
                label={t('insights.latestWeight', {
                  defaultValue: 'Latest in range',
                })}
              />
              {weight.change != null ? (
                <Stat
                  testID="insights-weight-change"
                  value={`${weight.change > 0 ? '+' : ''}${formatOneDecimal(weight.change)} ${weightUnit}`}
                  label={t('insights.changeInRange', {
                    defaultValue: 'Change in range',
                  })}
                />
              ) : null}
            </View>
          ) : null}
          <WeightLineChart
            data={weightSeries}
            isLoading={measurements.isLoading}
            isError={measurements.isError}
            range={range}
            unit={weightUnit}
          />
        </InsightCard>

        <InsightCard
          testID="insights-key"
          icon="sparkles"
          iconColor={exercise}
          title={t('insights.keyInsights', { defaultValue: 'Key insights' })}
        >
          <View className="flex-row items-center gap-3 rounded-xl bg-raised p-3">
            <Icon name="calendar" size={22} color={secondary} />
            <Text
              className="flex-1 text-sm text-text-primary"
              testID="insights-consistency"
            >
              {nutrition.isLoading
                ? t('common.loading', { defaultValue: 'Loading...' })
                : t('insights.loggedDays', {
                    defaultValue:
                      'You logged food on {{count}} of the last {{total}} days.',
                    count: insights.loggedDays,
                    total: insights.totalDays,
                  })}
            </Text>
          </View>
          <Text className="mt-3 text-xs text-text-secondary">
            {t('nutrientTrends.loggedDaysNote', {
              defaultValue:
                'Trends include logged days only; days without entries are unknown.',
            })}
          </Text>
        </InsightCard>
      </ScrollView>
    </View>
  );
};

export default InsightsScreen;
