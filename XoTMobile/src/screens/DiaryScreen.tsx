import { useDiaryScheduledEntries } from '../hooks/useDiaryScheduledEntries';
import PlannedMealsCard from '../components/coaching/PlannedMealsCard';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  hasSupplementNutrition,
  wellnessEntries,
  type MealDayStatusValue,
} from '@workspace/shared';
import Toast from 'react-native-toast-message';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Directions,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import CalendarSheet, {
  type CalendarSheetRef,
} from '../components/CalendarSheet';
import CheckInPhotosSummary from '../components/CheckInPhotosSummary';
import DateBar from '../components/DateBar';
import Icon from '../components/Icon';
import TabScreenHeader from '../components/TabScreenHeader';
import ScreenBackground from '../components/ui/ScreenBackground';
import { settingsButtonLabel } from '../components/SettingsHeaderButton';
import DiaryCalorieMacroSummary from '../components/DiaryCalorieMacroSummary';
import EmptyDayIllustration from '../components/EmptyDayIllustration';
import MobilityDiarySection from '../components/MobilityDiarySection';
import { useMobilityDiary } from '../hooks/useMobilityDiary';
import FoodSummary from '../components/FoodSummary';
import DiaryBulkActionSheet from '../components/DiaryBulkActionSheet';
import { applyBulkFoodEntryAction } from '../services/api/foodEntriesApi';
import { invalidateFoodCache } from '../hooks/invalidateFoodCache';
import { nutritionCapturePhotoRefs } from '../utils/nutritionCapturePhotoRefs';
import PendingNutritionActions from '../components/PendingNutritionActions';
import NutritionPhotoEntries from '../components/NutritionPhotoEntries';
import MeasurementsSummary from '../components/MeasurementsSummary';
import ServingAdjustSheet, {
  type ServingAdjustSheetRef,
} from '../components/ServingAdjustSheet';
import { BedTimeCard, NapsCard, WakeUpCard } from '../components/SleepCards';
import StatusView from '../components/StatusView';
import Button from '../components/ui/Button';
import {
  useCustomNutrients,
  useDailySummary,
  useFamilyUsers,
  useMealTypes,
  useNutrientDisplayPreferences,
  useServerConnection,
} from '../hooks';
import { useActiveWorkoutPlans } from '../hooks/useActiveWorkoutPlan';
import {
  useCheckInPhotoDates,
  useCheckInPhotosByDate,
} from '../hooks/useCheckInPhotos';
import { useCustomMeasurementsByDate } from '../hooks/useCustomMeasurements';
import { useExerciseImageSource } from '../hooks/useExerciseImageSource';
import { useHeaderActionColors } from '../hooks/useHeaderActionColors';
import { useMeasurements } from '../hooks/useMeasurements';
import { usePreferences } from '../hooks/usePreferences';
import { useSleepDay } from '../hooks/useSleepDay';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { formatLocalizedNumber, useAppLocale } from '../localization/i18n';
import {
  formatVolumeForUnit,
  volumeFromMl,
  WATER_UNIT_LABELS,
} from '../utils/unitConversions';
import { useNutritionDiaryActions } from '../hooks/useNutritionDiaryActions';
import { useNutritionCapturesByDate } from '../hooks/useNutritionCapturesByDate';
import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import type { FoodEntry } from '../types/foodEntries';
import type { RootStackParamList, TabParamList } from '../types/navigation';
import { isManualSource } from '../utils/customMeasurementsForm';
import { formatDateLabel, getTodayDate } from '../utils/dateUtils';
import {
  calculateEntryNutrition,
  getHistoricalMealTypeLabel,
  getMealTypeDisplayLabel,
} from '../utils/mealNutrition';
import {
  setNativeHeaderDatePickerOptions,
  type NativeHeaderDatePickerNavigation,
} from '../utils/nativeHeaderDatePicker';
import {
  getPendingNutritionTotals,
  projectPendingNutritionSummary,
} from '../utils/nutritionPendingTotals';
import { projectPhotoCompletions } from '../utils/projectPhotoCompletions';
import {
  useMealTrackingStatus,
  useHabits,
  useHabitLogs,
  useSetMealStatus,
  useLogHabit,
} from '../hooks/useDailyTracking';
import HydrationDetailsModal from '../components/HydrationDetailsModal';
import DiaryTimeline, {
  type DiaryTimelineEntry,
} from '../components/DiaryTimeline';
import SwipeableFoodRow from '../components/SwipeableFoodRow';
import SwipeableExerciseRow from '../components/SwipeableExerciseRow';
import MealStatusControl from '../components/tracking/MealStatusControl';
import {
  diaryTimestamp,
  wellnessTimestamp,
  diaryMealGroups,
} from '../utils/diaryTimeline';
import { getWorkoutSummary } from '../utils/workoutSession';
import { formatClockTime, resolveSleepZone } from '../utils/sleepDay';
import { useMedications, useMedicationEntries } from '../hooks/useMedications';
import { fetchHydrationDetails } from '../services/api/measurementsApi';
import { hydrationDetailsQueryKey } from '../hooks/queryKeys';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import MealCoverageLine from '../components/tracking/MealCoverageLine';

type DiaryScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Diary'>,
  NativeStackScreenProps<RootStackParamList>
>;

const EMPTY_FOOD_ENTRIES: FoodEntry[] = [];

const DiaryScreen: React.FC<DiaryScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [hydrationVisible, setHydrationVisible] = useState(false);
  const dateLocale = useAppLocale();
  const insets = useSafeAreaInsets();
  const { isConnected, isLoading: isConnectionLoading } = useServerConnection();
  const { data: familyUsers = [] } = useFamilyUsers({ enabled: isConnected });
  const hasFamilyDiaries = isConnected && familyUsers.length > 0;
  const selectedDate = useDiaryDateStore((s) => s.selectedDate);
  const wellnessHabits = useHabits({
    includeInactive: true,
    enabled: isConnected,
  });
  const wellnessLogs = useHabitLogs(selectedDate, selectedDate, {
    enabled: isConnected,
  });
  const undoWellness = useLogHabit(selectedDate, selectedDate);
  const intakeDefinitions = useMedications({ enabled: isConnected });
  const intakeEntries = useMedicationEntries({
    fromDate: selectedDate,
    toDate: selectedDate,
    enabled: isConnected,
  });
  const hydration = useQuery({
    queryKey: hydrationDetailsQueryKey(selectedDate),
    queryFn: () => fetchHydrationDetails(selectedDate),
    enabled: isConnected,
    staleTime: 30_000,
  });
  useRefetchOnFocus(hydration.refetch, isConnected);
  const hasWellnessActivity =
    wellnessEntries(wellnessHabits.data ?? [], wellnessLogs.data ?? []).length >
    0;
  const mealStatusQuery = useMealTrackingStatus(selectedDate, {
    enabled: isConnected,
  });
  const setMealStatus = useSetMealStatus(selectedDate);
  const mealStates = useMemo(
    () =>
      new Map(
        (mealStatusQuery.data?.meals ?? []).map((meal) => [
          meal.meal_type_id,
          meal.state,
        ])
      ),
    [mealStatusQuery.data]
  );
  const onSetMealStatus = useCallback(
    (mealTypeId: string, status: MealDayStatusValue | null) =>
      setMealStatus.mutate(
        { entry_date: selectedDate, meal_type_id: mealTypeId, status },
        {
          onError: () =>
            Toast.show({
              type: 'error',
              text1: t('mealStatus.saveFailed', {
                defaultValue: 'Could not save the meal status.',
              }),
            }),
        }
      ),
    [selectedDate, setMealStatus, t]
  );
  const setSelectedDate = useDiaryDateStore((s) => s.setSelectedDate);
  const goToPreviousDay = useDiaryDateStore((s) => s.goToPreviousDay);
  const goToNextDay = useDiaryDateStore((s) => s.goToNextDay);
  const goToToday = useDiaryDateStore((s) => s.goToToday);
  const syncTodayRollover = useDiaryDateStore((s) => s.syncTodayRollover);
  const scrollViewRef = useRef<ScrollView>(null);
  const calendarRef = useRef<CalendarSheetRef>(null);
  const servingSheetRef = useRef<ServingAdjustSheetRef>(null);

  useFocusEffect(
    useCallback(() => {
      syncTodayRollover();
    }, [syncTodayRollover])
  );

  // Re-tapping the active Diary tab acts as a quick return to today's
  // entries and the top of the screen.
  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        goToToday();
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
  }, [navigation, goToToday]);

  useEffect(() => {
    navigation.setParams({ selectedDate });
  }, [navigation, selectedDate]);

  // The photo-day markers are fetched on first calendar open rather than at
  // mount: a user who never opens the picker should not pay a request for it.
  const [calendarOpened, setCalendarOpened] = useState(false);
  const { dates: photoDates } = useCheckInPhotoDates(calendarOpened);
  // Owned here rather than inside CheckInPhotosSummary: the empty-day predicate
  // below needs the same answer, and one subscription keeps refetch-on-focus
  // from firing twice for one query.
  const { photos: dayPhotos, isLoading: isPhotosLoading } =
    useCheckInPhotosByDate(selectedDate);
  const openCalendar = useCallback(() => {
    setCalendarOpened(true);
    calendarRef.current?.present();
  }, []);
  const openFamilyDiaries = useCallback(
    () => navigation.navigate('FamilyMembers'),
    [navigation]
  );
  const familyDiariesAccessibilityLabel = t('familyDiary.openFamilyDiaries', {
    defaultValue: 'Open family diaries',
  });
  const [accentColor, textPrimaryColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-primary',
  ]) as [string, string];
  const usesNativeTabs = useNativeIOSTabsActive();
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
        accessibilityLabel: t('diary.chooseDate', {
          defaultValue: 'Choose diary date',
        }),
        previousDayLabel: t('common.previousDay', {
          defaultValue: ': previous day',
        }),
        nextDayLabel: t('common.nextDay', { defaultValue: ': next day' }),
        dateLabel: `${formatDateLabel(selectedDate, t, dateLocale)} ▾`,
        t,
        locale: dateLocale,
        settingsAction: {
          onPress: () => navigation.navigate('Settings'),
          accessibilityLabel: settingsButtonLabel(t),
        },
        leadingAction: hasFamilyDiaries
          ? {
              sfSymbol: 'person.2.fill',
              onPress: openFamilyDiaries,
              accessibilityLabel: familyDiariesAccessibilityLabel,
              identifier: 'family-diaries',
            }
          : undefined,
      }
    );
  }, [
    goToNextDay,
    goToPreviousDay,
    nativeHeaderActionColor,
    navigation,
    openFamilyDiaries,
    openCalendar,
    selectedDate,
    familyDiariesAccessibilityLabel,
    hasFamilyDiaries,
    usesNativeTabs,
    t,
    dateLocale,
  ]);

  useLayoutEffect(() => {
    syncNativeHeaderDatePicker();
  }, [syncNativeHeaderDatePicker]);

  useFocusEffect(
    useCallback(() => {
      syncNativeHeaderDatePicker();
    }, [syncNativeHeaderDatePicker])
  );

  const swipeGesture = useMemo(
    () =>
      Gesture.Race(
        Gesture.Fling()
          .direction(Directions.RIGHT)
          .onEnd(goToPreviousDay)
          .runOnJS(true),
        Gesture.Fling()
          .direction(Directions.LEFT)
          .onEnd(goToNextDay)
          .runOnJS(true)
      ),
    [goToPreviousDay, goToNextDay]
  );

  const handleCalendarSelect = useCallback(
    (date: string) => setSelectedDate(date),
    [setSelectedDate]
  );
  const { mealTypes } = useMealTypes({ includeReadOnly: true });
  const openMealTypeDetail = useCallback(
    (mealTypeId: string | null, mealTypeName: string, entries: FoodEntry[]) => {
      // Resolve the label from the canonical definition (ownership-aware); for
      // a deleted/hidden type fall back to the literal historical name.
      const definition = mealTypes.find((mt) => mt.id === mealTypeId) ?? null;
      const mealLabel = definition
        ? getMealTypeDisplayLabel(definition, t)
        : getHistoricalMealTypeLabel(mealTypeName, t);
      navigation.navigate('MealTypeDetail', {
        date: selectedDate,
        mealTypeId: mealTypeId ?? undefined,
        mealType: mealTypeName,
        mealLabel,
      });
    },
    [navigation, selectedDate, mealTypes, t]
  );

  const { preferences } = usePreferences();
  const mobilityDiary = useMobilityDiary(
    selectedDate,
    isConnected,
    preferences?.timezone
  );
  const weightUnit = (preferences?.default_weight_unit as 'kg' | 'lbs') ?? 'kg';
  const distanceUnit =
    (preferences?.default_distance_unit as 'km' | 'miles') ?? 'km';
  const weightMode = preferences?.default_weight_unit ?? 'kg';
  const bodyUnit: 'cm' | 'inches' =
    preferences?.default_measurement_unit === 'inches' ? 'inches' : 'cm';
  const heightMode = preferences?.default_measurement_unit ?? 'cm';
  const { getImageSource } = useExerciseImageSource();

  const { summary, isLoading, isError, refetch } = useDailySummary({
    date: selectedDate,
    enabled: isConnected,
  });
  const {
    actions: localFoodActions,
    photoActions: localPhotoActions,
    photoCompletionActions,
    identity: nutritionIdentity,
    storageError: nutritionStorageError,
  } = useNutritionDiaryActions(
    selectedDate,
    summary?.foodEntries ?? EMPTY_FOOD_ENTRIES
  );
  const { captures: remotePhotoCaptures } = useNutritionCapturesByDate(
    selectedDate,
    isConnected
  );
  const capturePhotos = useMemo(() => {
    return nutritionCapturePhotoRefs(
      remotePhotoCaptures,
      localPhotoActions,
      isConnected
    );
  }, [localPhotoActions, remotePhotoCaptures, isConnected]);
  const pendingNutritionTotals = useMemo(
    () =>
      getPendingNutritionTotals(
        localFoodActions,
        photoCompletionActions,
        summary?.foodEntries ?? EMPTY_FOOD_ENTRIES
      ),
    [localFoodActions, photoCompletionActions, summary?.foodEntries]
  );
  const pendingPhotoDiaryEntries = useMemo(
    () =>
      projectPhotoCompletions(
        photoCompletionActions,
        summary?.foodEntries ?? EMPTY_FOOD_ENTRIES,
        mealTypes
      ),
    [photoCompletionActions, summary?.foodEntries, mealTypes]
  );
  const visibleSummary = useMemo(
    () =>
      summary
        ? projectPendingNutritionSummary(summary, pendingNutritionTotals)
        : null,
    [summary, pendingNutritionTotals]
  );
  const { measurements, refetch: refetchMeasurements } = useMeasurements({
    date: selectedDate,
    enabled: isConnected,
  });
  const { data: customMeasurements, refetch: refetchCustomMeasurements } =
    useCustomMeasurementsByDate(selectedDate, { enabled: isConnected });
  const { customNutrients, refetch: refetchCustomNutrients } =
    useCustomNutrients({ enabled: isConnected });
  const { preferences: nutrientPrefs, refetch: refetchNutrientPrefs } =
    useNutrientDisplayPreferences({ enabled: isConnected });

  const {
    wakeUp,
    naps,
    bedTime,
    isLoading: isSleepLoading,
    refetch: refetchSleep,
  } = useSleepDay(selectedDate, { enabled: isConnected });

  const diaryNutrientRow = nutrientPrefs.find(
    (p) => p.view_group === 'diary' && p.platform === 'mobile'
  );
  const customNutrientKeys = (diaryNutrientRow?.visible_nutrients ?? []).slice(
    0,
    4
  );
  const hasAnyMeasurement = useMemo(() => {
    // Only MANUAL custom entries make the Measurements section meaningful — a
    // user with pages of health-synced custom entries should not see the
    // section flash on their behalf.
    const manualCustom =
      customMeasurements?.filter((e) => isManualSource(e.source)) ?? [];
    if (manualCustom.length > 0) return true;
    if (!measurements) return false;
    return (
      measurements.weight != null ||
      measurements.body_fat_percentage != null ||
      measurements.height != null ||
      measurements.neck != null ||
      measurements.waist != null ||
      measurements.hips != null ||
      measurements.steps != null
    );
  }, [measurements, customMeasurements]);

  // Manual-only custom entries for the Diary tiles: health-synced entries are
  // filtered here (before presentation) so MeasurementsSummary never receives
  // them; the component itself re-filters defensively too.
  const manualCustomMeasurements = useMemo(
    () => (customMeasurements ?? []).filter((e) => isManualSource(e.source)),
    [customMeasurements]
  );

  const { plans: activePlans } = useActiveWorkoutPlans(selectedDate);
  const [refreshing, setRefreshing] = useState(false);
  const [editingFoods, setEditingFoods] = useState(false);
  const [selectedFoodIds, setSelectedFoodIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [bulkAction, setBulkAction] = useState<'move' | 'copy' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  useEffect(() => {
    setEditingFoods(false);
    setSelectedFoodIds(new Set());
    setBulkAction(null);
  }, [selectedDate]);
  const toggleFoodSelection = useCallback((entry: FoodEntry) => {
    setEditingFoods(true);
    setSelectedFoodIds((previous) => {
      const next = new Set(previous);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  }, []);
  const finishFoodEditing = useCallback(() => {
    setEditingFoods(false);
    setSelectedFoodIds(new Set());
    setBulkAction(null);
  }, []);
  const runBulkAction = useCallback(
    async (
      action: 'move' | 'copy' | 'delete',
      targetDate?: string,
      targetMealTypeId?: string
    ) => {
      if (selectedFoodIds.size === 0 || bulkBusy) return;
      setBulkBusy(true);
      try {
        await applyBulkFoodEntryAction({
          ids: [...selectedFoodIds],
          action,
          sourceDate: selectedDate,
          targetDate,
          targetMealTypeId,
        });
        invalidateFoodCache(queryClient, selectedDate);
        if (targetDate && targetDate !== selectedDate) {
          invalidateFoodCache(queryClient, targetDate);
        }
        finishFoodEditing();
      } catch (error) {
        Alert.alert(
          t('diary.bulk.failed', {
            defaultValue: 'Could not update selected foods',
          }),
          error instanceof Error
            ? error.message
            : t('common.tryAgain', { defaultValue: 'Please try again.' })
        );
      } finally {
        setBulkBusy(false);
      }
    },
    [bulkBusy, finishFoodEditing, queryClient, selectedDate, selectedFoodIds, t]
  );
  const moveDroppedFood = useCallback(
    async (entry: FoodEntry, targetMealTypeId: string) => {
      if (bulkBusy) return;
      const ids = selectedFoodIds.has(entry.id)
        ? [...selectedFoodIds]
        : [entry.id];
      if (ids.length === 1 && entry.meal_type_id === targetMealTypeId) return;
      setBulkBusy(true);
      try {
        await applyBulkFoodEntryAction({
          ids,
          action: 'move',
          sourceDate: selectedDate,
          targetDate: selectedDate,
          targetMealTypeId,
        });
        invalidateFoodCache(queryClient, selectedDate);
        setSelectedFoodIds(new Set());
      } catch (error) {
        Alert.alert(
          t('diary.bulk.failed', {
            defaultValue: 'Could not update selected foods',
          }),
          error instanceof Error
            ? error.message
            : t('common.tryAgain', { defaultValue: 'Please try again.' })
        );
      } finally {
        setBulkBusy(false);
      }
    },
    [bulkBusy, queryClient, selectedDate, selectedFoodIds, t]
  );
  const confirmBulkDelete = useCallback(() => {
    if (selectedFoodIds.size === 0) return;
    Alert.alert(
      t('diary.bulk.deleteTitle', { defaultValue: 'Delete selected foods?' }),
      t('diary.bulk.deleteMessage', {
        defaultValue: 'This removes {{count}} logged foods from this day.',
        count: selectedFoodIds.size,
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => void runBulkAction('delete'),
        },
      ]
    );
  }, [runBulkAction, selectedFoodIds.size, t]);
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding();
  const timezone =
    hydration.data?.timezone ??
    preferences?.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const scheduledEntries = useDiaryScheduledEntries(
    selectedDate,
    isConnected,
    timezone,
    wellnessHabits.data ?? [],
    intakeDefinitions.data ?? [],
    intakeEntries.data ?? [],
    () => setHydrationVisible(true)
  );
  const onRefresh = useCallback(async () => {
    if (!isConnected) return;
    setRefreshing(true);
    // Error-isolated refresh: one failing query must not prevent the others
    // from completing nor produce an unhandled rejection. The spinner is torn
    // down in `finally` regardless of individual query outcomes.
    try {
      await Promise.allSettled([
        refetch(),
        refetchMeasurements(),
        refetchCustomMeasurements(),
        refetchCustomNutrients(),
        refetchNutrientPrefs(),
        refetchSleep(),
        mobilityDiary.refetch(),
        hydration.refetch(),
        intakeEntries.refetch(),
        wellnessLogs.refetch(),
        scheduledEntries.refetch(),
        mealStatusQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    isConnected,
    refetch,
    refetchMeasurements,
    refetchCustomMeasurements,
    refetchCustomNutrients,
    refetchNutrientPrefs,
    refetchSleep,
    mobilityDiary,
    hydration,
    intakeEntries,
    wellnessLogs,
    scheduledEntries,
    mealStatusQuery,
  ]);

  const isRefreshing = refreshing;

  const isDayEmpty = useMemo(() => {
    return (
      !isSleepLoading &&
      wakeUp === null &&
      summary?.foodEntries.length === 0 &&
      localFoodActions.length === 0 &&
      localPhotoActions.length === 0 &&
      pendingPhotoDiaryEntries.length === 0 &&
      remotePhotoCaptures.length === 0 &&
      !hasSupplementNutrition(summary?.supplementTotals) && //A logged supplement is something the user recorded for this day, so the day is not empty even with no food, exercise or measurement.
      summary?.exerciseEntries.length === 0 &&
      !hasAnyMeasurement &&
      !hasWellnessActivity &&
      !intakeEntries.isLoading &&
      (intakeEntries.data?.length ?? 0) === 0 &&
      (hydration.data?.entries.length ?? 0) === 0 &&
      (summary?.waterConsumed ?? 0) === 0 &&
      !mobilityDiary.isLoading &&
      mobilityDiary.sessions.length === 0 &&
      // A progress photo is something the user recorded for this day, so it
      // defeats the empty state exactly as a logged supplement does. Gated on
      // the load like sleep above: ungated, a day with photos flashes the empty
      // illustration until they arrive.
      !isPhotosLoading &&
      dayPhotos.length === 0 &&
      naps.length === 0 &&
      bedTime === null &&
      !activePlans.some((plan) => plan.next_assignment)
    );
  }, [
    isSleepLoading,
    wakeUp,
    summary,
    localFoodActions,
    localPhotoActions,
    pendingPhotoDiaryEntries,
    remotePhotoCaptures,
    hasAnyMeasurement,
    hasWellnessActivity,
    intakeEntries.isLoading,
    intakeEntries.data,
    hydration.data,
    mobilityDiary.isLoading,
    mobilityDiary.sessions.length,
    isPhotosLoading,
    dayPhotos,
    naps,
    bedTime,
    activePlans,
  ]);

  const openWorkout = (
    session: NonNullable<typeof summary>['exerciseEntries'][number]
  ) => {
    if (session.type === 'preset') {
      // The live workout's surface is the active screen; detail is
      // for reviewing past or planned sessions.
      if (useActiveWorkoutStore.getState().sessionId === session.id) {
        navigation.navigate('ActiveWorkout');
        return;
      }
      navigation.navigate('WorkoutDetail', { session });
    } else {
      navigation.navigate('ActivityDetail', { session });
    }
  };

  const timelineEntries: DiaryTimelineEntry[] = [...scheduledEntries.entries];
  const addTimelineEntry = (
    id: string,
    at: string | null | undefined,
    label: string,
    content: React.ReactNode,
    clock?: string,
    timestamp?: number | null,
    options?: Pick<DiaryTimelineEntry, 'summary' | 'accessory' | 'collapsible'>
  ) => {
    const time =
      timestamp === undefined
        ? diaryTimestamp(selectedDate, at, timezone)
        : timestamp;
    timelineEntries.push({
      id,
      timestamp: time,
      clock:
        time === null
          ? null
          : (clock ??
            (at && /^\d{2}:\d{2}/.test(at)
              ? at.slice(0, 5)
              : formatClockTime(at, 'HH:mm', { kind: 'tz', tz: timezone }))),
      label,
      content,
      collapsible: /^(exercise|mobility|water|intake|wake|bed|nap):/.test(id),
      ...options,
    });
  };
  if (summary) {
    for (const group of diaryMealGroups(
      [...summary.foodEntries, ...pendingPhotoDiaryEntries],
      mealTypes,
      selectedDate,
      getTodayDate(),
      timezone
    )) {
      const meal = mealTypes.find((item) => item.id === group.mealTypeId);
      const label = meal
        ? getMealTypeDisplayLabel(meal, t)
        : getHistoricalMealTypeLabel(group.name, t);
      const calories = group.entries.reduce(
        (total, entry) => total + calculateEntryNutrition(entry).calories,
        0
      );
      addTimelineEntry(
        `meal:${group.mealTypeId ?? group.name}`,
        null,
        label,
        <View className="gap-2">
          {group.entries.map((entry) => (
            <SwipeableFoodRow
              key={entry.id}
              entry={entry}
              showTime
              nutrition={calculateEntryNutrition(entry)}
              capturePhoto={
                entry.nutrition_capture_id
                  ? capturePhotos[entry.nutrition_capture_id]
                  : undefined
              }
              onAdjustServing={(food) => servingSheetRef.current?.present(food)}
            />
          ))}
          {meal && (
            <Button
              variant="secondary"
              className="rounded-xl"
              onPress={() =>
                navigation.navigate('FoodSearch', {
                  date: selectedDate,
                  mealTypeId: meal.id,
                })
              }
            >
              {t('foodSummary.addFood', { defaultValue: 'Add food' })}
            </Button>
          )}
        </View>,
        group.clock ??
          (group.timestamp === null
            ? undefined
            : formatClockTime(
                new Date(group.timestamp).toISOString(),
                'HH:mm',
                { kind: 'tz', tz: timezone }
              )),
        group.timestamp,
        {
          collapsible: true,
          summary: (
            <Text className="text-sm text-text-secondary">
              {group.entries.length
                ? `${formatLocalizedNumber(calories, { maximumFractionDigits: 0 })} kcal`
                : t('diary.timeline.planned', {
                    defaultValue: 'Planned · nothing logged yet',
                  })}
            </Text>
          ),
          accessory:
            meal && isConnected && mealStates.has(meal.id) ? (
              <MealStatusControl
                mealLabel={label}
                state={mealStates.get(meal.id)!}
                onChange={(status) => onSetMealStatus(meal.id, status)}
                busy={setMealStatus.isPending}
              />
            ) : undefined,
        }
      );
    }
    for (const session of summary.exerciseEntries) {
      const times = (
        session.type === 'individual'
          ? [session.entry_time]
          : session.exercises.map((exercise) => exercise.entry_time)
      ).filter((value): value is string => !!value);
      const time = times
        .map((value) => ({
          value,
          timestamp: diaryTimestamp(selectedDate, value, timezone),
        }))
        .filter((item) => item.timestamp !== null)
        .sort((a, b) => a.timestamp! - b.timestamp!)[0]?.value;
      addTimelineEntry(
        `exercise:${session.id}`,
        time,
        getWorkoutSummary(session, t).name,
        <SwipeableExerciseRow
          session={session}
          entryDate={selectedDate}
          onPress={() => openWorkout(session)}
          getImageSource={getImageSource}
          weightUnit={weightUnit}
          distanceUnit={distanceUnit}
        />,
        undefined,
        undefined,
        {
          summary: (
            <Text className="text-sm text-text-secondary">
              {formatLocalizedNumber(getWorkoutSummary(session, t).duration)}{' '}
              {t('dashboard.minutesUnit', { defaultValue: 'min' })}
            </Text>
          ),
        }
      );
    }
  }
  for (const session of mobilityDiary.sessions) {
    addTimelineEntry(
      `mobility:${session.id}`,
      session.startedAt,
      session.routine.name,
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('GuidedMobility')}
        className="min-h-14 flex-row items-center gap-3"
      >
        <Icon name="exercise-yoga" size={22} color={accentColor} />
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-text-primary">
            {session.routine.name}
          </Text>
          <Text className="text-sm text-text-secondary">
            {t('mobility.historyCounts', {
              defaultValue: '{{completed}} completed · {{skipped}} skipped',
              completed: session.outcomes.filter(
                (item) => item.result === 'completed'
              ).length,
              skipped: session.outcomes.filter(
                (item) => item.result === 'skipped'
              ).length,
            })}
            {session.state === 'cancelled'
              ? ` · ${t('mobility.historyEndedEarly', { defaultValue: 'Ended early' })}`
              : ''}
          </Text>
        </View>
        <Icon name="chevron-forward" size={16} color={textPrimaryColor} />
      </Pressable>
    );
  }
  for (const action of localFoodActions) {
    addTimelineEntry(
      `pending-food:${action.clientOperationId}`,
      action.payload.entry_time,
      t('nutritionOutbox.title', { defaultValue: 'Saved on this device' }),
      <PendingNutritionActions actions={[action]} />
    );
  }
  const foodIds = new Set(summary?.foodEntries.map((entry) => entry.id));
  const waterUnit = preferences?.water_display_unit ?? 'ml';
  for (const entry of hydration.data?.entries ?? []) {
    // Linked drinks already appear as food entries; supplement drinks appear as intake.
    if (
      !['water', 'imported'].includes(entry.kind) ||
      (entry.food_entry_id && foodIds.has(entry.food_entry_id))
    )
      continue;
    addTimelineEntry(
      `water:${entry.id}`,
      entry.logged_at,
      t('dashboard.water', { defaultValue: 'Water' }),
      <Pressable
        accessibilityRole="button"
        onPress={() => setHydrationVisible(true)}
        className="min-h-14 flex-row items-center gap-3"
      >
        <Icon name="water" size={22} color={accentColor} />
        <Text className="flex-1 text-base text-text-primary">
          {entry.name ?? t('dashboard.water', { defaultValue: 'Water' })}
          {entry.water_ml === null
            ? ''
            : ` · ${formatVolumeForUnit(volumeFromMl(entry.water_ml, waterUnit), waterUnit)} ${WATER_UNIT_LABELS[waterUnit] ?? waterUnit}`}
        </Text>
        <Icon name="chevron-forward" size={16} color={textPrimaryColor} />
      </Pressable>
    );
  }
  for (const entry of intakeEntries.data ?? []) {
    if (entry.status !== 'taken' && entry.status !== 'prn_taken') continue;
    const definition = intakeDefinitions.data?.find(
      (item) => item.id === entry.medication_id
    );
    const label = definition
      ? definition.is_supplement
        ? t('supplements.singular', { defaultValue: 'Supplement' })
        : t('medications.medication', { defaultValue: 'Medication' })
      : t('diary.timeline.intake', { defaultValue: 'Intake' });
    addTimelineEntry(
      `intake:${entry.id}`,
      entry.taken_at,
      entry.med_name_snapshot ?? definition?.name ?? label,
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          entry.medication_id
            ? navigation.navigate('MedicationDetail', {
                medicationId: entry.medication_id,
              })
            : navigation.navigate('MedicationsList')
        }
        className="min-h-14 flex-row items-center gap-3"
      >
        <Icon name="medication" size={22} color={accentColor} />
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-text-primary">
            {entry.med_name_snapshot ?? definition?.name ?? label}
          </Text>
          <Text className="text-sm text-text-secondary">
            {entry.dose_amount_snapshot === null
              ? '—'
              : formatLocalizedNumber(entry.dose_amount_snapshot)}{' '}
            {entry.dose_unit_snapshot ?? ''}
          </Text>
        </View>
        <Icon name="chevron-forward" size={16} color={textPrimaryColor} />
      </Pressable>
    );
  }
  for (const entry of wellnessEntries(
    wellnessHabits.data ?? [],
    wellnessLogs.data ?? []
  )) {
    const log = wellnessLogs.data?.find(
      (item) =>
        item.habit_id === entry.activityId && item.entry_date === selectedDate
    );
    addTimelineEntry(
      `wellness:${entry.activityId}`,
      log?.recorded_at,
      t('wellness.title', { defaultValue: 'Wellness' }),
      <View className="min-h-14 flex-row items-center gap-3">
        <Icon name="wellness" size={22} color={accentColor} />
        <Text className="flex-1 text-base text-text-primary">{entry.name}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('diary.timeline.undoWellness', {
            defaultValue: 'Undo {{name}}',
            name: entry.name,
          })}
          disabled={undoWellness.isPending}
          className="min-h-11 min-w-11 items-center justify-center px-2"
          onPress={() =>
            undoWellness.mutate(
              {
                habitId: entry.activityId,
                body: { entry_date: selectedDate, value: null },
              },
              {
                onError: () =>
                  Toast.show({
                    type: 'error',
                    text1: t('wellness.removeFailed', {
                      defaultValue:
                        'Could not remove the activity. Please try again.',
                    }),
                  }),
              }
            )
          }
        >
          <Text className="text-sm font-semibold text-accent-primary">
            {t('wellness.undo', { defaultValue: 'Undo' })}
          </Text>
        </Pressable>
      </View>,
      undefined,
      log?.recorded_at
        ? wellnessTimestamp(selectedDate, log.recorded_at, timezone)
        : null
    );
  }
  const completedCaptureIds = new Set([
    ...(summary?.foodEntries ?? []).map((entry) => entry.nutrition_capture_id),
    ...pendingPhotoDiaryEntries.map((entry) => entry.nutrition_capture_id),
    ...photoCompletionActions.map((action) => action.payload.captureId),
  ]);
  const captureIds = new Set<string>();
  for (const capture of remotePhotoCaptures) {
    captureIds.add(capture.id);
    if (completedCaptureIds.has(capture.id)) continue;
    addTimelineEntry(
      `photo:${capture.id}`,
      capture.consumed_at,
      t('nutritionPhotos.title', { defaultValue: 'Meal photos' }),
      <NutritionPhotoEntries
        local={localPhotoActions.filter(
          (action) => action.payload.id === capture.id
        )}
        remote={[capture]}
        completions={photoCompletionActions}
        completedFoodEntries={summary?.foodEntries ?? EMPTY_FOOD_ENTRIES}
        isConnected={isConnected}
      />
    );
  }
  for (const action of localPhotoActions) {
    if (
      captureIds.has(action.payload.id) ||
      completedCaptureIds.has(action.payload.id)
    )
      continue;
    addTimelineEntry(
      `photo:${action.payload.id}`,
      action.payload.consumedAt,
      t('nutritionPhotos.title', { defaultValue: 'Meal photos' }),
      <NutritionPhotoEntries
        local={[action]}
        remote={[]}
        completions={photoCompletionActions}
        completedFoodEntries={summary?.foodEntries ?? EMPTY_FOOD_ENTRIES}
        isConnected={isConnected}
      />
    );
  }
  if (wakeUp)
    addTimelineEntry(
      `wake:${wakeUp.id}`,
      wakeUp.wake_time,
      t('sleep.wakeUp', { defaultValue: 'Wake Up' }),
      <WakeUpCard entry={wakeUp} day={selectedDate} navigation={navigation} />,
      formatClockTime(
        wakeUp.wake_time,
        'HH:mm',
        resolveSleepZone(wakeUp, timezone)
      )
    );
  for (const nap of naps)
    addTimelineEntry(
      `nap:${nap.id}`,
      nap.bedtime,
      t('sleep.napCount', {
        defaultValue: '{{count}} naps',
        defaultValue_one: '{{count}} nap',
        defaultValue_other: '{{count}} naps',
        count: 1,
      }),
      <NapsCard naps={[nap]} day={selectedDate} navigation={navigation} />,
      formatClockTime(nap.bedtime, 'HH:mm', resolveSleepZone(nap, timezone))
    );
  if (bedTime)
    addTimelineEntry(
      `bed:${bedTime.id}`,
      bedTime.bedtime,
      t('sleep.bedTime', { defaultValue: 'Bedtime' }),
      <BedTimeCard
        entry={bedTime}
        day={selectedDate}
        navigation={navigation}
      />,
      formatClockTime(
        bedTime.bedtime,
        'HH:mm',
        resolveSleepZone(bedTime, timezone)
      )
    );

  const renderContent = () => {
    if (!isConnectionLoading && !isConnected) {
      return (
        <ScrollView
          className="flex-1 bg-background"
          contentContainerStyle={{ padding: 16 }}
        >
          <NutritionPhotoEntries
            local={localPhotoActions}
            remote={remotePhotoCaptures}
            completions={photoCompletionActions}
            completedFoodEntries={summary?.foodEntries ?? EMPTY_FOOD_ENTRIES}
            isConnected={isConnected}
          />
          {pendingPhotoDiaryEntries.length > 0 && (
            <FoodSummary
              foodEntries={pendingPhotoDiaryEntries}
              capturePhotos={capturePhotos}
              mealTypes={mealTypes}
            />
          )}
          {(pendingNutritionTotals.knownEnergyCount > 0 ||
            pendingNutritionTotals.unknownEnergyCount > 0) && (
            <View className="bg-surface rounded-xl p-4 mb-3">
              <Text className="text-base font-bold text-text-primary">
                {t('nutritionOutbox.deviceTotals', {
                  defaultValue: 'Known on this device',
                })}
              </Text>
              <Text className="text-sm text-text-secondary">
                {t('nutritionOutbox.deviceCalories', {
                  defaultValue:
                    '{{calories}} kcal · P {{protein}} g · C {{carbs}} g · F {{fat}} g',
                  calories: Math.round(pendingNutritionTotals.calories),
                  protein: Math.round(pendingNutritionTotals.protein),
                  carbs: Math.round(pendingNutritionTotals.carbs),
                  fat: Math.round(pendingNutritionTotals.fat),
                })}
              </Text>
              {pendingNutritionTotals.unknownEnergyCount > 0 && (
                <Text className="text-sm text-text-muted">
                  {t('nutritionOutbox.unknownCount', {
                    defaultValue: '{{count}} saved items with unknown calories',
                    count: pendingNutritionTotals.unknownEnergyCount,
                  })}
                </Text>
              )}
            </View>
          )}
          <PendingNutritionActions
            actions={localFoodActions}
            storageError={nutritionStorageError}
          />
          <Text className="text-sm text-text-muted">
            {t('nutritionOutbox.offline', {
              defaultValue:
                'Server unavailable. Saved entries will sync when it returns.',
            })}
          </Text>
          <Button onPress={() => navigation.navigate('Settings')}>
            {t('diary.goToSettings', { defaultValue: 'Go to Settings' })}
          </Button>
        </ScrollView>
      );
    }

    // Sleep is deliberately not part of this gate: the cards render nothing until their
    // entries arrive, so a slow `/api/sleep` fills them in late instead of holding the
    // food and exercise that already loaded behind "Loading diary...".
    if (isLoading || isConnectionLoading) {
      if (
        localFoodActions.length > 0 ||
        localPhotoActions.length > 0 ||
        pendingPhotoDiaryEntries.length > 0
      ) {
        return (
          <View className="flex-1 bg-background p-4">
            <PendingNutritionActions
              actions={localFoodActions}
              storageError={nutritionStorageError}
            />
            <NutritionPhotoEntries
              local={localPhotoActions}
              remote={remotePhotoCaptures}
              completions={photoCompletionActions}
              completedFoodEntries={summary?.foodEntries ?? EMPTY_FOOD_ENTRIES}
              isConnected={isConnected}
            />
            {pendingPhotoDiaryEntries.length > 0 && (
              <FoodSummary
                foodEntries={pendingPhotoDiaryEntries}
                capturePhotos={capturePhotos}
                mealTypes={mealTypes}
              />
            )}
          </View>
        );
      }
      return (
        <StatusView
          loading
          title={t('diary.loading', { defaultValue: 'Loading diary...' })}
        />
      );
    }

    if (isError) {
      return (
        <StatusView
          icon="alert-circle"
          iconTone="danger"
          iconSize={64}
          title={t('diary.loadFailed', {
            defaultValue: 'Failed to load diary',
          })}
          subtitle={t('diary.checkConnection', {
            defaultValue: 'Please check your connection and try again.',
          })}
          action={{
            label: t('diary.retry', { defaultValue: 'Retry' }),
            onPress: () => refetch(),
            variant: 'primary',
          }}
        />
      );
    }

    if (!summary) {
      return null;
    }

    return (
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 80 + activeWorkoutBarPadding,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior={usesNativeTabs ? 'automatic' : 'never'}
        automaticallyAdjustsScrollIndicatorInsets={usesNativeTabs}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
          />
        }
      >
        {selectedDate >= getTodayDate() && (
          <PlannedMealsCard day={selectedDate} />
        )}
        <PendingNutritionActions
          actions={[]}
          storageError={nutritionStorageError}
        />

        {summary.foodEntries.length > 0 && editingFoods && (
          <View className="px-4 mb-3 gap-2">
            <View className="flex-row justify-between items-center">
              <Text className="min-w-0 flex-1 text-base font-semibold text-text-primary">
                {t('diary.bulk.foods', { defaultValue: 'Foods' })}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={
                  editingFoods ? finishFoodEditing : () => setEditingFoods(true)
                }
                className="min-h-11 min-w-11 items-center justify-center px-3"
              >
                <Text className="font-semibold text-accent-primary">
                  {editingFoods
                    ? t('common.done', { defaultValue: 'Done' })
                    : t('diary.bulk.edit', { defaultValue: 'Edit' })}
                </Text>
              </Pressable>
            </View>
            {editingFoods && (
              <View className="flex-row flex-wrap gap-2">
                <Text className="w-full text-sm text-text-secondary">
                  {t('diary.bulk.selectedCount', {
                    defaultValue: '{{count}} selected foods',
                    count: selectedFoodIds.size,
                  })}
                </Text>
                {(['move', 'copy'] as const).map((action) => (
                  <Pressable
                    key={action}
                    accessibilityRole="button"
                    disabled={selectedFoodIds.size === 0 || bulkBusy}
                    onPress={() => setBulkAction(action)}
                    className="min-h-11 justify-center rounded-xl border border-border bg-surface px-4"
                  >
                    <Text className="text-text-primary font-medium">
                      {action === 'move'
                        ? t('diary.bulk.move', { defaultValue: 'Move' })
                        : t('diary.bulk.copy', { defaultValue: 'Copy' })}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  disabled={selectedFoodIds.size === 0 || bulkBusy}
                  onPress={confirmBulkDelete}
                  className="min-h-11 justify-center rounded-xl border border-border bg-surface px-4"
                >
                  <Text className="text-text-danger font-medium">
                    {t('common.delete', { defaultValue: 'Delete' })}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        {!editingFoods && (
          <DiaryTimeline
            key={selectedDate}
            entries={timelineEntries}
            onEditFoods={
              summary.foodEntries.length > 0
                ? () => setEditingFoods(true)
                : undefined
            }
          />
        )}
        {(scheduledEntries.isError ||
          hydration.isError ||
          intakeEntries.isError ||
          wellnessHabits.isError ||
          wellnessLogs.isError) && (
          <View className="mb-4 gap-2">
            <Text
              accessibilityRole="alert"
              className="text-sm text-text-secondary"
            >
              {t('diary.timeline.partialError', {
                defaultValue:
                  'Some water, intake or wellness entries could not be refreshed. Pull to refresh and try again.',
              })}
            </Text>
            <Button variant="secondary" onPress={() => void onRefresh()}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </View>
        )}
        {mobilityDiary.isError && (
          <MobilityDiarySection
            sessions={[]}
            timezone={mobilityDiary.timezone}
            failed
            onRetry={() => void mobilityDiary.refetch()}
            onPress={() => navigation.navigate('GuidedMobility')}
          />
        )}
        {isDayEmpty &&
          timelineEntries.length === 0 &&
          !scheduledEntries.isLoading &&
          !scheduledEntries.isError && <EmptyDayIllustration />}
        <MealCoverageLine coverage={mealStatusQuery.data?.coverage} />
        {editingFoods && (
          <FoodSummary
            foodEntries={[...summary.foodEntries, ...pendingPhotoDiaryEntries]}
            capturePhotos={capturePhotos}
            mealTypes={mealTypes}
            goals={summary.goals}
            calorieGoal={summary.calorieGoal}
            onAddFood={(mealTypeId) =>
              navigation.navigate('FoodSearch', {
                date: selectedDate,
                mealTypeId,
              })
            }
            onAdjustServing={(entry) => servingSheetRef.current?.present(entry)}
            onPressMealType={openMealTypeDetail}
            mealStates={isConnected ? mealStates : undefined}
            onSetMealStatus={isConnected ? onSetMealStatus : undefined}
            mealStatusBusy={setMealStatus.isPending}
            selectionMode
            selectedEntryIds={selectedFoodIds}
            onSelectEntry={toggleFoodSelection}
            onDropFood={moveDroppedFood}
          />
        )}
        <MeasurementsSummary
          measurements={measurements}
          customMeasurements={manualCustomMeasurements}
          weightMode={weightMode}
          bodyUnit={bodyUnit}
          heightMode={heightMode}
          onPress={() =>
            navigation.navigate('MeasurementsAdd', { date: selectedDate })
          }
        />
        <CheckInPhotosSummary
          date={selectedDate}
          photos={dayPhotos}
          onPress={() =>
            navigation.navigate('ProgressPhotos', { date: selectedDate })
          }
        />
        {(summary.foodEntries.length > 0 ||
          pendingPhotoDiaryEntries.length > 0 ||
          hasSupplementNutrition(summary.supplementTotals) ||
          summary.exerciseEntries.length > 0 ||
          summary.calorieGoal > 0) && (
          <DiaryCalorieMacroSummary
            summary={visibleSummary ?? summary}
            showNetCarbs={preferences?.show_net_carbs === true}
            customNutrientKeys={customNutrientKeys}
            customNutrients={customNutrients}
          />
        )}
      </ScrollView>
    );
  };

  const renderedContent = (
    <>
      {renderContent()}
      <HydrationDetailsModal
        visible={hydrationVisible}
        date={selectedDate}
        unit={preferences?.water_display_unit ?? 'ml'}
        goal={summary?.waterGoal}
        onClose={() => setHydrationVisible(false)}
        onConfigure={() => navigation.navigate('WaterContainers')}
      />
    </>
  );

  if (usesNativeTabs) {
    return (
      <>
        <GestureDetector gesture={swipeGesture}>
          <View collapsable={false} className="flex-1 bg-background">
            <ScreenBackground />
            {renderedContent ?? <View className="flex-1" />}
          </View>
        </GestureDetector>
        <CalendarSheet
          ref={calendarRef}
          selectedDate={selectedDate}
          onSelectDate={handleCalendarSelect}
          markedDates={photoDates}
          showDailyProgress={isConnected}
          onOpenProgress={(date) =>
            navigation.navigate('DailyProgress', { date })
          }
        />
        <ServingAdjustSheet
          ref={servingSheetRef}
          onViewEntry={(entry) =>
            navigation.navigate('FoodEntryView', { entry })
          }
        />
        {bulkAction && (
          <DiaryBulkActionSheet
            key={`${bulkAction}:${selectedDate}`}
            action={bulkAction}
            sourceDate={selectedDate}
            mealTypes={mealTypes}
            selectedCount={selectedFoodIds.size}
            busy={bulkBusy}
            onClose={() => setBulkAction(null)}
            onApply={(action, targetDate, targetMealTypeId) =>
              void runBulkAction(action, targetDate, targetMealTypeId)
            }
          />
        )}
      </>
    );
  }

  const content = (
    <>
      <View className="px-4" style={{ paddingTop: insets.top + 12 }}>
        <TabScreenHeader
          title={t('diary.title', { defaultValue: 'Diary' })}
          subtitle={t('diary.subtitle', {
            defaultValue: 'Log your meals and activity.',
          })}
          onHome={() => navigation.navigate('Dashboard')}
          onSettings={() => navigation.navigate('Settings')}
          right={
            hasFamilyDiaries ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={familyDiariesAccessibilityLabel}
                onPress={openFamilyDiaries}
                className="h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-surface active:opacity-70"
              >
                <Icon name="people" size={20} color={textPrimaryColor} />
              </Pressable>
            ) : null
          }
        />
        {!isConnectionLoading && (isConnected || nutritionIdentity) ? (
          <View className="pb-3">
            <DateBar
              selectedDate={selectedDate}
              onPreviousDay={goToPreviousDay}
              onNextDay={goToNextDay}
              onToday={goToToday}
              onDatePress={openCalendar}
              testIDPrefix="diary"
              chooseDateLabel={t('diary.chooseDate', {
                defaultValue: 'Choose diary date',
              })}
            />
          </View>
        ) : null}
      </View>
      {renderedContent}
      <CalendarSheet
        ref={calendarRef}
        selectedDate={selectedDate}
        onSelectDate={handleCalendarSelect}
        markedDates={photoDates}
        showDailyProgress={isConnected}
        onOpenProgress={(date) =>
          navigation.navigate('DailyProgress', { date })
        }
      />
      <ServingAdjustSheet
        ref={servingSheetRef}
        onViewEntry={(entry) => navigation.navigate('FoodEntryView', { entry })}
      />
      {bulkAction && (
        <DiaryBulkActionSheet
          key={`${bulkAction}:${selectedDate}`}
          action={bulkAction}
          sourceDate={selectedDate}
          mealTypes={mealTypes}
          selectedCount={selectedFoodIds.size}
          busy={bulkBusy}
          onClose={() => setBulkAction(null)}
          onApply={(action, targetDate, targetMealTypeId) =>
            void runBulkAction(action, targetDate, targetMealTypeId)
          }
        />
      )}
    </>
  );

  return (
    <>
      <GestureDetector gesture={swipeGesture}>
        <View className="flex-1 bg-background">
          <ScreenBackground />
          {content}
        </View>
      </GestureDetector>
    </>
  );
};

export default DiaryScreen;
