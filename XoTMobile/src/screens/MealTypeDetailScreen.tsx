import { isFddbImportMeal } from '@workspace/shared';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import type { MealDayStatusValue } from '@workspace/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import FoodNutritionSummary from '../components/FoodNutritionSummary';
import ServingAdjustSheet, {
  type ServingAdjustSheetRef,
} from '../components/ServingAdjustSheet';
import CopyMealSheet, {
  type CopyMealSheetRef,
} from '../components/CopyMealSheet';
import SwipeableFoodRow from '../components/SwipeableFoodRow';
import StatusView from '../components/StatusView';
import MealStatusControl from '../components/tracking/MealStatusControl';
import Button from '../components/ui/Button';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import { useDailySummary, useServerConnection, useMealTypes } from '../hooks';
import { useCopyFoodEntries } from '../hooks/useCopyFoodEntries';
import {
  useMealTrackingStatus,
  useSetMealStatus,
} from '../hooks/useDailyTracking';
import { usePreferences } from '../hooks/usePreferences';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useAppLocale } from '../localization/i18n';
import { formatDateLabel } from '../utils/dateUtils';
import {
  calculateEntryNutrition,
  calculateMealNutrition,
  filterFoodEntriesByMealTypeId,
  getHistoricalMealTypeLabel,
  getMealPercentage,
} from '../utils/mealNutrition';
import type { RootStackScreenProps } from '../types/navigation';
import { getLocalizedMealLabel } from '../constants/meals';

type MealTypeDetailScreenProps = RootStackScreenProps<'MealTypeDetail'>;

const MealTypeDetailScreen: React.FC<MealTypeDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const dateLocale = useAppLocale();
  const { date, mealType, mealTypeId, mealLabel } = route.params;
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const servingSheetRef = useRef<ServingAdjustSheetRef>(null);
  const copySheetRef = useRef<CopyMealSheetRef>(null);
  const accentColor = useCSSVariable('--color-accent-primary') as string;

  const { isConnected, isLoading: isConnectionLoading } = useServerConnection();
  const { summary, isLoading, isError, refetch } = useDailySummary({
    date,
    enabled: isConnected,
  });
  const { preferences } = usePreferences({ enabled: isConnected });
  const showNetCarbs = preferences?.show_net_carbs === true;

  const { mealTypes } = useMealTypes({ includeReadOnly: true });

  const [refreshing, setRefreshing] = useState(false);

  // Resolve the display label from the canonical definition (ownership-aware):
  // a pre-resolved mealLabel wins (Diary sends it), otherwise resolve from the
  // active meal type by id, then fall back to the literal historical name.
  const resolvedType = useMemo(() => {
    if (mealTypeId) {
      return mealTypes.find((m) => m.id === mealTypeId) ?? null;
    }
    return null;
  }, [mealTypeId, mealTypes]);
  const mealTypeName = resolvedType?.name ?? mealType ?? '';
  const readOnly = isFddbImportMeal(mealTypeName);
  const label =
    mealLabel ??
    (resolvedType
      ? resolvedType.user_id == null
        ? getLocalizedMealLabel(
            t,
            resolvedType.name.toLowerCase() === 'snack'
              ? 'snacks'
              : resolvedType.name.toLowerCase()
          )
        : resolvedType.name
      : getHistoricalMealTypeLabel(mealTypeName, t));

  const mealStatusQuery = useMealTrackingStatus(date, {
    enabled: isConnected && Boolean(resolvedType) && !readOnly,
  });
  const { refetch: refetchMealStatus } = mealStatusQuery;
  const setMealStatus = useSetMealStatus(date);
  const trackedMeal = mealStatusQuery.data?.meals.find(
    (meal) => meal.meal_type_id === resolvedType?.id
  );

  const onSetMealStatus = (status: MealDayStatusValue | null) => {
    if (!trackedMeal || setMealStatus.isPending) return;
    setMealStatus.mutate(
      { entry_date: date, meal_type_id: trackedMeal.meal_type_id, status },
      {
        onError: () =>
          Toast.show({
            type: 'error',
            text1: t('mealStatus.saveFailed', {
              defaultValue: 'Could not save the meal status.',
            }),
          }),
      }
    );
  };

  const entries = useMemo(
    () =>
      filterFoodEntriesByMealTypeId(
        summary?.foodEntries ?? [],
        mealTypeId,
        mealTypeName,
        mealTypes
      ),
    [summary?.foodEntries, mealTypeId, mealTypeName, mealTypes]
  );
  const nutrition = useMemo(() => calculateMealNutrition(entries), [entries]);
  const isSystemMealType = resolvedType ? resolvedType.user_id === null : false;
  const targetCalories = useMemo(() => {
    // Target-calorie percentages are only meaningful for SYSTEM meal types: a
    // custom type named "breakfast" (or a historical group) must never inherit
    // the system Breakfast target calories.
    if (!isSystemMealType || !summary?.goals || !summary?.calorieGoal) return 0;
    const percentage = getMealPercentage(mealTypeName, summary.goals);
    return Math.round((summary.calorieGoal * percentage) / 100);
  }, [isSystemMealType, summary, mealTypeName]);

  const { copyMeal, isPending: isCopying } = useCopyFoodEntries({
    onSuccess: () => copySheetRef.current?.dismiss(),
  });
  // "other" is a synthetic bucket that aggregates every non-standard meal type,
  // so it has no single real meal type to copy from (the server would match
  // nothing). Only offer copy for concrete meal types.
  const canCopy =
    !readOnly &&
    isConnected &&
    entries.length > 0 &&
    mealTypeName.toLowerCase() !== 'other';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        ...(resolvedType ? [refetchMealStatus()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, resolvedType, refetchMealStatus]);

  const renderMealStatus = () => {
    // Historical/aggregate groups have no current meal identity to update.
    // Do not show an invented "pending" state while the read is unavailable.
    if (
      readOnly ||
      !resolvedType ||
      (!trackedMeal && !mealStatusQuery.isPending && !mealStatusQuery.isError)
    )
      return null;

    return (
      <View className="flex-row items-center gap-3 rounded-xl bg-surface p-4">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-base font-semibold text-text-primary">
            {t('mealStatus.title', {
              defaultValue: '{{meal}} status',
              meal: label,
            })}
          </Text>
          <Text className="text-sm text-text-secondary">
            {mealStatusQuery.isError
              ? t('mealStatus.loadFailed', {
                  defaultValue: 'Could not load the meal status.',
                })
              : mealStatusQuery.isPending
                ? t('mealStatus.loading', {
                    defaultValue: 'Loading status…',
                  })
                : t('mealStatus.hint', {
                    defaultValue: 'Touch and hold to choose a specific status.',
                  })}
          </Text>
        </View>
        {mealStatusQuery.isError ? (
          <Button variant="secondary" onPress={() => mealStatusQuery.refetch()}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        ) : mealStatusQuery.isPending ? (
          <ActivityIndicator color={accentColor} />
        ) : trackedMeal ? (
          <MealStatusControl
            mealLabel={label}
            state={trackedMeal.state}
            onChange={onSetMealStatus}
            busy={setMealStatus.isPending || mealStatusQuery.isFetching}
          />
        ) : null}
      </View>
    );
  };

  const renderContent = () => {
    if (!isConnectionLoading && !isConnected) {
      return (
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          iconSize={64}
          title={t('mealTypeDetail.states.noServer', {
            defaultValue: 'No server configured',
          })}
          subtitle={t('mealTypeDetail.states.noServerHint', {
            defaultValue:
              'Configure your server connection in Settings to view meal nutrition.',
          })}
          action={{
            label: t('common.goToSettings', { defaultValue: 'Go to Settings' }),
            onPress: () => navigation.navigate('Settings'),
            variant: 'primary',
          }}
        />
      );
    }

    if (isLoading || isConnectionLoading) {
      return (
        <StatusView
          loading
          title={t('mealTypeDetail.states.loading', {
            defaultValue: 'Loading meal…',
          })}
        />
      );
    }

    if (isError) {
      return (
        <StatusView
          icon="alert-circle"
          iconTone="danger"
          iconSize={64}
          title={t('mealTypeDetail.states.loadFailed', {
            defaultValue: 'Failed to load meal',
          })}
          subtitle={t('common.connectionRetry', {
            defaultValue: 'Please check your connection and try again.',
          })}
          action={{
            label: t('common.retry', { defaultValue: 'Retry' }),
            onPress: () => refetch(),
            variant: 'primary',
          }}
        />
      );
    }

    return (
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-4 gap-5"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 16 + activeWorkoutBarPadding,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
          />
        }
      >
        {renderMealStatus()}
        {entries.length === 0 ? (
          <StatusView
            inline
            icon="food"
            iconTone="muted"
            iconSize={64}
            title={t('mealTypeDetail.states.noFoods', {
              defaultValue: 'No foods logged for {{meal}}',
              meal: label,
            })}
            subtitle={t('mealTypeDetail.states.noFoodsHint', {
              defaultValue: '{{date}} has no foods logged for this meal.',
              date: formatDateLabel(date, t, dateLocale),
            })}
            action={
              readOnly
                ? undefined
                : {
                    label: t('mealTypeDetail.accessibility.addFood', {
                      defaultValue: 'Add Food',
                    }),
                    onPress: () =>
                      navigation.navigate('FoodSearch', {
                        date,
                        mealTypeId: resolvedType?.id,
                      }),
                    variant: 'primary',
                  }
            }
          />
        ) : (
          <>
            <FoodNutritionSummary
              name={label}
              brand={
                targetCalories > 0
                  ? `${formatDateLabel(date, t, dateLocale)} · ${t('mealTypeDetail.targetCalories', { defaultValue: 'Target: {{calories}} kcal', calories: targetCalories })}`
                  : formatDateLabel(date, t, dateLocale)
              }
              values={nutrition.values}
              showNetCarbs={showNetCarbs}
              customNutrients={
                Object.keys(nutrition.customNutrients).length > 0
                  ? nutrition.customNutrients
                  : null
              }
              calorieGoal={targetCalories > 0 ? targetCalories : undefined}
            />

            <View className="bg-surface rounded-xl p-4 shadow-sm">
              <View className="flex-row items-center mb-3">
                <Text className="text-base font-bold text-text-secondary flex-1">
                  {t('mealTypeDetail.labels.foods', { defaultValue: 'Foods' })}
                </Text>
                <Text className="text-xs text-text-muted font-medium">
                  {t('common.itemCount', {
                    defaultValue: '{{count}} items',
                    count: entries.length,
                  })}
                </Text>
              </View>
              {entries.map((entry, index) => (
                <SwipeableFoodRow
                  key={entry.id || index}
                  entry={entry}
                  nutrition={calculateEntryNutrition(entry)}
                  readOnly={readOnly}
                  onAdjustServing={
                    readOnly
                      ? undefined
                      : (foodEntry) =>
                          servingSheetRef.current?.present(foodEntry)
                  }
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    );
  };

  const header = useScreenHeader({
    left: { kind: 'back' },
    right: [
      ...(!readOnly
        ? [
            {
              kind: 'icon',
              sfSymbol: 'plus',
              ionicon: 'add',
              role: 'primary',
              onPress: () =>
                navigation.navigate('FoodSearch', {
                  date,
                  mealTypeId: resolvedType?.id,
                }),
              accessibilityLabel: t('mealTypeDetail.accessibility.addFood', {
                defaultValue: 'Add Food',
              }),
              identifier: 'meal-type-detail-add',
            } as const,
          ]
        : []),
      ...(canCopy
        ? [
            {
              kind: 'icon' as const,
              sfSymbol: 'doc.on.doc',
              ionicon: 'copy-outline',
              role: 'secondary' as const,
              onPress: () =>
                copySheetRef.current?.present(
                  date,
                  mealTypeId ?? null,
                  mealTypeName
                ),
              accessibilityLabel: t('mealTypeDetail.accessibility.copyMeal', {
                defaultValue: 'Copy meal to another day',
              }),
              identifier: 'meal-type-detail-copy',
            },
          ]
        : []),
    ],
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}

      {renderContent()}

      <ServingAdjustSheet
        ref={servingSheetRef}
        onViewEntry={(entry) => navigation.navigate('FoodEntryView', { entry })}
      />
      <CopyMealSheet
        ref={copySheetRef}
        isPending={isCopying}
        onCopy={copyMeal}
      />
    </View>
  );
};

export default MealTypeDetailScreen;
