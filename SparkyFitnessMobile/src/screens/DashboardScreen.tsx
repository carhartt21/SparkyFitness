import OfflineHealthSummary from '../components/OfflineHealthSummary';
import { useServerConfigs } from '../hooks/useServerConfigs';
import { useDashboardSnapshot } from '../hooks/useDashboardSnapshot';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { hasSupplementNutrition } from '@workspace/shared';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { formatLocalizedNumber, useAppLocale } from '../localization';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { addSheetRef } from '../components/AddSheet';
import CalendarSheet, {
  type CalendarSheetRef,
} from '../components/CalendarSheet';
import CalorieRingCard from '../components/CalorieRingCard';
import CycleCard from '../components/CycleCard';
import DashboardHeader from '../components/DashboardHeader';
import DashboardDayOverview from '../components/DashboardDayOverview';
import ExerciseProgressCard from '../components/ExerciseProgressCard';
import FastingCard from '../components/FastingCard';
import FastingGoalReconciler from '../components/FastingGoalReconciler';
import HealthTrendsPager from '../components/HealthTrendsPager';
import HydrationGauge from '../components/HydrationGauge';
import HydrationDetailsModal from '../components/HydrationDetailsModal';
import { useManualWaterActions } from '../hooks/useManualWaterActions';
import {
  listNutritionActions,
  retryNutritionAction,
} from '../services/nutritionActionOutbox';
import { getActiveNutritionIdentity } from '../services/nutritionIdentity';
import { reconcileNutritionActions } from '../services/nutritionActionSync';
import CaffeineCard from '../components/CaffeineCard';
import Icon from '../components/Icon';
import MacroCard from '../components/MacroCard';
import MedicationsCard from '../components/MedicationsCard';
import ProgressPhotosCard from '../components/ProgressPhotosCard';
import SegmentedControl, { type Segment } from '../components/SegmentedControl';
import StatusView from '../components/StatusView';
import { NUTRIENT_META, getNutrientLabel } from '../constants/nutrients';
import {
  caffeineActiveRootQueryKey,
  fastingRootQueryKey,
  medicationsRootQueryKey,
  useCustomNutrients,
  useDailySummary,
  useCaffeineKinetics,
  useHealthTrends,
  useMeasurements,
  useNutrientDisplayPreferences,
  usePreferences,
  useServerConnection,
  useWaterIntakeMutation,
  useWidgetSync,
} from '../hooks';
import { useCheckInPhotoDates } from '../hooks/useCheckInPhotos';
import { useHeaderActionColors } from '../hooks/useHeaderActionColors';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import type { HealthTrendDateRange } from '../types/healthTrends';
import {
  resolveHealthTrendOrder,
  selectVisibleHealthTrends,
} from '../utils/healthTrendPreferences';
import type { RootStackParamList, TabParamList } from '../types/navigation';
import { formatDateLabel } from '../utils/dateUtils';
import {
  setNativeHeaderDatePickerOptions,
  type NativeHeaderDatePickerNavigation,
} from '../utils/nativeHeaderDatePicker';
import { getNetCarbsValue } from '../utils/nutrientUtils';
import { weightFromKg } from '../utils/unitConversions';

const RANGE_SEGMENTS = (
  t: (key: string, options: { defaultValue: string }) => string
): Segment<HealthTrendDateRange>[] => [
  { key: '7d', label: t('ranges.7d', { defaultValue: '7d' }) },
  { key: '30d', label: t('ranges.30d', { defaultValue: '30d' }) },
  { key: '90d', label: t('ranges.90d', { defaultValue: '90d' }) },
];

type DashboardScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const dateLocale = useAppLocale();
  const { fontScale, width } = useWindowDimensions();
  const compactSummaries = width >= 390 && fontScale <= 1.3;
  const queryClient = useQueryClient();
  const selectedDate = useDiaryDateStore((s) => s.selectedDate);
  const setSelectedDate = useDiaryDateStore((s) => s.setSelectedDate);
  const goToPreviousDay = useDiaryDateStore((s) => s.goToPreviousDay);
  const goToNextDay = useDiaryDateStore((s) => s.goToNextDay);
  const goToToday = useDiaryDateStore((s) => s.goToToday);
  const syncTodayRollover = useDiaryDateStore((s) => s.syncTodayRollover);
  const [trendsRange, setTrendsRange] = useState<HealthTrendDateRange>('7d');
  const scrollViewRef = useRef<ScrollView>(null);
  const calendarRef = useRef<CalendarSheetRef>(null);

  // Only reset to today when the calendar day has actually changed (midnight rollover)
  useFocusEffect(
    useCallback(() => {
      syncTodayRollover();
    }, [syncTodayRollover])
  );

  // Re-tapping the active Dashboard tab acts as a quick return to
  // today's summary and the top of the screen.
  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        goToToday();
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
  }, [navigation, goToToday]);
  // The photo-day markers are fetched on first calendar open rather than at
  // mount: a user who never opens the picker should not pay a request for it.
  const [calendarOpened, setCalendarOpened] = useState(false);
  const { dates: photoDates } = useCheckInPhotoDates(calendarOpened);
  const openCalendar = useCallback(() => {
    setCalendarOpened(true);
    calendarRef.current?.present();
  }, []);
  const handleCalendarSelect = useCallback(
    (date: string) => setSelectedDate(date),
    [setSelectedDate]
  );
  const usesNativeTabs = useNativeIOSTabsActive();
  const insets = useSafeAreaInsets();
  const { defaultColor: nativeHeaderActionColor } = useHeaderActionColors();
  const syncNativeHeaderDatePicker = useCallback(() => {
    if (!usesNativeTabs) return;

    setNativeHeaderDatePickerOptions(
      navigation as unknown as NativeHeaderDatePickerNavigation,
      {
        selectedDate,
        onPreviousDate: goToPreviousDay,
        onDatePress: openCalendar,
        onNextDate: goToNextDay,
        tintColor: nativeHeaderActionColor,
        accessibilityLabel: t('dashboard.chooseDate', {
          defaultValue: 'Choose dashboard date',
        }),
        previousDayLabel: t('common.previousDay', {
          defaultValue: ': previous day',
        }),
        nextDayLabel: t('common.nextDay', { defaultValue: ': next day' }),
        dateLabel: `${formatDateLabel(selectedDate, t, dateLocale)} ▾`,
        t,
        locale: dateLocale,
      }
    );
  }, [
    goToNextDay,
    goToPreviousDay,
    nativeHeaderActionColor,
    navigation,
    openCalendar,
    selectedDate,
    usesNativeTabs,
    t,
    dateLocale,
  ]);

  const { isConnected, isLoading: isConnectionLoading } = useServerConnection();
  const {
    summary: liveSummary,
    isLoading,
    isError,
    refetch,
  } = useDailySummary({
    date: selectedDate,
    enabled: isConnected,
  });
  const {
    preferences: livePreferences,
    isLoading: isPreferencesLoading,
    isError: isPreferencesError,
    refetch: refetchPreferences,
  } = usePreferences({
    enabled: isConnected,
  });
  const { activeConfig, isLoading: isConfigLoading } = useServerConfigs();
  const saved = useDashboardSnapshot(
    selectedDate,
    activeConfig?.id,
    liveSummary,
    livePreferences,
    isConnected && !isError && !isPreferencesError
  );
  const showingSaved = !isConnected || isError || isPreferencesError;
  const summary = showingSaved ? saved?.summary : liveSummary;
  const preferences = showingSaved ? saved?.preferences : livePreferences;
  const {
    isLoading: isMeasurementsLoading,
    isError: isMeasurementsError,
    refetch: refetchMeasurements,
  } = useMeasurements({
    date: selectedDate,
    enabled: isConnected,
  });
  const {
    increment: incrementWater,
    decrement: decrementWater,
    unit: waterUnit,
    servingVolume,
    isContainersLoaded,
    containers: waterContainers,
    quickAddPresets: waterQuickAddPresets,
    logPreset: logWaterPreset,
    activeContainer: activeWaterContainer,
    selectContainer: selectWaterContainer,
  } = useWaterIntakeMutation({
    date: selectedDate,
    enabled: isConnected,
  });
  const manualWater = useManualWaterActions(selectedDate);
  const [retryingSavedWater, setRetryingSavedWater] = useState(false);
  const retryingSavedWaterRef = useRef(false);
  const retrySavedWater = useCallback(async () => {
    if (retryingSavedWaterRef.current) return;
    retryingSavedWaterRef.current = true;
    setRetryingSavedWater(true);
    try {
      const identity = await getActiveNutritionIdentity();
      if (!identity) throw new Error('No active nutrition account');
      const actions = await listNutritionActions(identity);
      const failedWater = actions.filter(
        (action) =>
          (action.type === 'logManualWater' ||
            action.type === 'logContainerWater') &&
          action.payload.entry_date === selectedDate &&
          action.syncState === 'attentionRequired'
      );
      for (const action of failedWater) {
        await retryNutritionAction(identity, action.clientOperationId);
      }
      if (failedWater.length > 0) {
        await reconcileNutritionActions(queryClient);
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: t('dashboard.retrySavedWaterFailed', {
          defaultValue: 'Could not retry saved water entries',
        }),
      });
    } finally {
      retryingSavedWaterRef.current = false;
      setRetryingSavedWater(false);
    }
  }, [queryClient, selectedDate, t]);

  // A linked container has no volume of its own, so state what one press logs
  // in the linked variant's own unit instead of a millilitre figure it does
  // not have.
  const linkedPressLabel = useMemo(() => {
    if (!activeWaterContainer?.linked_food_id) return undefined;
    const quantity = Number(activeWaterContainer.linked_quantity ?? 1);
    const unit = activeWaterContainer.linked_variant_serving_unit || '';
    const name = activeWaterContainer.linked_food_name || '';
    if (!unit || !Number.isFinite(quantity) || quantity <= 0) return name;
    const amount = `${formatLocalizedNumber(quantity, { maximumFractionDigits: 2 })} ${unit}`;
    return name ? `${amount} \u00b7 ${name}` : amount;
  }, [activeWaterContainer]);

  // Each preset states what one tap logs, in the linked drink's own unit --
  // the same phrasing the selected container uses above it.
  const quickAddOptions = useMemo(
    () =>
      waterQuickAddPresets.map((preset) => {
        const quantity = Number(preset.linked_quantity ?? 1);
        const unit = preset.linked_variant_serving_unit || '';
        return {
          id: preset.id,
          name: preset.linked_food_name || preset.name,
          pressLabel:
            unit && Number.isFinite(quantity) && quantity > 0
              ? `${formatLocalizedNumber(quantity, { maximumFractionDigits: 2 })} ${unit}`
              : undefined,
        };
      }),
    [waterQuickAddPresets]
  );

  const healthTrendOrder = useAppPreferencesStore((s) => s.healthTrendOrder);
  const hiddenHealthTrends = useAppPreferencesStore(
    (s) => s.hiddenHealthTrends
  );
  const visibleTrends = useMemo(
    () =>
      selectVisibleHealthTrends(
        resolveHealthTrendOrder(healthTrendOrder),
        hiddenHealthTrends
      ),
    [healthTrendOrder, hiddenHealthTrends]
  );

  const { refetch: refetchTrends, ...trends } = useHealthTrends({
    range: trendsRange,
    enabled: isConnected,
    activeTrends: visibleTrends,
  });

  const { customNutrients, refetch: refetchCustomNutrients } =
    useCustomNutrients({ enabled: isConnected });
  const { summaryNutrients, refetch: refetchNutrientPrefs } =
    useNutrientDisplayPreferences({ enabled: isConnected });

  useWidgetSync(summary);

  // The hydration card and the hydration trend must agree on the unit, so both read it
  // from here rather than each resolving the fallback chain themselves.
  const waterDisplayUnit = waterUnit || preferences?.water_display_unit || 'ml';

  // The chart is a single-axis line graph; if the user picked stones+lbs, plot lbs.
  const weightUnit: 'kg' | 'lbs' =
    (preferences?.default_weight_unit ?? 'kg') === 'kg' ? 'kg' : 'lbs';
  const weightSeries = useMemo(() => {
    if (weightUnit === 'kg') return trends.weight;
    return {
      ...trends.weight,
      data: trends.weight.data.map((p) => ({
        ...p,
        weight: weightFromKg(p.weight, weightUnit),
      })),
    };
  }, [trends.weight, weightUnit]);

  // CSS variable macro colors are theme-aware (lower saturation than hardcoded hex)
  const [
    proteinColor,
    carbsColor,
    fatColor,
    fiberColor,
    progressTrackOverfillColor,
  ] = useCSSVariable([
    '--color-macro-protein',
    '--color-macro-carbs',
    '--color-macro-fat',
    '--color-macro-fiber',
    '--color-progress-overfill',
  ]) as [string, string, string, string, string];

  const accentColor = useCSSVariable('--color-accent-primary') as string;

  const [hydrationDetailsVisible, setHydrationDetailsVisible] = useState(false);
  const [chartPage, setChartPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding();
  const fastingCardVisible = useAppPreferencesStore(
    (s) => s.fastingCardVisible
  );
  const fastingEnabled = useAppPreferencesStore((s) => s.fastingEnabled);
  const cycleCardVisible = useAppPreferencesStore((s) => s.cycleCardVisible);
  const hydrationCardVisible = useAppPreferencesStore(
    (s) => s.hydrationCardVisible
  );
  const caffeineCardVisible = useAppPreferencesStore(
    (s) => s.caffeineCardVisible
  );
  const {
    kinetics: caffeineKinetics,
    nowMs: caffeineNowMs,
    isLoading: isCaffeineLoading,
    refetch: refetchCaffeine,
  } = useCaffeineKinetics(selectedDate, caffeineCardVisible);
  const askSparkyVisible = useAppPreferencesStore((s) => s.askSparkyVisible);
  const medicationsCardVisible = useAppPreferencesStore(
    (s) => s.medicationsCardVisible
  );
  const progressPhotosCardVisible = useAppPreferencesStore(
    (s) => s.progressPhotosCardVisible
  );

  useLayoutEffect(() => {
    syncNativeHeaderDatePicker();
  }, [syncNativeHeaderDatePicker]);

  useFocusEffect(
    useCallback(() => {
      syncNativeHeaderDatePicker();
    }, [syncNativeHeaderDatePicker])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      refetchPreferences(),
      refetchMeasurements(),
      refetchTrends(),
      refetchCustomNutrients(),
      refetchNutrientPrefs(),
      refetchCaffeine(),
      // CaffeineCard and FastingCard own their own queries; nudge them on pull-to-refresh.
      queryClient.invalidateQueries({ queryKey: caffeineActiveRootQueryKey }),
      queryClient.invalidateQueries({ queryKey: fastingRootQueryKey }),
      // MedicationsCard owns its own queries.
      queryClient.invalidateQueries({ queryKey: medicationsRootQueryKey }),
    ]);
    setRefreshing(false);
  }, [
    refetch,
    refetchPreferences,
    refetchMeasurements,
    refetchTrends,
    refetchCustomNutrients,
    refetchNutrientPrefs,
    refetchCaffeine,
    queryClient,
  ]);

  // Render content based on state
  const renderContent = () => {
    // No server configured
    if (!isConfigLoading && !activeConfig) {
      return (
        <View className="flex-1">
          {!usesNativeTabs && (
            <View className="px-4 pb-5" style={{ paddingTop: insets.top + 16 }}>
              <Text className="text-2xl font-bold text-text-primary">
                {t('navigation.dashboard', { defaultValue: 'Dashboard' })}
              </Text>
            </View>
          )}
          <StatusView
            icon="cloud-offline"
            iconTone="muted"
            iconSize={64}
            title={t('dashboard.noServerConfigured', {
              defaultValue: 'No server configured',
            })}
            subtitle={t('dashboard.configureServer', {
              defaultValue:
                'Configure your server connection in Settings to view your daily summary.',
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

    // Loading state
    if (
      isConfigLoading ||
      (isConnected &&
        !summary &&
        (isLoading ||
          isConnectionLoading ||
          isPreferencesLoading ||
          isMeasurementsLoading))
    ) {
      return (
        <StatusView
          loading
          title={t('dashboard.loadingSummary', {
            defaultValue: 'Loading summary...',
          })}
        />
      );
    }

    // Error state
    if (
      (!summary || !preferences) &&
      (!isConnected || isError || isPreferencesError || isMeasurementsError)
    ) {
      return (
        <View className="flex-1 px-4 pb-4">
          {!usesNativeTabs && (
            <DashboardHeader
              selectedDate={selectedDate}
              onPreviousDay={goToPreviousDay}
              onNextDay={goToNextDay}
              onToday={goToToday}
              onDatePress={openCalendar}
            />
          )}
          <StatusView
            icon="alert-circle"
            iconTone="danger"
            iconSize={64}
            title={t('dashboard.offlineTitle', {
              defaultValue: 'Server unavailable',
            })}
            subtitle={t('dashboard.offlineEmpty', {
              defaultValue:
                'No summary for this day is saved on this device yet. Reconnect to load it.',
            })}
            action={{
              label: t('common.retry', { defaultValue: 'Retry' }),
              onPress: () => onRefresh(),
              variant: 'primary',
            }}
          />
          <OfflineHealthSummary date={selectedDate} />
        </View>
      );
    }

    // Data loaded successfully
    if (!summary || !preferences) {
      return null;
    }

    const { eaten, burned, remaining, goal, progress } = summary.calorieBalance;
    const showNetCarbs = preferences.show_net_carbs === true;

    const quickActions = (
      <View className="flex-row flex-wrap gap-2 mt-3">
        {[
          {
            label: t('dashboard.quickFood', { defaultValue: 'Food' }),
            icon: 'food' as const,
            onPress: () =>
              navigation.navigate('FoodSearch', { date: selectedDate }),
          },
          {
            label: t('dashboard.quickExercise', { defaultValue: 'Exercise' }),
            icon: 'exercise-running' as const,
            onPress: () =>
              addSheetRef.current?.present({ initialMenu: 'exercise' }),
          },
          {
            label: t('dashboard.quickWater', { defaultValue: 'Water' }),
            icon: 'water' as const,
            onPress: () =>
              isContainersLoaded
                ? incrementWater()
                : navigation.navigate('WaterContainers'),
          },
          {
            label: t('dashboard.quickScan', { defaultValue: 'Scan' }),
            icon: 'scan' as const,
            onPress: () =>
              navigation.navigate('FoodScan', { date: selectedDate }),
          },
        ].map((action) => (
          <Pressable
            testID={`dashboard-${action.icon}`}
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={{
              flexBasis: fontScale > 1.3 ? '46%' : '21%',
              flexGrow: 1,
              minHeight: 64,
            }}
            className="items-center justify-center rounded-xl border border-border-subtle bg-raised px-1 py-2"
          >
            <Icon
              name={action.icon}
              size={23}
              color={
                action.icon === 'water' || action.icon === 'exercise-running'
                  ? fatColor
                  : accentColor
              }
            />
            <Text className="mt-2 text-center text-xs font-semibold text-text-primary">
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
    return (
      <ScrollView
        testID="dashboard-scroll"
        ref={scrollViewRef}
        className="flex-1 bg-background"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 80 + activeWorkoutBarPadding,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior={usesNativeTabs ? 'automatic' : 'never'}
        automaticallyAdjustsScrollIndicatorInsets={usesNativeTabs}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor || '#1B5744'}
          />
        }
      >
        {!usesNativeTabs && (
          <DashboardHeader
            selectedDate={selectedDate}
            onPreviousDay={goToPreviousDay}
            onNextDay={goToNextDay}
            onToday={goToToday}
            onDatePress={openCalendar}
          />
        )}
        {showingSaved && (
          <View
            accessibilityRole="text"
            className="bg-surface rounded-xl p-3 mb-3"
          >
            <Text className="text-sm text-text-secondary">
              {t('dashboard.cachedSummary', {
                defaultValue:
                  'Saved summary · {{time}}. More recent changes may not be included.',
                time: saved
                  ? new Date(saved.savedAt).toLocaleString(dateLocale)
                  : t('dashboard.offlineTitle', {
                      defaultValue: 'Server unavailable',
                    }),
              })}
            </Text>
          </View>
        )}
        {showingSaved && <OfflineHealthSummary date={selectedDate} />}
        <CalorieRingCard
          caloriesConsumed={eaten}
          caloriesBurned={burned}
          burnedIncludesBmr={preferences.include_bmr_in_net_calories === true}
          calorieGoal={goal}
          remainingCalories={remaining}
          progressPercent={progress / 100}
        >
          {quickActions}
        </CalorieRingCard>
        {/* Macros Section — driven by nutrient display preferences (summary/mobile).
            Only the 4 core macros (with goals) and user-defined custom nutrients are
            shown here. Other enabled nutrients (sodium, sugars, etc.) belong in a
            detail view, not the at-a-glance dashboard grid. */}
        {/* Supplements count toward these figures, so a day with a logged supplement and no
            meal still has macros to show. Gating on food rows alone hid the card while the
            ring above it displayed the supplement's calories. */}
        {(summary.foodEntries.length > 0 ||
          hasSupplementNutrition(summary.supplementTotals)) &&
        summaryNutrients.length > 0
          ? (() => {
              const CORE_MACROS = new Set([
                'protein',
                'carbs',
                'fat',
                'dietary_fiber',
              ]);
              const customNutrientNames = new Set(
                customNutrients.map((cn) => cn.name)
              );
              const dashboardNutrients = summaryNutrients.filter(
                (key) => CORE_MACROS.has(key) || customNutrientNames.has(key)
              );
              if (dashboardNutrients.length === 0) return null;
              return (
                <View className="bg-surface rounded-2xl border border-border-subtle p-4 mb-3">
                  <Pressable
                    onPress={() =>
                      navigation.navigate('DailyNutritionDetails', {
                        date: summary.date,
                      })
                    }
                    accessibilityRole="button"
                    className="flex-row justify-between items-center min-h-11 mb-1 gap-3"
                  >
                    <Text className="text-lg font-bold text-text-primary flex-shrink">
                      {t('dashboard.nutrients', { defaultValue: 'Nutrients' })}
                    </Text>
                    <View className="flex-row items-center">
                      <Text className="text-xs font-semibold text-accent-primary mr-1">
                        {t('common.details', { defaultValue: 'Details' })}
                      </Text>
                      <Icon
                        name="chevron-forward"
                        size={14}
                        color={accentColor}
                      />
                    </View>
                  </Pressable>
                  <View className="flex-row flex-wrap justify-between">
                    {dashboardNutrients.map((nutrientKey) => {
                      // Resolve display label and unit.
                      const meta = NUTRIENT_META[nutrientKey];
                      const customDef = !meta
                        ? customNutrients.find((cn) => cn.name === nutrientKey)
                        : undefined;
                      const label = meta
                        ? getNutrientLabel(t, nutrientKey)
                        : (customDef?.name ?? nutrientKey);
                      const unit = meta?.unit ?? customDef?.unit ?? 'g';

                      // Use theme-aware CSS variable colors for the 4 core macros;
                      // custom nutrients fall back to the app accent color.
                      let color: string;
                      if (nutrientKey === 'protein') color = proteinColor;
                      else if (nutrientKey === 'carbs') color = carbsColor;
                      else if (nutrientKey === 'fat') color = fatColor;
                      else if (nutrientKey === 'dietary_fiber')
                        color = fiberColor;
                      else color = accentColor;

                      // Resolve consumed value.
                      let consumed: number;
                      if (nutrientKey === 'carbs' && showNetCarbs) {
                        consumed = getNetCarbsValue(
                          summary.carbs.consumed,
                          summary.fiber.consumed
                        );
                      } else if (nutrientKey === 'protein') {
                        consumed = summary.protein.consumed;
                      } else if (nutrientKey === 'carbs') {
                        consumed = summary.carbs.consumed;
                      } else if (nutrientKey === 'fat') {
                        consumed = summary.fat.consumed;
                      } else if (nutrientKey === 'dietary_fiber') {
                        consumed = summary.fiber.consumed;
                      } else {
                        consumed =
                          summary.customNutrientTotals[nutrientKey] ?? 0;
                      }

                      // Resolve goal. Core macros use their tracked goals; custom
                      // nutrients use their per-nutrient goal when one is set. When a
                      // custom nutrient has no goal, `goal` stays undefined and
                      // MacroCard hides the "/0".
                      let goal: number | undefined;
                      if (nutrientKey === 'protein')
                        goal = summary.protein.goal || undefined;
                      else if (nutrientKey === 'carbs')
                        goal = summary.carbs.goal || undefined;
                      else if (nutrientKey === 'fat')
                        goal = summary.fat.goal || undefined;
                      else if (nutrientKey === 'dietary_fiber')
                        goal = summary.fiber.goal || undefined;
                      else
                        goal =
                          summary.customNutrientGoals[nutrientKey] || undefined;

                      const displayLabel =
                        nutrientKey === 'carbs' && showNetCarbs
                          ? t('nutrients.netCarbs', {
                              defaultValue: 'Net Carbs',
                            })
                          : label;

                      return (
                        <MacroCard
                          key={nutrientKey}
                          label={displayLabel}
                          consumed={consumed}
                          goal={goal}
                          color={color}
                          overfillColor={progressTrackOverfillColor}
                          unit={unit}
                          row
                          widthClassName="w-full"
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })()
          : null}

        <View
          style={{
            flexDirection: compactSummaries ? 'row' : 'column',
            gap: compactSummaries ? 12 : 0,
            alignItems: 'flex-start',
          }}
        >
          {hydrationCardVisible && (
            <View
              style={{
                flex: compactSummaries ? 1 : undefined,
                width: compactSummaries ? undefined : '100%',
              }}
            >
              {hydrationCardVisible && (
                <HydrationGauge
                  onDetails={() => setHydrationDetailsVisible(true)}
                  compact={compactSummaries}
                  consumed={summary.waterConsumed}
                  goal={summary.waterGoal}
                  fromFoodMl={summary.waterFromFood}
                  pendingMl={manualWater.pendingMl}
                  attentionMl={manualWater.attentionMl}
                  pendingContainerCount={manualWater.pendingContainerCount}
                  attentionContainerCount={manualWater.attentionContainerCount}
                  pendingStorageError={manualWater.storageError}
                  onRetryAttention={retrySavedWater}
                  retryingAttention={retryingSavedWater}
                  unit={waterDisplayUnit}
                  containerVolume={servingVolume}
                  linkedPressLabel={linkedPressLabel}
                  onConfigure={
                    isContainersLoaded && !activeWaterContainer
                      ? () => navigation.navigate('WaterContainers')
                      : undefined
                  }
                  onIncrement={isContainersLoaded ? incrementWater : undefined}
                  onDecrement={isContainersLoaded ? decrementWater : undefined}
                  disableDecrement={summary.waterConsumed <= 0}
                  containers={waterContainers}
                  activeContainerId={activeWaterContainer?.id}
                  onSelectContainer={selectWaterContainer}
                  quickAddPresets={quickAddOptions}
                  onQuickAdd={
                    isContainersLoaded
                      ? (id: number) => logWaterPreset(id)
                      : undefined
                  }
                />
              )}
            </View>
          )}
          <View
            style={{
              flex: compactSummaries ? 1 : undefined,
              width: compactSummaries ? undefined : '100%',
            }}
          >
            <ExerciseProgressCard
              onDetails={() =>
                navigation.navigate('ExerciseReview', { date: selectedDate })
              }
              compact={compactSummaries}
              onLog={() =>
                addSheetRef.current?.present({ initialMenu: 'exercise' })
              }
              exerciseMinutes={summary.exerciseMinutes}
              exerciseMinutesGoal={summary.exerciseMinutesGoal}
              exerciseCalories={summary.otherExerciseCalories}
              exerciseCaloriesGoal={summary.exerciseCaloriesGoal}
            />
          </View>
        </View>
        <HydrationDetailsModal
          visible={hydrationDetailsVisible}
          date={selectedDate}
          unit={waterDisplayUnit}
          onClose={() => setHydrationDetailsVisible(false)}
          onConfigure={() => {
            setHydrationDetailsVisible(false);
            navigation.navigate('WaterContainers');
          }}
        />
        <DashboardDayOverview
          summary={summary}
          onOpenDiary={() => navigation.navigate('Diary', { selectedDate })}
        />
        {/* Tap-to-open launcher for the Sparky chat. Styled like an input to
            invite, but it pushes the full chat screen rather than capturing text
            here — the Dashboard's scroll + date-fling gestures make a live input
            on this screen more trouble than it's worth. The composer autofocuses
            on arrival so the affordance is honored immediately. Visibility is a
            local app setting toggled from Dashboard Settings. */}
        {askSparkyVisible && (
          <Pressable
            onPress={() => navigation.navigate('Chat')}
            className="flex-row items-center bg-surface rounded-lg  px-4 py-3 mb-3 shadow-sm"
          >
            <Icon name="sparkles" size={18} color={accentColor} />
            <Text className="text-text-muted text-base ml-3">
              {t('dashboard.askSparky', { defaultValue: 'Ask the assistant…' })}
            </Text>
          </Pressable>
        )}

        {/* Active caffeine, like hydration, is a local visibility setting. The
            card returns null on a day with no caffeine, so the toggle only
            decides whether it may appear at all. */}
        {caffeineCardVisible && (
          <CaffeineCard
            kinetics={caffeineKinetics}
            nowMs={caffeineNowMs}
            isLoading={isCaffeineLoading}
          />
        )}

        {/* Goal-notification reconciliation is owned here (headless, always
            mounted) so it survives the card being hidden. Fasting is "now"-based,
            so the card is deliberately date-independent — it always reflects the
            current/active fast regardless of the date navigator. Do not wire it
            to `selectedDate`. Visibility is a local app setting toggled from
            Dashboard Settings. */}
        <FastingGoalReconciler />
        {fastingEnabled && fastingCardVisible && (
          <FastingCard navigation={navigation} />
        )}
        {cycleCardVisible && <CycleCard navigation={navigation} />}

        {medicationsCardVisible && <MedicationsCard navigation={navigation} />}

        {progressPhotosCardVisible && (
          <ProgressPhotosCard navigation={navigation} date={selectedDate} />
        )}

        <Text className="text-text-primary text-xl font-bold mb-2">
          {t('dashboard.healthTrends', { defaultValue: 'Health Trends' })}
        </Text>
        {/* With every graph hidden the pager shows a card explaining that, and a range
            control over it would only change a window nothing is plotted in. */}
        {visibleTrends.length > 0 && (
          <SegmentedControl
            segments={RANGE_SEGMENTS(t)}
            activeKey={trendsRange}
            onSelect={setTrendsRange}
          />
        )}

        <HealthTrendsPager
          steps={trends.steps}
          weight={weightSeries}
          sleep={trends.sleep}
          hydration={trends.hydration}
          range={trendsRange}
          weightUnit={weightUnit}
          waterUnit={waterDisplayUnit}
          visibleTrends={visibleTrends}
          activePage={chartPage}
          onPageSelected={setChartPage}
        />
      </ScrollView>
    );
  };

  const renderedContent = renderContent();

  if (usesNativeTabs) {
    return (
      <>
        {renderedContent}
        <CalendarSheet
          ref={calendarRef}
          selectedDate={selectedDate}
          onSelectDate={handleCalendarSelect}
          markedDates={photoDates}
        />
      </>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {renderedContent}
      <CalendarSheet
        ref={calendarRef}
        selectedDate={selectedDate}
        onSelectDate={handleCalendarSelect}
        markedDates={photoDates}
      />
    </View>
  );
};

export default DashboardScreen;
