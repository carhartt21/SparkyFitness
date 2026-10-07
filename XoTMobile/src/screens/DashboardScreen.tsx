import Button from '../components/ui/Button';
import TrainingSummaryCard from '../components/TrainingSummaryCard';
/** Home: daily essentials first; detailed history belongs in dedicated screens. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  useFocusEffect,
  type CompositeScreenProps,
} from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import type { RootStackParamList, TabParamList } from '../types/navigation';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { useServerConfigs } from '../hooks/useServerConfigs';
import { useDashboardSnapshot } from '../hooks/useDashboardSnapshot';
import { useCheckInPhotoDates } from '../hooks/useCheckInPhotos';
import { useManualWaterActions } from '../hooks/useManualWaterActions';
import { useRetrySavedWater } from '../hooks/useRetrySavedWater';
import {
  useDailySummary,
  usePreferences,
  useServerConnection,
  useWaterIntakeMutation,
  useWidgetSync,
} from '../hooks';
import { useHeaderActionColors } from '../hooks/useHeaderActionColors';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { addSheetRef } from '../components/AddSheet';
import DashboardHeader from '../components/DashboardHeader';
import CalorieRingCard from '../components/CalorieRingCard';
import DailyProgressCard from '../components/DailyProgressCard';
import CalendarSheet, {
  type CalendarSheetRef,
} from '../components/CalendarSheet';
import OfflineHealthSummary from '../components/OfflineHealthSummary';
import FastingGoalReconciler from '../components/FastingGoalReconciler';
import ActionTile from '../components/ui/ActionTile';
import ScreenBackground from '../components/ui/ScreenBackground';
import StatusView from '../components/StatusView';
import Icon, { type IconName } from '../components/Icon';
import { settingsButtonLabel } from '../components/SettingsHeaderButton';
import {
  setNativeHeaderDatePickerOptions,
  type NativeHeaderDatePickerNavigation,
} from '../utils/nativeHeaderDatePicker';
import { formatDate } from '../utils/dateUtils';
import {
  formatVolumeForUnit,
  volumeFromMl,
  WATER_UNIT_LABELS,
} from '../utils/unitConversions';
import { useAppLocale } from '../localization';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;
export default function DashboardScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const barPadding = useActiveWorkoutBarPadding();
  const native = useNativeIOSTabsActive();
  const headerColors = useHeaderActionColors();
  const selectedDate = useDiaryDateStore((s) => s.selectedDate);
  const setSelectedDate = useDiaryDateStore((s) => s.setSelectedDate);
  const previous = useDiaryDateStore((s) => s.goToPreviousDay);
  const next = useDiaryDateStore((s) => s.goToNextDay);
  const today = useDiaryDateStore((s) => s.goToToday);
  const rollover = useDiaryDateStore((s) => s.syncTodayRollover);
  const calendar = useRef<CalendarSheetRef>(null);
  const scroll = useRef<ScrollView>(null);
  const [calendarOpened, setCalendarOpened] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { dates } = useCheckInPhotoDates(calendarOpened);
  const openCalendar = useCallback(() => {
    setCalendarOpened(true);
    calendar.current?.present();
  }, []);
  const settings = useCallback(
    () => navigation.navigate('Settings'),
    [navigation]
  );
  useFocusEffect(
    useCallback(() => {
      rollover();
    }, [rollover])
  );
  useEffect(
    () =>
      navigation.addListener('tabPress', () => {
        if (navigation.isFocused()) {
          today();
          scroll.current?.scrollTo({ y: 0, animated: true });
        }
      }),
    [navigation, today]
  );
  useLayoutEffect(() => {
    if (!native) return;
    setNativeHeaderDatePickerOptions(
      navigation as unknown as NativeHeaderDatePickerNavigation,
      {
        selectedDate,
        onDatePress: openCalendar,
        onPreviousDate: previous,
        onNextDate: next,
        tintColor: headerColors.defaultColor,
        accessibilityLabel: t('dashboard.chooseDate', {
          defaultValue: 'Choose dashboard date',
        }),
        previousDayLabel: t('common.previousDay', {
          defaultValue: ': previous day',
        }),
        nextDayLabel: t('common.nextDay', { defaultValue: ': next day' }),
        dateLabel: `${formatDate(selectedDate, locale)} ▾`,
        t,
        locale,
        settingsAction: {
          onPress: settings,
          accessibilityLabel: settingsButtonLabel(t),
          placement: 'right',
        },
      }
    );
  }, [
    native,
    navigation,
    t,
    selectedDate,
    openCalendar,
    previous,
    next,
    headerColors.defaultColor,
    locale,
    settings,
  ]);
  const { isConnected } = useServerConnection();
  const daily = useDailySummary({ date: selectedDate, enabled: isConnected });
  const prefs = usePreferences({ enabled: isConnected });
  const { activeConfig, isLoading: loadingConfig } = useServerConfigs();
  const saved = useDashboardSnapshot(
    selectedDate,
    activeConfig?.id,
    daily.summary,
    prefs.preferences,
    isConnected && !daily.isError && !prefs.isError
  );
  const offline = !isConnected || daily.isError || prefs.isError;
  const summary = offline ? saved?.summary : daily.summary;
  const preferences = offline ? saved?.preferences : prefs.preferences;
  useWidgetSync(summary);
  const water = useWaterIntakeMutation({
    date: selectedDate,
    enabled: isConnected,
  });
  const pendingWater = useManualWaterActions(selectedDate);
  const retryWater = useRetrySavedWater(selectedDate);
  const progressVisible = useAppPreferencesStore(
    (s) => s.dailyProgressCardVisible
  );
  const [accent, food, training, hydration, scan] = useCSSVariable([
    '--color-accent-primary',
    '--color-action-food',
    '--color-action-training',
    '--color-hydration',
    '--color-action-scan',
  ]) as string[];
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([daily.refetch(), prefs.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };
  const unit = water.unit ?? preferences?.water_display_unit ?? 'ml';
  const actions = [
    {
      id: 'food',
      icon: 'food' as const,
      label: t('dashboard.quickFood', { defaultValue: 'Log food' }),
      color: food,
      press: () => navigation.navigate('FoodSearch', { date: selectedDate }),
    },
    {
      id: 'exercise-running',
      icon: 'exercise-running' as const,
      label: t('dashboard.quickExercise', { defaultValue: 'Log exercise' }),
      color: training,
      press: () => addSheetRef.current?.present({ initialMenu: 'exercise' }),
    },
    {
      id: 'water',
      icon: 'water' as const,
      label: t('dashboard.quickWater', { defaultValue: 'Log water' }),
      color: hydration,
      press: () =>
        water.isContainersLoaded
          ? water.increment()
          : navigation.navigate('WaterContainers'),
    },
    {
      id: 'scan',
      icon: 'scan' as const,
      label: t('dashboard.quickScan', { defaultValue: 'Scan' }),
      color: scan,
      press: () => navigation.navigate('FoodScan', { date: selectedDate }),
    },
  ];
  const destinations: {
    icon: IconName;
    label: string;
    detail?: string;
    press: () => void;
  }[] = [
    {
      icon: 'food',
      label: t('screens.dailyNutritionDetails', {
        defaultValue: 'Nutrition details',
      }),
      press: () =>
        navigation.navigate('DailyNutritionDetails', { date: selectedDate }),
    },
    {
      icon: 'water',
      label: t('hydration.title', { defaultValue: 'Hydration' }),
      detail: summary
        ? `${formatVolumeForUnit(volumeFromMl(summary.waterConsumed, unit), unit)} ${WATER_UNIT_LABELS[unit] ?? unit}`
        : undefined,
      press: () => navigation.navigate('WaterLog', { date: selectedDate }),
    },
    {
      icon: 'exercise-running',
      label: t('trainingHub.title', { defaultValue: 'Training & routines' }),
      press: () => navigation.navigate('TrainingHub', { date: selectedDate }),
    },
  ];
  return (
    <View
      className="flex-1 bg-background"
      style={native ? undefined : { paddingTop: insets.top }}
    >
      <ScreenBackground />
      <ScrollView
        testID="dashboard-scroll"
        ref={scroll}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 80 + barPadding,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={accent}
          />
        }
      >
        {!native && (
          <DashboardHeader
            onSettings={settings}
            selectedDate={selectedDate}
            onPreviousDay={previous}
            onNextDay={next}
            onToday={today}
            onDatePress={openCalendar}
          />
        )}
        {offline && (
          <>
            <Text className="mb-3 text-sm text-text-secondary">
              {t('dashboard.cachedSummary', {
                defaultValue:
                  'Saved summary · {{time}}. More recent changes may not be included.',
                time: saved
                  ? new Date(saved.savedAt).toLocaleString(locale, {
                      hourCycle: 'h23',
                    })
                  : t('dashboard.offlineTitle', {
                      defaultValue: 'Server unavailable',
                    }),
              })}
            </Text>
            <OfflineHealthSummary date={selectedDate} />
          </>
        )}
        {!summary || !preferences ? (
          <StatusView
            loading={loadingConfig || daily.isLoading || prefs.isLoading}
            icon="cloud-offline"
            title={
              !activeConfig
                ? t('dashboard.noServerConfigured', {
                    defaultValue: 'No server configured',
                  })
                : loadingConfig || daily.isLoading || prefs.isLoading
                  ? t('common.loading', { defaultValue: 'Loading...' })
                  : t('dashboard.offlineTitle', {
                      defaultValue: 'Server unavailable',
                    })
            }
            subtitle={
              !activeConfig
                ? t('dashboard.configureServer', {
                    defaultValue:
                      'Configure your server connection in Settings to view your daily summary.',
                  })
                : t('dashboard.offlineEmpty', {
                    defaultValue:
                      'No summary for this day is saved on this device yet. Reconnect to load it.',
                  })
            }
            action={{
              label: !activeConfig
                ? t('navigation.settings', { defaultValue: 'Settings' })
                : t('common.retry', { defaultValue: 'Retry' }),
              onPress: !activeConfig ? settings : refresh,
              variant: 'primary',
            }}
          />
        ) : (
          <>
            {progressVisible && (
              <DailyProgressCard
                date={selectedDate}
                enabled={!offline}
                onOpenProgress={() =>
                  navigation.navigate('DailyProgress', { date: selectedDate })
                }
                onOpenHydration={() =>
                  navigation.navigate('WaterLog', { date: selectedDate })
                }
              />
            )}
            <CalorieRingCard
              caloriesConsumed={summary.calorieBalance.eaten}
              caloriesBurned={summary.calorieBalance.burned}
              burnedIncludesBmr={
                preferences.include_bmr_in_net_calories === true
              }
              calorieGoal={summary.calorieBalance.goal}
              remainingCalories={summary.calorieBalance.remaining}
              progressPercent={summary.calorieBalance.progress / 100}
              onEditGoal={() => navigation.navigate('CalorieSettings')}
              onConsumedPress={() =>
                navigation.navigate('DailyMeals', { date: selectedDate })
              }
              onBurnedPress={() =>
                navigation.navigate('ExerciseReview', { date: selectedDate })
              }
            />
            <TrainingSummaryCard
              date={selectedDate}
              enabled={!offline}
              onPress={() =>
                navigation.navigate('DailyTraining', { date: selectedDate })
              }
            />
          </>
        )}
        <View
          testID="dashboard-quick-actions"
          className="mb-4 flex-row flex-wrap gap-2"
        >
          {actions.map((a) => (
            <ActionTile
              key={a.id}
              testID={`dashboard-${a.id}`}
              label={a.label}
              icon={a.icon}
              color={a.color}
              onPress={a.press}
              style={{
                flexBasis: fontScale > 1.3 ? '46%' : '21%',
                flexGrow: 1,
              }}
            />
          ))}
        </View>
        {(pendingWater.pendingMl > 0 ||
          pendingWater.attentionMl > 0 ||
          pendingWater.pendingContainerCount > 0 ||
          pendingWater.attentionContainerCount > 0 ||
          pendingWater.storageError) && (
          <Button
            variant="secondary"
            onPress={() => retryWater.retry()}
            disabled={retryWater.retrying}
            className="mb-3 min-h-11 p-3"
          >
            <Text className="text-sm text-text-secondary">
              {t('home.pendingWater', {
                defaultValue:
                  'Water saved on this device · tap to retry syncing',
              })}
            </Text>
          </Button>
        )}
        <View className="rounded-2xl border border-border-subtle bg-surface px-3">
          {destinations.map((d, i) => (
            <Pressable
              key={d.label}
              testID={`dashboard-detail-${d.icon}`}
              accessibilityRole="button"
              onPress={d.press}
              className={`min-h-14 flex-row items-center gap-3 py-3 ${i ? 'border-t border-border-subtle' : ''}`}
            >
              <Icon name={d.icon} size={20} color={accent} />
              <Text className="min-w-0 flex-1 text-sm font-semibold text-text-primary">
                {d.label}
              </Text>
              {d.detail && (
                <Text className="text-sm text-text-secondary">{d.detail}</Text>
              )}
              <Icon name="chevron-forward" size={16} color={accent} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <FastingGoalReconciler />
      <CalendarSheet
        ref={calendar}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        markedDates={dates}
        showDailyProgress={isConnected}
        onOpenProgress={(date) =>
          navigation.navigate('DailyProgress', { date })
        }
      />
    </View>
  );
}
