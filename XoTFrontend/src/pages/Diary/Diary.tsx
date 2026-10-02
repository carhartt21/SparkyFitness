import { PlannedMealsCard } from '@/pages/Coaching/PlannedMealsCard';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import DayNavigator from '@/components/DayNavigator';
import NutritionSummaryCard, { DayTotals } from './NutritionSummaryCard';
import DailyProgress from './DailyProgress';
import WaterIntake from './WaterIntake';
import CaffeineCard from './CaffeineCard';
import MealCard from './MealCard';
import ExerciseCard from './ExerciseCard';
import DiaryWidgetGrid, { type DiaryWidget } from './DiaryWidgetGrid';
import { LoggingStreakBadge, TodaysFocusCard } from './TodaysFocusCard';
import { mealWidgetKey } from '@/utils/dashboardLayout';
import {
  Flame,
  Salad,
  Droplet,
  Coffee,
  UtensilsCrossed,
  Dumbbell,
  HeartPulse,
} from 'lucide-react';
import { DailyHealthMetricsCard } from '@/components/Health/DailyHealthMetricsCard';
import { useDailyHealthMetrics } from '@/hooks/useGenericHealth';
import { selectDisplayableHealthMetrics } from '@/utils/dailyHealthMetrics';
import EditFoodEntryDialog from './EditFoodEntryDialog';
import FoodUnitSelector from '@/components/FoodUnitSelector';
import CopyFoodEntryDialog from '@/pages/Diary/CopyFoodEntryDialog';
import ConvertToMealDialog from '@/pages/Diary/ConvertToMealDialog';
import EditMealFoodEntryDialog from './EditMealFoodEntryDialog';
import CopyFamilyEntryDialog from '@/pages/Diary/CopyFamilyEntryDialog';
import LogMealDialog from '@/pages/Diary/LogMealDialog';
import { debug, info, error } from '@/utils/logging';
import {
  calculateDayTotals,
  addSupplementTotals,
  getEntryNutrition,
  getMealData,
  getMealTotals,
} from '@/utils/nutritionCalculations';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Food, FoodVariant } from '@/types/food';
import type { Meal as MealType, FoodEntryMeal } from '@/types/meal';
import type { FoodEntry } from '@/types/food';
import type { PresetExercise } from '@/types/workout';

import { useCustomNutrients } from '@/hooks/Foods/useCustomNutrients';
import { useMealTypes } from '@/hooks/Diary/useMealTypes';
import {
  useMealTrackingStatus,
  useSetMealDayStatus,
} from '@/hooks/Tracking/useTracking';
import {
  useCopyFoodEntriesMutation,
  useCreateFoodEntryMutation,
  useDeleteFoodEntryMealMutation,
  useDeleteFoodEntryMutation,
  useDiaryGoals,
  useFoodEntries,
  useFoodEntryMeals,
} from '@/hooks/Diary/useFoodEntries';
import {
  todayInZone,
  prefillEntryTime,
  isFddbImportMeal,
  shouldShowDiaryMeal,
} from '@workspace/shared';
import { useDailySummary } from '@/hooks/Diary/useDailyProgress';

const Diary = () => {
  const { t } = useTranslation();
  const { activeUserId, isActingOnBehalf } = useActiveUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { timezone, loggingLevel, energyUnit, convertEnergy } =
    usePreferences();
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editingFoodEntryMeal, setEditingFoodEntryMeal] =
    useState<FoodEntryMeal | null>(null); // State for editing logged meal entry
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState(
    searchParams.get('date') ?? todayInZone(timezone)
  );
  const isToday = selectedDate === todayInZone(timezone);
  const { data: mealTrackingStatus } = useMealTrackingStatus(selectedDate);
  const setMealStatus = useSetMealDayStatus(selectedDate);
  const mealStatusByType = useMemo(
    () =>
      new Map(
        (mealTrackingStatus?.meals ?? []).map((meal) => [
          meal.meal_type_id,
          meal.state,
        ])
      ),
    [mealTrackingStatus]
  );
  debug(loggingLevel, 'FoodDiary component rendered for date:', selectedDate);
  const [exercisesToLogFromPreset, setExercisesToLogFromPreset] = useState<
    PresetExercise[] | undefined
  >(undefined);

  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [isUnitSelectorOpen, setIsUnitSelectorOpen] = useState(false);
  const [isLogMealDialogOpen, setIsLogMealDialogOpen] = useState(false);
  const [selectedMealTemplate, setSelectedMealTemplate] =
    useState<MealType | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copySourceMealType, setCopySourceMealType] = useState<string>('');
  const [isConvertToMealDialogOpen, setIsConvertToMealDialogOpen] =
    useState(false);
  const [convertToMealSourceMealType, setConvertToMealSourceMealType] =
    useState<string>('');
  const [isCopyFamilyDialogOpen, setIsCopyFamilyDialogOpen] = useState(false);
  const [copyFamilySourceMealType, setCopyFamilySourceMealType] =
    useState<string>('');

  const [selectedMealType, setSelectedMealType] = useState<string>('');
  const [selectedMealTypeId, setSelectedMealTypeId] = useState<string>('');
  const [openScannerForMeal, setOpenScannerForMeal] = useState(false);
  const [openFoodSearchForMealType, setOpenFoodSearchForMealType] = useState<
    string | null
  >(null);
  const [toolbarContainer, setToolbarContainer] =
    useState<HTMLDivElement | null>(null);

  const currentUserId = activeUserId;
  const { data: customNutrients, isLoading: customNutrientsLoading } =
    useCustomNutrients();
  const { data: availableMealTypes, isLoading: mealTypesLoading } =
    useMealTypes();
  const {
    data: goals,
    isLoading: goalsLoading,
    isError: goalsError,
    refetch: refetchGoals,
  } = useDiaryGoals(selectedDate);
  const { data: healthMetricsData, isLoading: loadingHealthMetrics } =
    useDailyHealthMetrics(selectedDate);
  const { data: summaryData, isLoading: summaryLoading } =
    useDailySummary(selectedDate);
  const { data: fetchedFoodEntries, isLoading: foodEntriesLoading } =
    useFoodEntries(selectedDate);
  const { data: foodEntryMeals, isLoading: foodEntryMealsLoading } =
    useFoodEntryMeals(selectedDate);

  const effectiveGoals = goals
    ? summaryData?.adjustedGoals
      ? {
          ...goals,
          calories: summaryData.adjustedGoals.calories,
          protein: summaryData.adjustedGoals.protein,
          carbs: summaryData.adjustedGoals.carbs,
          fat: summaryData.adjustedGoals.fat,
        }
      : goals
    : undefined;

  const loading =
    customNutrientsLoading ||
    mealTypesLoading ||
    goalsLoading ||
    summaryLoading ||
    foodEntriesLoading ||
    foodEntryMealsLoading;

  const { mutateAsync: createFoodEntry } = useCreateFoodEntryMutation();
  const { mutateAsync: removeFoodEntry } = useDeleteFoodEntryMutation();
  const { mutateAsync: copyFoodEntries } = useCopyFoodEntriesMutation();
  const { mutateAsync: deleteFoodEntryMeal } = useDeleteFoodEntryMealMutation();

  const foodEntries = fetchedFoodEntries
    ? fetchedFoodEntries.filter((entry) => !entry.food_entry_meal_id)
    : [];

  // Logged supplement doses contribute to the day's intake, so the nutrition summary has
  // to account for them or it disagrees with the calorie ring above it, which already does.
  const dayTotals = addSupplementTotals(
    calculateDayTotals(foodEntries, foodEntryMeals),
    summaryData?.supplementTotals
  );

  // Handle navigation for opening food search dialog
  useEffect(() => {
    const state = location.state as {
      openFoodSearchForMeal?: string;
      startWithScanner?: boolean;
    };
    debug(loggingLevel, '[Diary] Location state:', state);
    if (
      state?.openFoodSearchForMeal &&
      availableMealTypes &&
      availableMealTypes.length > 0
    ) {
      const mealType = state.openFoodSearchForMeal;
      info(
        loggingLevel,
        `Diary: Opening food search for meal type: ${mealType}`
      );
      debug(
        loggingLevel,
        `[Diary] Setting openFoodSearchForMealType to: ${mealType}`
      );

      // Set which meal dialog should open
      setOpenScannerForMeal(state.startWithScanner === true);
      setOpenFoodSearchForMealType(mealType);

      // Clear the navigation state for next render
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state,
    availableMealTypes,
    loggingLevel,
    navigate,
    location.pathname,
  ]);

  // Dashboard "Log exercise" / hydration details land on the matching widget.
  useEffect(() => {
    const focus = (location.state as { focusWidget?: string } | null)
      ?.focusWidget;
    if (!focus || loading) return;
    // Not cancelled on cleanup: clearing the state below re-runs this effect.
    window.requestAnimationFrame(() => {
      document
        .getElementById(`diary-widget-${focus}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: {},
    });
  }, [location.state, location.pathname, location.search, loading, navigate]);

  const handleCopyClick = (mealType: string) => {
    setCopySourceMealType(mealType);
    setIsCopyDialogOpen(true);
    debug(loggingLevel, 'Opening copy dialog for meal type:', mealType);
  };

  const handleCopyFamilyClick = (mealType: string) => {
    setCopyFamilySourceMealType(mealType);
    setIsCopyFamilyDialogOpen(true);
    debug(loggingLevel, 'Opening family copy dialog for meal type:', mealType);
  };

  const handleCopyFoodEntries = async (
    targetDate: string,
    targetMealType: string
  ) => {
    debug(loggingLevel, 'Attempting to copy food entries.', {
      selectedDate,
      copySourceMealType,
      targetDate,
      targetMealType,
    });
    try {
      await copyFoodEntries({
        sourceDate: selectedDate,
        sourceMealType: copySourceMealType,
        targetDate,
        targetMealType,
      });
      info(loggingLevel, 'Food entries copied successfully.');
    } catch (err) {
      error(loggingLevel, 'Error copying food entries:', err);
    } finally {
      setIsCopyDialogOpen(false);
    }
  };

  const handleFoodSelect = async (item: Food | MealType, mealType: string) => {
    const typeObj = availableMealTypes?.find(
      (t) => t.name.toLowerCase() === mealType.toLowerCase()
    );
    const typeId = typeObj?.id || '';

    if ('is_custom' in item) {
      // It's a Food
      debug(loggingLevel, 'Handling food select:', { food: item, mealType });
      setSelectedFood(item as Food);
      setSelectedMealType(mealType); // Name
      setSelectedMealTypeId(typeId); // UUID
      setIsUnitSelectorOpen(true);
    } else {
      // It's a Meal Template (not FoodEntryMeal)
      debug(loggingLevel, 'Handling meal template select:', {
        meal: item,
        mealType,
      });
      const mealTemplate = item as MealType; // cast as Meal (MealType in grep was likely alias or similar, strictly Meal interface is better)
      setSelectedMealTemplate(mealTemplate);
      setSelectedMealType(mealType);
      setIsLogMealDialogOpen(true);
    }
  };

  const handleFoodUnitSelect = async (
    food: Food,
    quantity: number,
    unit: string,
    selectedVariant: FoodVariant,
    entryTime?: string | null,
    _mealType?: string | null,
    notes?: string | null
  ) => {
    if (!currentUserId) {
      return;
    }
    debug(loggingLevel, 'Handling food unit select:', {
      food,
      quantity,
      unit,
      selectedVariant,
      entryTime,
    });
    try {
      await createFoodEntry({
        user_id: currentUserId,
        food_id: food.id,
        meal_type: selectedMealType,
        meal_type_id: selectedMealTypeId,
        quantity: quantity,
        unit: unit,
        variant_id: selectedVariant.id,
        entry_date: selectedDate,
        entry_time: entryTime || null,
        notes: notes || null,
      });
      info(loggingLevel, 'Food entry added successfully.');
    } catch (err) {
      error(loggingLevel, 'Error adding food entry:', err);
    }
  };

  const handleRemoveEntry = async (
    itemId: string,
    itemType: 'foodEntry' | 'foodEntryMeal'
  ) => {
    debug(loggingLevel, 'Handling remove entry:', { itemId, itemType });
    try {
      if (itemType === 'foodEntryMeal') {
        await deleteFoodEntryMeal(itemId); // userId is handled by backend RLS
        info(loggingLevel, `Food entry meal ${itemId} removed successfully.`);
      } else {
        await removeFoodEntry(itemId);
        info(loggingLevel, `Food entry ${itemId} removed successfully.`);
      }
    } catch (err) {
      error(loggingLevel, 'Error removing food entry:', err);
    }
  };

  const handleEditEntry = (entry: FoodEntry | FoodEntryMeal) => {
    debug(loggingLevel, 'handleEditEntry called with entry:', entry);
    if (!currentUserId) {
      error(
        loggingLevel,
        'currentUserId is undefined when trying to edit entry.'
      );
      toast({
        title: t('foodDiary.error', 'Error'),
        description: t(
          'foodDiary.userNotFound',
          'User not found, cannot edit entry.'
        ),
        variant: 'destructive',
      });
      return;
    }

    if ((entry as FoodEntryMeal).foods !== undefined) {
      // It's a FoodEntryMeal based on 'foods' property
      setEditingFoodEntryMeal(entry as FoodEntryMeal);
      setEditingEntry(null);
    } else {
      // It's a FoodEntry (standalone or part of a meal)
      setEditingEntry(entry as FoodEntry);
      setEditingFoodEntryMeal(null);
    }
  };

  const handleConvertToMealClick = (mealType: string) => {
    setConvertToMealSourceMealType(mealType);
    setIsConvertToMealDialogOpen(true);
    debug(
      loggingLevel,
      'Opening Convert to Meal dialog for meal type:',
      mealType
    );
  };

  const visibleMealTypes = useMemo(
    () =>
      (availableMealTypes ?? []).filter(
        (meal) =>
          meal.is_visible &&
          (meal.purpose !== 'import' ||
            fetchedFoodEntries?.some(
              (entry) => entry.meal_type_id === meal.id
            ) ||
            foodEntryMeals?.some((entry) => entry.meal_type === meal.name))
      ),
    [availableMealTypes, fetchedFoodEntries, foodEntryMeals]
  );
  const editableMealTypes = visibleMealTypes.filter(
    (meal) => !isFddbImportMeal(meal.name)
  );

  // Some Garmin sync fields (e.g. lactate_threshold, fitness_age) can create a
  // daily_health_metrics row for a date even when none of the metrics this
  // card actually displays came back populated (no real wearable, FIT-only
  // import, etc.). Only show the widget when there's something real to show,
  // rather than an empty shell.
  //
  // daily_health_metrics holds one row per provider per day and the API orders
  // only by entry_date, so for a multi-provider user the first row is arbitrary
  // and is often an empty shell from a provider that synced something else that
  // day. Pick the row that actually has data instead of index 0. The card is
  // single-provider by design -- it badges metrics.source_provider -- so this
  // selects one row rather than merging several, which would mislabel the badge.
  const todaysHealthMetrics = selectDisplayableHealthMetrics(healthMetricsData);

  // Build the widget registry with stable keys so saved layouts reconcile
  // against the user's current meal types. The default placement is defined
  // separately in dashboardLayout.ts.
  const widgets: DiaryWidget[] = useMemo(() => {
    if (!effectiveGoals) return [];
    const list: DiaryWidget[] = [
      {
        key: 'energy',
        title: t('diary.dailyEnergyGoal', 'Daily Energy Goal'),
        icon: Flame,
        render: () => <DailyProgress selectedDate={selectedDate} />,
      },
      {
        key: 'nutrition',
        title: t('diary.nutritionSummary', 'Nutrition Summary'),
        icon: Salad,
        render: () => (
          <NutritionSummaryCard
            selectedDate={selectedDate}
            compact
            dayTotals={dayTotals as unknown as DayTotals}
            goals={effectiveGoals}
            energyUnit={energyUnit}
            convertEnergy={convertEnergy}
            customNutrients={customNutrients}
          />
        ),
      },
      {
        key: 'water',
        title: t('diary.waterIntake', 'Water Intake'),
        icon: Droplet,
        render: () => (
          <WaterIntake selectedDate={selectedDate} initialLogOpen={false} />
        ),
      },
    ];

    list.push({
      key: 'healthMetrics',
      title: t('diary.wearableHealthSummary', 'Daily Wearable Health Summary'),
      icon: HeartPulse,
      render: () => (
        <DailyHealthMetricsCard
          metrics={todaysHealthMetrics}
          isLoading={loadingHealthMetrics}
        />
      ),
    });

    for (const mealTypeObj of visibleMealTypes) {
      const mealData = getMealData(
        mealTypeObj.name,
        foodEntries,
        foodEntryMeals ?? [],
        effectiveGoals
      );
      if (!shouldShowDiaryMeal(mealTypeObj.name, mealData.entries.length))
        continue;
      list.push({
        key: mealWidgetKey(mealTypeObj.id),
        title: mealTypeObj.name,
        icon: UtensilsCrossed,
        render: () => (
          <MealCard
            readOnly={isFddbImportMeal(mealTypeObj.name)}
            meal={{
              ...getMealData(
                mealTypeObj.name,
                foodEntries,
                foodEntryMeals ?? [],
                effectiveGoals
              ),
              selectedDate: selectedDate,
            }}
            totals={getMealTotals(
              mealTypeObj.name,
              foodEntries,
              foodEntryMeals ?? []
            )}
            onFoodSelect={handleFoodSelect}
            onEditEntry={handleEditEntry}
            selectedDate={selectedDate}
            onRemoveEntry={(itemId, itemType) =>
              handleRemoveEntry(itemId, itemType)
            }
            getEntryNutrition={getEntryNutrition}
            onCopyClick={handleCopyClick}
            onCopyFamilyClick={handleCopyFamilyClick}
            onConvertToMealClick={handleConvertToMealClick}
            energyUnit={energyUnit}
            convertEnergy={convertEnergy}
            customNutrients={customNutrients}
            shouldOpenFoodSearch={
              openFoodSearchForMealType?.toLowerCase() ===
              mealTypeObj.name.toLowerCase()
            }
            startWithScanner={openScannerForMeal}
            onFoodSearchClose={() => {
              setOpenFoodSearchForMealType(null);
              setOpenScannerForMeal(false);
            }}
            mealStatus={mealStatusByType.get(mealTypeObj.id)}
            onMealStatusChange={(status) =>
              setMealStatus.mutate({
                entry_date: selectedDate,
                meal_type_id: mealTypeObj.id,
                status,
              })
            }
          />
        ),
      });
    }

    list.push({
      key: 'exercise',
      title: t('diary.exercise', 'Exercise'),
      icon: Dumbbell,
      render: () => (
        <ExerciseCard
          selectedDate={selectedDate}
          compact
          initialExercisesToLog={exercisesToLogFromPreset}
          onExercisesLogged={() => setExercisesToLogFromPreset(undefined)}
        />
      ),
    });

    // Secondary detail follows the daily and meal widgets in the registry.
    list.push({
      key: 'caffeine',
      title: t('diary.caffeine.title', 'Caffeine Kinetics'),
      icon: Coffee,
      render: () => <CaffeineCard date={selectedDate} userId={activeUserId} />,
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectiveGoals,
    visibleMealTypes,
    selectedDate,
    dayTotals,
    foodEntries,
    foodEntryMeals,
    energyUnit,
    customNutrients,
    exercisesToLogFromPreset,
    openFoodSearchForMealType,
    openScannerForMeal,
    todaysHealthMetrics,
    loadingHealthMetrics,
    t,
  ]);

  if (loading) {
    return (
      <div role="status" className="py-12 text-center text-muted-foreground">
        {t('common.loading', 'Loading...')}
      </div>
    );
  }
  return (
    <div className="xot-dashboard space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isToday
              ? t('diary.todayOverview', "Today's overview")
              : t('diary.dayOverview', 'Day overview')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'diary.overviewDescription',
              'Review your logged nutrition and activity.'
            )}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto">
          <LoggingStreakBadge selectedDate={selectedDate} />
          <div
            ref={setToolbarContainer}
            className="flex min-w-0 flex-wrap items-center gap-2"
          />
          <DayNavigator
            selectedDate={selectedDate}
            onDateChange={(dateString) => {
              setSelectedDate(dateString);
              setSearchParams({ date: dateString });
            }}
            className="grid-cols-none flex mb-0 items-center gap-2"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)]">
        <section
          aria-label={t('diary.quickActions', 'Quick actions')}
          className="rounded-xl border border-border/60 bg-card p-4"
        >
          <h2 className="mb-3 text-base font-semibold text-foreground">
            {t('diary.quickActions', 'Quick actions')}
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              className="min-h-12 justify-start gap-2 rounded-lg"
              disabled={editableMealTypes.length === 0}
              title={
                editableMealTypes.length === 0
                  ? t(
                      'diary.noMealTypeForQuickAdd',
                      'Create a meal type to log food'
                    )
                  : undefined
              }
              onClick={() => {
                const firstMealType = editableMealTypes[0];
                if (firstMealType)
                  setOpenFoodSearchForMealType(firstMealType.name);
              }}
            >
              <UtensilsCrossed aria-hidden="true" className="h-4 w-4" />
              {t('diary.addFood', 'Add food')}
            </Button>
            <Button
              variant="outline"
              className="min-h-12 justify-start gap-2 rounded-lg"
              onClick={() => {
                const water = document.getElementById('diary-widget-water');
                if (water)
                  water.scrollIntoView({ behavior: 'smooth', block: 'center' });
                else
                  toast({
                    title: t(
                      'diary.showWaterCard',
                      'Show the hydration card in dashboard customization to log water.'
                    ),
                  });
              }}
            >
              <Droplet aria-hidden="true" className="h-4 w-4 text-sky-500" />
              {t('diary.waterIntake', 'Water intake')}
            </Button>
            <Button
              variant="outline"
              className="min-h-12 justify-start gap-2 rounded-lg"
              onClick={() => {
                const exercise = document.getElementById(
                  'diary-widget-exercise'
                );
                if (exercise)
                  exercise.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                else navigate('/exercises');
              }}
            >
              <Dumbbell aria-hidden="true" className="h-4 w-4 text-amber-500" />
              {t('diary.exercise', 'Exercise')}
            </Button>
          </div>
        </section>
        {effectiveGoals && (
          <TodaysFocusCard
            caloriesEaten={
              summaryData?.calorieBalance.eaten ?? dayTotals.calories
            }
            calorieGoal={effectiveGoals.calories}
            proteinConsumed={dayTotals.protein}
            proteinGoal={effectiveGoals.protein}
            waterMl={summaryData ? summaryData.waterIntake : null}
            waterGoalMl={effectiveGoals.water_goal_ml ?? 0}
            foodEntryCount={
              (fetchedFoodEntries?.length ?? 0) + (foodEntryMeals?.length ?? 0)
            }
            onEditGoals={() => navigate('/goals')}
          />
        )}
      </div>

      <PlannedMealsCard day={selectedDate} />
      {effectiveGoals && (
        <DiaryWidgetGrid
          widgets={widgets}
          toolbarContainer={toolbarContainer}
        />
      )}
      {!effectiveGoals && (
        <Card role={goalsError ? 'alert' : undefined}>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <h2 className="text-lg font-semibold">
              {goalsError
                ? t(
                    'diary.goalsLoadErrorTitle',
                    'Your daily view could not load'
                  )
                : t('diary.goalsEmptyTitle', 'Set up your daily goals')}
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              {goalsError
                ? t(
                    'diary.goalsLoadErrorDescription',
                    'Try again to load your goals and daily entries.'
                  )
                : isActingOnBehalf
                  ? t(
                      'diary.goalsDelegateDescription',
                      'The account owner needs to set daily goals before this view is available.'
                    )
                  : t(
                      'diary.goalsEmptyDescription',
                      'Add your goals to see your daily summary and start tracking here.'
                    )}
            </p>
            {(goalsError || !isActingOnBehalf) && (
              <Button
                type="button"
                onClick={() => {
                  if (goalsError) void refetchGoals();
                  else navigate('/goals');
                }}
              >
                {goalsError
                  ? t('common.retry', 'Try again')
                  : t('diary.openGoals', 'Open goals')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Food Unit Selector Dialog */}
      {selectedFood && (
        <FoodUnitSelector
          food={selectedFood}
          open={isUnitSelectorOpen}
          onOpenChange={setIsUnitSelectorOpen}
          onSelect={handleFoodUnitSelect}
          showUnitSelector={true}
          showTimeInput={true}
          defaultMealTime={
            availableMealTypes?.find(
              (t) => t.name.toLowerCase() === selectedMealType.toLowerCase()
            )?.default_time
          }
          initialTime={prefillEntryTime({
            defaultTime: availableMealTypes?.find(
              (t) => t.name.toLowerCase() === selectedMealType.toLowerCase()
            )?.default_time,
            isToday: selectedDate === todayInZone(timezone),
            tz: timezone,
          })}
        />
      )}

      {/* Edit Food Entry Dialog */}
      {editingEntry && (
        <EditFoodEntryDialog
          entry={editingEntry}
          open={true}
          onOpenChange={(open) => !open && setEditingEntry(null)}
          availableMealTypes={availableMealTypes ?? []}
        />
      )}

      {/* Copy Food Entry Dialog */}
      {isCopyDialogOpen && (
        <CopyFoodEntryDialog
          key={isCopyDialogOpen ? 'open' : 'closed'}
          isOpen={isCopyDialogOpen}
          onClose={() => setIsCopyDialogOpen(false)}
          onCopy={handleCopyFoodEntries}
          sourceMealType={copySourceMealType}
        />
      )}

      {/* Edit Meal Food Entry Dialog */}
      {editingFoodEntryMeal && (
        <EditMealFoodEntryDialog
          foodEntry={editingFoodEntryMeal}
          open={true}
          onOpenChange={(open) => !open && setEditingFoodEntryMeal(null)}
        />
      )}

      <LogMealDialog
        mealTemplate={selectedMealTemplate}
        open={isLogMealDialogOpen}
        onOpenChange={setIsLogMealDialogOpen}
        date={selectedDate}
        mealType={selectedMealType}
        initialEntryTime={prefillEntryTime({
          defaultTime: availableMealTypes?.find(
            (t) => t.name.toLowerCase() === selectedMealType.toLowerCase()
          )?.default_time,
          isToday: selectedDate === todayInZone(timezone),
          tz: timezone,
        })}
      />

      {/* Convert to Meal Dialog */}
      {isConvertToMealDialogOpen && (
        <ConvertToMealDialog
          isOpen={isConvertToMealDialogOpen}
          onClose={() => setIsConvertToMealDialogOpen(false)}
          selectedDate={selectedDate}
          mealType={convertToMealSourceMealType}
        />
      )}

      {/* Copy Family Entry Dialog */}
      {isCopyFamilyDialogOpen && (
        <CopyFamilyEntryDialog
          isOpen={isCopyFamilyDialogOpen}
          onClose={() => setIsCopyFamilyDialogOpen(false)}
          sourceMealType={copyFamilySourceMealType}
          currentDate={selectedDate}
        />
      )}
    </div>
  );
};

export default Diary;
