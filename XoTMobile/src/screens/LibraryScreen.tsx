import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useCSSVariable } from 'uniwind';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useNativeIOSTabsActive } from '../services/nativeTabBarPreference';
import { useNavigationActionGuard } from '../hooks/useNavigationActionGuard';
import Button from '../components/ui/Button';
import CreateTile from '../components/CreateTile';
import FoodLibraryRow from '../components/FoodLibraryRow';
import Icon, { type IconName } from '../components/Icon';
import MealLibraryRow from '../components/MealLibraryRow';
import StatusView from '../components/StatusView';
import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import {
  useFavorites,
  useFoods,
  useMeals,
  useMedications,
  useWaterContainersQuery,
  useRecentMeals,
  useServerConnection,
  useSuggestedExercises,
} from '../hooks';
import { fetchExercisesCount } from '../services/api/exerciseApi';
import { fetchFoodsPage } from '../services/api/foodsApi';
import { fetchWorkoutPresetsPage } from '../services/api/workoutPresetsApi';
import type { Exercise } from '../types/exercise';
import { foodItemToFoodInfo } from '../types/foodInfo';
import type { FoodItem } from '../types/foods';
import type { Meal } from '../types/meals';
import type { RootStackParamList, TabParamList } from '../types/navigation';
import TabScreenHeader from '../components/TabScreenHeader';
import ScreenBackground from '../components/ui/ScreenBackground';
import { useNeonScale } from '../components/tracking/useNeonScale';
import { useDiaryDateStore } from '../stores/diaryDateStore';

type LibraryScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'More'>,
  NativeStackScreenProps<RootStackParamList>
>;

const RECENT_LIMIT = 4;

type RecentItem =
  | { type: 'meal'; data: Meal }
  | { type: 'food'; data: FoodItem }
  | { type: 'exercise'; data: Exercise };

interface BrowseRowProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  count?: number | string;
  onPress: () => void;
  testID?: string;
}

const BrowseRow: React.FC<BrowseRowProps> = ({
  icon,
  title,
  subtitle,
  count,
  onPress,
  testID,
}) => {
  const accentColor = useCSSVariable('--color-accent-primary') as string;
  const textSecondary = useCSSVariable('--color-text-secondary') as string;
  return (
    <SettingsRow
      icon={icon}
      iconColor={accentColor}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      testID={testID}
      accessibilityLabel={[title, subtitle, count]
        .filter((value) => value !== undefined)
        .join('. ')}
      rightAccessory={
        count !== undefined ? (
          <View className="flex-row items-center shrink-0">
            <Text className="text-text-secondary text-base mr-2">{count}</Text>
            <Icon name="chevron-forward" size={20} color={textSecondary} />
          </View>
        ) : undefined
      }
    />
  );
};

const LibraryScreen: React.FC<LibraryScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const tileLayout = {
    className: fontScale > 1.3 ? 'w-full mb-3' : 'w-[48%] mb-3',
    wrapText: fontScale > 1.3,
  };
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding();
  const usesNativeTabs = useNativeIOSTabsActive();
  const accentColor = useCSSVariable('--color-accent-primary') as string;
  const neon = useNeonScale();
  const selectedDate = useDiaryDateStore((state) => state.selectedDate);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isNavigationLocked, runNavigationAction } =
    useNavigationActionGuard(navigation);
  const { isConnected, isLoading: isConnectionLoading } = useServerConnection();
  const { favoriteFoods, favoriteMeals } = useFavorites({
    enabled: isConnected,
  });
  const favoriteFoodIds = useMemo(
    () => new Set(favoriteFoods.map((f) => f.id)),
    [favoriteFoods]
  );
  const favoriteMealIds = useMemo(
    () => new Set(favoriteMeals.map((m) => m.id)),
    [favoriteMeals]
  );
  const {
    recentFoods,
    isLoading: isFoodsLoading,
    isError: isFoodsError,
    refetch: refetchFoods,
  } = useFoods({ enabled: isConnected });
  const {
    recentMeals,
    isLoading: isRecentMealsLoading,
    isError: isRecentMealsError,
    refetch: refetchRecentMeals,
  } = useRecentMeals({ enabled: isConnected, limit: RECENT_LIMIT });
  const { meals, refetch: refetchMeals } = useMeals({ enabled: isConnected });
  const { data: medications, refetch: refetchMedications } = useMedications({
    enabled: isConnected,
  });
  const { containers: waterContainers } = useWaterContainersQuery({
    enabled: isConnected,
  });
  const {
    recentExercises,
    isLoading: isRecentExercisesLoading,
    isError: isRecentExercisesError,
    refetch: refetchRecentExercises,
  } = useSuggestedExercises();
  // Foods count uses the ['foods', ...] prefix so it is invalidated by the
  // existing `foodsQueryKey` invalidations in useSaveFood / useDeleteFood.
  const { data: foodsCount, refetch: refetchFoodsCount } = useQuery({
    queryKey: ['foods', 'count'] as const,
    queryFn: () =>
      fetchFoodsPage({ page: 1, itemsPerPage: 1 }).then(
        (r) => r.pagination.totalCount
      ),
    enabled: isConnected,
    staleTime: 1000 * 60 * 5,
  });
  const { data: exercisesCount, refetch: refetchExercisesCount } = useQuery({
    queryKey: ['exercises', 'count'] as const,
    queryFn: fetchExercisesCount,
    enabled: isConnected,
    staleTime: 1000 * 60 * 5,
  });
  const { data: presetsCount, refetch: refetchPresetsCount } = useQuery({
    queryKey: ['workoutPresets', 'count'] as const,
    queryFn: () =>
      fetchWorkoutPresetsPage({ page: 1, pageSize: 1 }).then(
        (r) => r.pagination.totalCount
      ),
    enabled: isConnected,
    staleTime: 1000 * 60 * 5,
  });

  const onRefresh = useCallback(async () => {
    if (!isConnected) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchFoods(),
        refetchRecentMeals(),
        refetchMeals(),
        refetchFoodsCount(),
        refetchExercisesCount(),
        refetchPresetsCount(),
        refetchRecentExercises(),
        refetchMedications(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    isConnected,
    refetchFoods,
    refetchRecentMeals,
    refetchMeals,
    refetchFoodsCount,
    refetchExercisesCount,
    refetchPresetsCount,
    refetchRecentExercises,
    refetchMedications,
  ]);

  const recentItems = useMemo<RecentItem[]>(() => {
    const items: RecentItem[] = [];
    let mi = 0;
    let fi = 0;
    let ei = 0;
    while (items.length < RECENT_LIMIT) {
      const hasMeal = mi < recentMeals.length;
      const hasFood = fi < recentFoods.length;
      const hasExercise = ei < recentExercises.length;
      if (!hasMeal && !hasFood && !hasExercise) break;
      if (hasMeal) {
        items.push({ type: 'meal', data: recentMeals[mi++] });
        if (items.length >= RECENT_LIMIT) break;
      }
      if (hasFood) {
        items.push({ type: 'food', data: recentFoods[fi++] });
        if (items.length >= RECENT_LIMIT) break;
      }
      if (hasExercise)
        items.push({ type: 'exercise', data: recentExercises[ei++] });
    }
    return items;
  }, [recentMeals, recentFoods, recentExercises]);

  const isRecentLoading =
    isFoodsLoading || isRecentMealsLoading || isRecentExercisesLoading;
  const showRecentError =
    !isRecentLoading &&
    recentItems.length === 0 &&
    (isFoodsError || isRecentMealsError || isRecentExercisesError);

  const retryRecent = () => {
    void refetchFoods();
    void refetchRecentMeals();
    void refetchRecentExercises();
  };

  if (!isConnectionLoading && !isConnected) {
    return (
      <View
        className="flex-1 bg-background"
        style={usesNativeTabs ? undefined : { paddingTop: insets.top }}
      >
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          iconSize={64}
          title={t('screens.library.noServerConfigured', {
            defaultValue: 'No server configured',
          })}
          subtitle={t('screens.library.configureServer', {
            defaultValue:
              'Configure your server connection in Settings to view your library.',
          })}
          action={{
            label: t('screens.library.goToSettings', {
              defaultValue: 'Go to Settings',
            }),
            onPress: () => navigation.navigate('Settings'),
            variant: 'primary',
          }}
        />
      </View>
    );
  }

  if (isConnectionLoading) {
    return (
      <View
        className="flex-1 bg-background"
        style={usesNativeTabs ? undefined : { paddingTop: insets.top }}
      >
        <StatusView
          loading
          title={t('screens.library.loading', {
            defaultValue: 'Loading library...',
          })}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenBackground />
      <ScrollView
        className="flex-1"
        style={[
          { flex: 1 },
          usesNativeTabs ? undefined : { paddingTop: insets.top },
        ]}
        contentContainerStyle={{
          paddingHorizontal: 16,
          ...(!usesNativeTabs ? { paddingTop: 16 } : null),
          paddingBottom: insets.bottom + activeWorkoutBarPadding + 16,
        }}
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
        {!usesNativeTabs && (
          <View className="mb-3">
            <TabScreenHeader
              title={t('navigation.more', { defaultValue: 'More' })}
              subtitle={t('screens.library.subtitle', {
                defaultValue: 'Your entries and plans.',
              })}
              onHome={() => navigation.navigate('Dashboard')}
              onSettings={() => navigation.navigate('Settings')}
            />
          </View>
        )}

        <View className="mb-3">
          <Text className="text-lg font-semibold text-text-primary">
            {t('screens.library.dailyTracking', {
              defaultValue: 'Daily tracking',
            })}
          </Text>
        </View>

        <View
          className="flex-row flex-wrap justify-between mb-6"
          testID="more-daily-tracking"
        >
          <CreateTile
            testID="more-daily-checkin"
            icon="daily-checkin"
            color={neon.red}
            title={t('checkin.title', { defaultValue: 'Daily Check-In' })}
            subtitle={t('screens.library.checkinSubtitle', {
              defaultValue: 'Reflect on your day',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() => navigation.navigate('DailyCheckIn'))
            }
            {...tileLayout}
          />
          <CreateTile
            testID="more-habits"
            icon="habit"
            color={neon.green}
            title={t('habits.title', { defaultValue: 'Habits' })}
            subtitle={t('screens.library.habitsSubtitle', {
              defaultValue: 'Routines and reps',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() => navigation.navigate('Habits'))
            }
            {...tileLayout}
          />
          <CreateTile
            testID="more-supplements"
            icon="medication"
            color={neon.yellow}
            title={t('supplements.title', { defaultValue: 'Supplements' })}
            subtitle={t('screens.library.supplementsSubtitle', {
              defaultValue: 'Today’s routine',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() => navigation.navigate('Supplements'))
            }
            {...tileLayout}
          />
          <CreateTile
            testID="more-daily-progress"
            icon="chart-bar"
            color={neon.mint}
            title={t('progress.title', { defaultValue: 'Daily Progress' })}
            subtitle={t('screens.library.progressSubtitle', {
              defaultValue: 'Tasks done today',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() => navigation.navigate('DailyProgress'))
            }
            {...tileLayout}
          />
          <CreateTile
            testID="more-health-context"
            icon="bandage"
            color={neon.cyan}
            title={t('context.title', { defaultValue: 'Health context' })}
            subtitle={t('screens.library.contextSubtitle', {
              defaultValue: 'Injury, illness, vacation',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() => navigation.navigate('HealthContext'))
            }
            {...tileLayout}
          />
          <CreateTile
            icon="bell"
            color={neon.violet}
            title={t('trackingSettings.title', {
              defaultValue: 'Tracking settings',
            })}
            subtitle={t('screens.library.trackingSettingsSubtitle', {
              defaultValue: 'Progress and reminders',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() => navigation.navigate('TrackingSettings'))
            }
            {...tileLayout}
          />
          <CreateTile
            testID="more-wellness"
            icon="wellness"
            color={accentColor}
            title={t('wellness.title', { defaultValue: 'Wellness' })}
            subtitle={t('screens.library.wellnessSubtitle', {
              defaultValue: 'Log activity',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() =>
                navigation.navigate('Wellness', { date: selectedDate })
              )
            }
            {...tileLayout}
          />
          <CreateTile
            testID="more-mobility"
            icon="exercise-yoga"
            color={neon.cyan}
            title={t('screens.library.mobility', {
              defaultValue: 'Mobility',
            })}
            subtitle={t('screens.library.mobilitySubtitle', {
              defaultValue: 'Guided routines',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() => navigation.navigate('GuidedMobility'))
            }
            {...tileLayout}
          />
        </View>

        <View className="mb-3">
          <Text className="text-lg font-semibold text-text-primary">
            {t('screens.library.create', { defaultValue: 'Create' })}
          </Text>
        </View>

        <View className="flex-row flex-wrap justify-between mb-6">
          <CreateTile
            icon="food"
            title={t('screens.library.food', { defaultValue: 'Food' })}
            subtitle={t('screens.library.manualEntry', {
              defaultValue: 'Manual entry',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() =>
                navigation.navigate('FoodForm', {
                  mode: 'create-food',
                  pickerMode: 'library',
                })
              )
            }
            {...tileLayout}
          />
          <CreateTile
            icon="meal"
            title={t('screens.library.meal', { defaultValue: 'Meal' })}
            subtitle={t('screens.library.groupFoods', {
              defaultValue: 'Group foods',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() => navigation.navigate('MealAdd'))
            }
            {...tileLayout}
          />
          <CreateTile
            icon="exercise-weights"
            title={t('screens.library.exercise', { defaultValue: 'Exercise' })}
            subtitle={t('screens.library.manualEntry', {
              defaultValue: 'Manual entry',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() =>
                navigation.navigate('ExerciseForm', { mode: 'create-exercise' })
              )
            }
            {...tileLayout}
          />
          <CreateTile
            icon="bookmark-filled"
            title={t('screens.library.workoutPreset', {
              defaultValue: 'Workout preset',
            })}
            subtitle={t('screens.library.exerciseRoutine', {
              defaultValue: 'Exercise routine',
            })}
            disabled={isNavigationLocked}
            onPress={() =>
              runNavigationAction(() =>
                navigation.navigate('WorkoutPresetForm', {
                  mode: 'create-preset',
                })
              )
            }
            {...tileLayout}
          />
        </View>

        <View className="mb-3">
          <Text className="text-lg font-semibold text-text-primary">
            {t('screens.library.browse', { defaultValue: 'Browse' })}
          </Text>
        </View>

        <SettingsRowGroup className="mb-6">
          <BrowseRow
            icon="food"
            title={t('screens.library.foods', { defaultValue: 'Foods' })}
            count={foodsCount ?? '-'}
            onPress={() => navigation.navigate('FoodsLibrary')}
          />
          <BrowseRow
            icon="food"
            title={t('screens.library.meals', { defaultValue: 'Meals' })}
            count={meals.length}
            onPress={() => navigation.navigate('MealsLibrary')}
          />
          <BrowseRow
            icon="calendar"
            title={t('screens.library.mealPlans', {
              defaultValue: 'Meal plans',
            })}
            subtitle={t('screens.library.mealPlansSubtitle', {
              defaultValue: 'Repeat meals on selected days',
            })}
            onPress={() => navigation.navigate('MealPlans')}
          />
          <BrowseRow
            icon="exercise-weights"
            title={t('screens.library.exercises', {
              defaultValue: 'Exercises',
            })}
            count={exercisesCount ?? '-'}
            onPress={() => navigation.navigate('ExercisesLibrary')}
          />
          <BrowseRow
            icon="bookmark"
            title={t('screens.library.workoutPresets', {
              defaultValue: 'Workout presets',
            })}
            count={presetsCount ?? '-'}
            onPress={() => navigation.navigate('WorkoutPresetsLibrary')}
          />
          <BrowseRow
            icon="sparkles"
            title={t('coaching.title', { defaultValue: 'Recommendations' })}
            onPress={() => navigation.navigate('Coaching')}
          />
          <BrowseRow
            icon="exercise-yoga"
            title={t('mobility.title', { defaultValue: 'Guided mobility' })}
            subtitle={t('mobility.plannedOnPhone', {
              defaultValue: 'Plan sessions on the web and run them here.',
            })}
            onPress={() => navigation.navigate('GuidedMobility')}
          />
          <BrowseRow
            icon="heart"
            title={t('healthOverview.routines', {
              defaultValue: 'Health & routines',
            })}
            testID="more-health-routines"
            onPress={() =>
              navigation.navigate('HealthOverview', {
                section: 'routines',
                date: selectedDate,
              })
            }
          />
          <BrowseRow
            icon="exercise-running"
            title={t('trainingHub.title', {
              defaultValue: 'Training & routines',
            })}
            testID="more-training-plans"
            onPress={() =>
              navigation.navigate('TrainingHub', { date: selectedDate })
            }
          />
          <BrowseRow
            icon="chart-bar"
            title={t('exerciseReview.title', {
              defaultValue: 'Exercise review',
            })}
            subtitle={t('exerciseReview.librarySubtitle', {
              defaultValue: 'Compare activity by day, week, month, or year',
            })}
            onPress={() => navigation.navigate('ExerciseReview')}
          />
          <BrowseRow
            icon="water"
            title={t('screens.library.waterContainers', {
              defaultValue: 'Water containers',
            })}
            subtitle={t('screens.library.waterContainersSubtitle', {
              defaultValue: 'Bottles, glasses, and drinks linked to foods',
            })}
            count={waterContainers.length}
            onPress={() => navigation.navigate('WaterContainers')}
          />
          <BrowseRow
            icon="medication"
            title={t('screens.library.medications', {
              defaultValue: 'Medications & supplements',
            })}
            count={medications?.length ?? '-'}
            onPress={() => navigation.navigate('MedicationsList')}
          />
        </SettingsRowGroup>

        <View className="mb-3">
          <Text className="text-lg font-semibold text-text-primary">
            {t('screens.library.recentlyLogged', {
              defaultValue: 'Recently Logged',
            })}
          </Text>
        </View>

        <View className="bg-surface rounded-2xl overflow-hidden border border-border-subtle">
          {isRecentLoading ? (
            <View className="px-4 py-8 items-center">
              <ActivityIndicator size="small" color="#6B7280" />
              <Text className="text-text-secondary text-sm mt-3">
                {t('screens.library.loadingRecentItems', {
                  defaultValue: 'Loading recent items...',
                })}
              </Text>
            </View>
          ) : showRecentError ? (
            <View className="px-4 py-6 items-start">
              <Text className="text-text-secondary text-sm">
                {t('screens.library.failedRecentItems', {
                  defaultValue: 'Failed to load recent items.',
                })}
              </Text>
              <Button
                variant="link"
                className="px-0 py-0 mt-3"
                textClassName="text-sm"
                onPress={retryRecent}
              >
                {t('common.retry', { defaultValue: 'Retry' })}
              </Button>
            </View>
          ) : recentItems.length > 0 ? (
            recentItems.map((item, index) => {
              const showDivider = index < recentItems.length - 1;
              if (item.type === 'meal') {
                return (
                  <MealLibraryRow
                    key={`meal-${item.data.id}`}
                    meal={item.data}
                    isFavorite={favoriteMealIds.has(item.data.id)}
                    showDivider={showDivider}
                    onPress={() =>
                      navigation.navigate('MealDetail', {
                        mealId: item.data.id,
                        initialMeal: item.data,
                      })
                    }
                  />
                );
              }
              if (item.type === 'food') {
                return (
                  <FoodLibraryRow
                    key={`food-${item.data.id}`}
                    food={item.data}
                    isFavorite={favoriteFoodIds.has(item.data.id)}
                    showDivider={showDivider}
                    onPress={() =>
                      navigation.navigate('FoodDetail', {
                        item: foodItemToFoodInfo(item.data),
                      })
                    }
                  />
                );
              }
              return (
                <Pressable
                  key={`exercise-${item.data.id}`}
                  className={`px-4 py-3 ${showDivider ? 'border-b border-border-subtle' : ''}`}
                  onPress={() =>
                    navigation.navigate('ExerciseDetail', { item: item.data })
                  }
                  style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
                >
                  <Text className="text-text-primary text-base font-medium">
                    {item.data.name}
                  </Text>
                  {item.data.category ? (
                    <Text className="text-text-secondary text-sm mt-0.5">
                      {item.data.category}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <View className="px-4 py-6">
              <Text className="text-text-primary text-base font-medium">
                {t('screens.library.noRecentItems', {
                  defaultValue: 'No recent items yet',
                })}
              </Text>
              <Text className="text-text-secondary text-sm mt-1">
                {t('screens.library.recentItemsHint', {
                  defaultValue:
                    'Foods, meals, and exercises you log will appear here for quick access.',
                })}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default LibraryScreen;
