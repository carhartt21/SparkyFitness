import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Droplet,
  Dumbbell,
  Flame,
  Target,
  ScanLine,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';
import { pickMealTypeForTime, todayInZone } from '@workspace/shared';
import DayNavigator from '@/components/DayNavigator';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useDailySummary } from '@/hooks/Diary/useDailyProgress';
import {
  useDiaryGoals,
  useFoodEntries,
  useFoodEntryMeals,
} from '@/hooks/Diary/useFoodEntries';
import { useMealTypes } from '@/hooks/Diary/useMealTypes';
import { useWaterControls } from '@/hooks/Diary/useWaterControls';
import {
  addSupplementTotals,
  calculateDayTotals,
  convertMlToSelectedUnit,
  getEnergyUnitString,
} from '@/utils/nutritionCalculations';
import {
  groupDashboardMeals,
  summarizeActivity,
} from '@/utils/dashboardSummary';
import { mealTypeLabel } from '@/utils/mealTypeLabel';
import {
  LoggingStreakBadge,
  TodaysFocusCard,
} from '@/pages/Diary/TodaysFocusCard';
import { DailyProgressCard } from '@/pages/Dashboard/DailyProgressCard';
import { useDailyTrackingProgress } from '@/hooks/Tracking/useTracking';
import {
  ActivityCard,
  EnergyCard,
  GlanceCard,
  HydrationCard,
  MacrosCard,
  MealsCard,
  QuickAddCard,
  type MacroRow,
} from './DashboardCards';

type DiaryFocus = 'exercise' | 'water';

/**
 * Old links pointed the Diary at `/` (with `?date=` or a food-search request
 * in navigation state). Those now belong to `/diary`.
 */
export default function DashboardRoute() {
  const location = useLocation();
  const state = location.state as { openFoodSearchForMeal?: string } | null;
  if (
    new URLSearchParams(location.search).has('date') ||
    state?.openFoodSearchForMeal
  ) {
    return (
      <Navigate
        to={`/diary${location.search}`}
        state={location.state}
        replace
      />
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { timezone, energyUnit, convertEnergy } = usePreferences();
  const [selectedDate, setSelectedDate] = useState(() => todayInZone(timezone));
  const isToday = selectedDate === todayInZone(timezone);

  const { data: summary, isLoading: summaryLoading } =
    useDailySummary(selectedDate);
  const { data: goals, isLoading: goalsLoading } = useDiaryGoals(selectedDate);
  const { data: fetchedEntries } = useFoodEntries(selectedDate);
  const { data: foodEntryMeals } = useFoodEntryMeals(selectedDate);
  const { data: mealTypes } = useMealTypes();
  const water = useWaterControls(selectedDate);
  const { data: trackingProgress } = useDailyTrackingProgress(selectedDate);

  const unit = getEnergyUnitString(energyUnit);
  const format = (kcal: number) =>
    Math.round(convertEnergy(kcal, 'kcal', energyUnit)).toLocaleString();

  const foodEntries = useMemo(
    () => (fetchedEntries ?? []).filter((entry) => !entry.food_entry_meal_id),
    [fetchedEntries]
  );
  const dayTotals = addSupplementTotals(
    calculateDayTotals(foodEntries, foodEntryMeals ?? []),
    summary?.supplementTotals
  );
  const effectiveGoals = goals
    ? summary?.adjustedGoals
      ? { ...goals, ...summary.adjustedGoals }
      : goals
    : undefined;

  const visibleMealTypes = useMemo(
    () =>
      (mealTypes ?? [])
        .filter((type) => type.is_visible !== false)
        .sort((a, b) => a.sort_order - b.sort_order),
    [mealTypes]
  );
  const meals = useMemo(
    () =>
      groupDashboardMeals(
        foodEntries,
        foodEntryMeals,
        visibleMealTypes.map((type) => type.name)
      ),
    [foodEntries, foodEntryMeals, visibleMealTypes]
  );
  const activity = useMemo(
    () => summarizeActivity(summary?.exerciseSessions),
    [summary?.exerciseSessions]
  );

  const diaryUrl = `/diary?date=${selectedDate}`;
  const openDiary = (focus?: DiaryFocus) =>
    navigate(diaryUrl, focus ? { state: { focusWidget: focus } } : undefined);
  const openFoodSearch = (mealName?: string, startWithScanner = false) => {
    const now = new Date();
    const meal =
      mealName ??
      pickMealTypeForTime(visibleMealTypes, {
        hour: now.getHours(),
        minute: now.getMinutes(),
      })?.name;
    if (!meal) {
      openDiary();
      return;
    }
    navigate(diaryUrl, {
      state: { openFoodSearchForMeal: meal.toLowerCase(), startWithScanner },
    });
  };

  const waterUnit =
    water.currentContainer?.unit || water.water_display_unit || 'ml';
  const waterDecimals = waterUnit === 'oz' ? 1 : waterUnit === 'liter' ? 2 : 0;
  const waterValue = (ml: number) =>
    `${parseFloat(convertMlToSelectedUnit(ml, waterUnit).toFixed(waterDecimals))}`;

  const macroRows: MacroRow[] = [
    {
      key: 'protein',
      label: t('nutrition.protein', 'Protein'),
      consumed: dayTotals.protein,
      goal: effectiveGoals?.protein ?? 0,
    },
    {
      key: 'carbs',
      label: t('nutrition.carbs', 'Carbs'),
      consumed: dayTotals.carbs,
      goal: effectiveGoals?.carbs ?? 0,
    },
    {
      key: 'fat',
      label: t('nutrition.fat', 'Fat'),
      consumed: dayTotals.fat,
      goal: effectiveGoals?.fat ?? 0,
    },
    {
      key: 'fiber',
      label: t('nutrition.fiber', 'Fiber'),
      consumed: dayTotals.dietary_fiber,
      goal: effectiveGoals?.dietary_fiber ?? 0,
    },
  ];

  const balance = summary?.calorieBalance;
  const loading = summaryLoading || goalsLoading;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {isToday
              ? t('dashboardWeb.title', "Today's overview")
              : t('dashboardWeb.titleOtherDay', 'Day overview')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'dashboardWeb.subtitle',
              'Your nutrition, activity and habits at a glance.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LoggingStreakBadge selectedDate={selectedDate} />
          <DayNavigator
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            className="mb-0 flex grid-cols-none items-center gap-2"
          />
        </div>
      </header>

      {loading ? (
        <div role="status" className="py-12 text-center text-muted-foreground">
          {t('common.loading', 'Loading...')}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-[1.25fr_1.1fr_0.85fr_1fr]">
            <EnergyCard
              unit={unit}
              goal={balance?.goal ?? 0}
              eaten={balance?.eaten ?? dayTotals.calories}
              burned={balance?.burned ?? 0}
              remaining={balance?.remaining ?? 0}
              progress={balance?.progress ?? 0}
              format={format}
              onDetails={() => openDiary()}
            />
            <MacrosCard rows={macroRows} onDetails={() => openDiary()} />
            <HydrationCard
              valueLabel={`${waterValue(water.waterMl)} ${waterUnit}`}
              goalLabel={
                water.hasWaterGoal && typeof water.waterGoalMl === 'number'
                  ? t(
                      'dashboardWeb.hydration.ofGoal',
                      'of {{value}} {{unit}}',
                      {
                        value: waterValue(water.waterGoalMl),
                        unit: waterUnit,
                      }
                    )
                  : null
              }
              fillPercentage={water.fillPercentage}
              hasGoal={water.hasWaterGoal}
              perDrinkLabel={water.getVolumeDisplay()}
              canRemove={water.manualWaterMl > 0}
              busy={water.loading}
              onAdd={() => water.adjustWater(1)}
              onRemove={() => water.adjustWater(-1)}
              onDetails={() => openDiary('water')}
            />
            <ActivityCard
              minutes={activity.minutes}
              calories={activity.calories}
              recent={activity.recent}
              unit={unit}
              format={format}
              onLog={() => openDiary('exercise')}
              onDetails={() => openDiary('exercise')}
            />
          </div>

          <div className="grid gap-4 2xl:grid-cols-[1.6fr_1fr]">
            <MealsCard
              meals={meals}
              labelFor={(name) => mealTypeLabel(t, name)}
              unit={unit}
              format={format}
              onOpenMeal={() => openDiary()}
              onAddMeal={() => openFoodSearch()}
              onViewAll={() => openDiary()}
            />
            <QuickAddCard
              actions={[
                {
                  key: 'food',
                  label: t('dashboardWeb.quickAdd.food', 'Food'),
                  icon: <Utensils className="h-6 w-6" />,
                  tone: 'red',
                  onClick: () => openFoodSearch(),
                  disabled: visibleMealTypes.length === 0,
                },
                {
                  key: 'exercise',
                  label: t('dashboardWeb.quickAdd.exercise', 'Exercise'),
                  icon: <Activity className="h-6 w-6" />,
                  tone: 'yellow',
                  onClick: () => openDiary('exercise'),
                },
                {
                  key: 'water',
                  label: t('dashboardWeb.quickAdd.water', 'Water'),
                  icon: <Droplet className="h-6 w-6" />,
                  tone: 'cyan',
                  onClick: () => water.adjustWater(1),
                  disabled: water.loading,
                },
                {
                  key: 'scan',
                  label: t('dashboardWeb.quickAdd.scan', 'Scan'),
                  icon: <ScanLine className="h-6 w-6" />,
                  tone: 'green',
                  onClick: () => openFoodSearch(undefined, true),
                  disabled: visibleMealTypes.length === 0,
                },
              ]}
            />
          </div>

          <div className="grid gap-4 2xl:grid-cols-[1.6fr_1fr]">
            <GlanceCard
              title={
                isToday
                  ? t('dashboardWeb.glance.today', 'Today at a glance')
                  : t('dashboardWeb.glance.day', 'Day at a glance')
              }
              stats={[
                {
                  key: 'meals',
                  value: String(meals.length),
                  label: t('dashboardWeb.glance.meals', 'Meals logged'),
                  icon: <UtensilsCrossed className="h-6 w-6" />,
                  tone: 'orange',
                },
                {
                  key: 'workouts',
                  value: String(activity.workouts),
                  label: t('dashboardWeb.glance.workouts', 'Workouts'),
                  icon: <Dumbbell className="h-6 w-6" />,
                  tone: 'yellow',
                },
                {
                  key: 'drinks',
                  value: String(water.logEntries.length),
                  label: t('dashboardWeb.glance.drinks', 'Drinks'),
                  icon: <Droplet className="h-6 w-6" />,
                  tone: 'cyan',
                },
                {
                  key: 'net',
                  value: format(balance?.net ?? 0),
                  label: t('dashboardWeb.glance.net', 'Net {{unit}}', { unit }),
                  icon: <Flame className="h-6 w-6" />,
                  tone: 'red',
                },
                {
                  key: 'goal',
                  value:
                    (balance?.goal ?? 0) > 0
                      ? `${Math.round(balance?.progress ?? 0)}%`
                      : '—',
                  label: t('dashboardWeb.glance.goal', 'Daily goal'),
                  icon: <Target className="h-6 w-6" />,
                  tone: 'mint',
                },
              ]}
            />
            <div className="flex flex-col gap-4">
              {trackingProgress ? (
                <DailyProgressCard
                  progress={trackingProgress}
                  dayLabel={
                    isToday
                      ? t('dashboardWeb.today', 'Today')
                      : // Noon keeps the calendar day stable in every zone.
                        new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                          i18n.language,
                          { weekday: 'short', month: 'short', day: 'numeric' }
                        )
                  }
                />
              ) : null}
              {effectiveGoals ? (
                <TodaysFocusCard
                  caloriesEaten={balance?.eaten ?? dayTotals.calories}
                  calorieGoal={effectiveGoals.calories}
                  proteinConsumed={dayTotals.protein}
                  proteinGoal={effectiveGoals.protein}
                  waterMl={summary ? summary.waterIntake : null}
                  waterGoalMl={effectiveGoals.water_goal_ml ?? 0}
                  foodEntryCount={
                    (fetchedEntries?.length ?? 0) +
                    (foodEntryMeals?.length ?? 0)
                  }
                  onEditGoals={() => navigate('/goals')}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
