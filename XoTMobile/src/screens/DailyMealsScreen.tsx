import { useMemo, useRef, useState } from 'react';
import { todayInZone } from '@workspace/shared';
import { Alert, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Toast from 'react-native-toast-message';
import DailyDetailScreen from '../components/DailyDetailScreen';
import FoodSummary from '../components/FoodSummary';
import DiaryBulkActionSheet from '../components/DiaryBulkActionSheet';
import ServingAdjustSheet, {
  type ServingAdjustSheetRef,
} from '../components/ServingAdjustSheet';
import PendingNutritionActions from '../components/PendingNutritionActions';
import NutritionPhotoEntries from '../components/NutritionPhotoEntries';
import StatusView from '../components/StatusView';
import Button from '../components/ui/Button';
import Icon from '../components/Icon';
import {
  useDailySummary,
  useMealTypes,
  usePreferences,
  useServerConnection,
} from '../hooks';
import {
  useMealTrackingStatus,
  useSetMealStatus,
} from '../hooks/useDailyTracking';
import { useDiaryFoodEditing } from '../hooks/useDiaryFoodEditing';
import { useFoodDragScroll } from '../hooks/useFoodDragScroll';
import { useNutritionDiaryActions } from '../hooks/useNutritionDiaryActions';
import { useNutritionCapturesByDate } from '../hooks/useNutritionCapturesByDate';
import { nutritionCapturePhotoRefs } from '../utils/nutritionCapturePhotoRefs';
import { projectPhotoCompletions } from '../utils/projectPhotoCompletions';
import { diaryMealGroups } from '../utils/diaryTimeline';
import { diaryMealDraft } from '../utils/diaryMealDraft';
import { getTodayDate } from '../utils/dateUtils';
import { formatLocalizedNumber } from '../localization';
import type { RootStackScreenProps } from '../types/navigation';
import type { FoodEntry } from '../types/foodEntries';

const EMPTY: FoodEntry[] = [];
export default function DailyMealsScreen({
  navigation,
  route,
}: RootStackScreenProps<'DailyMeals'>) {
  const { t } = useTranslation();
  const expandedText = useWindowDimensions().fontScale > 1.3;
  const [date, setDate] = useState(route.params?.date ?? getTodayDate());
  const { isConnected } = useServerConnection();
  const daily = useDailySummary({ date, enabled: isConnected });
  const { preferences } = usePreferences();
  const today = () =>
    todayInZone(
      preferences?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  const types = useMealTypes({ includeReadOnly: true, enabled: isConnected });
  const status = useMealTrackingStatus(date, { enabled: isConnected });
  const saveStatus = useSetMealStatus(date);
  const states = useMemo(
    () =>
      new Map(
        (status.data?.meals ?? []).map((meal) => [
          meal.meal_type_id,
          meal.state,
        ])
      ),
    [status.data]
  );
  const edit = useDiaryFoodEditing(date);
  const drag = useFoodDragScroll(edit.editingFoods);
  const serving = useRef<ServingAdjustSheetRef>(null);
  const local = useNutritionDiaryActions(
    date,
    daily.summary?.foodEntries ?? EMPTY
  );
  const remote = useNutritionCapturesByDate(date, isConnected);
  const pending = projectPhotoCompletions(
    local.photoCompletionActions,
    daily.summary?.foodEntries ?? EMPTY,
    types.mealTypes
  );
  const entries = [...(daily.summary?.foodEntries ?? EMPTY), ...pending];
  const photos = nutritionCapturePhotoRefs(
    remote.captures,
    local.photoActions,
    isConnected
  );
  const groups = diaryMealGroups(
    entries,
    types.mealTypes,
    date,
    getTodayDate(),
    preferences?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    states
  );
  const [protein, carbs, fat, accent] = useCSSVariable([
    '--color-macro-protein',
    '--color-macro-carbs',
    '--color-macro-fat',
    '--color-accent-primary',
  ]) as string[];
  const summary = daily.summary;
  const hasGoal =
    !!summary &&
    Number.isFinite(summary.calorieBalance.goal) &&
    summary.calorieBalance.goal > 0;
  const savePreset = (foods: FoodEntry[], name: string) => {
    const draft = diaryMealDraft(foods);
    const open = () =>
      navigation.navigate('MealAdd', {
        mode: 'create',
        initialDraft: { name, ingredients: draft.ingredients },
      });
    if (!draft.unresolved.length) {
      open();
      return;
    }
    Alert.alert(
      t('dailyMeals.reviewTemplate', {
        defaultValue: 'Review template ingredients',
      }),
      t('dailyMeals.unresolved', {
        defaultValue:
          '{{count}} ingredients need confirmed nutrition and a reusable food serving variant. Resolve them first, or explicitly continue with the other ingredients.',
        count: draft.unresolved.length,
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        ...(draft.ingredients.length
          ? [
              {
                text: t('dailyMeals.continueKnown', {
                  defaultValue: 'Use resolved ingredients',
                }),
                onPress: open,
              },
            ]
          : []),
      ]
    );
  };
  return (
    <>
      <DailyDetailScreen
        title={t('dailyMeals.title', { defaultValue: 'Meals' })}
        date={date}
        onDateChange={(day) => {
          edit.finishFoodEditing();
          setDate(day);
        }}
        scrollRef={drag.scrollRef}
        onLayout={drag.onLayout}
        onScroll={drag.onScroll}
        onRefresh={() =>
          Promise.all([daily.refetch(), status.refetch(), types.refetch()])
        }
      >
        {summary && (
          <View
            testID="daily-meals-summary"
            className="mb-4 rounded-2xl border border-border-subtle bg-surface p-4 gap-3"
          >
            <View className="flex-row flex-wrap gap-4">
              <Text className="text-xl font-bold text-text-primary">
                {formatLocalizedNumber(
                  Math.round(summary.calorieBalance.eaten)
                )}{' '}
                {t('dashboard.kcal', { defaultValue: 'kcal' })}
                <Text className="text-xs font-normal text-text-secondary">
                  {'\n'}
                  {t('dashboard.consumed', { defaultValue: 'Consumed' })}
                </Text>
              </Text>
              {hasGoal && (
                <Text className="text-xl font-bold text-text-primary">
                  {formatLocalizedNumber(
                    Math.abs(Math.round(summary.calorieBalance.remaining))
                  )}{' '}
                  {t('dashboard.kcal', { defaultValue: 'kcal' })}
                  <Text className="text-xs font-normal text-text-secondary">
                    {'\n'}
                    {summary.calorieBalance.remaining < 0
                      ? t('dashboard.overTarget', {
                          defaultValue: 'over target',
                        })
                      : t('dashboard.remaining', { defaultValue: 'remaining' })}
                  </Text>
                </Text>
              )}
              {hasGoal && (
                <Text className="text-xl font-bold text-text-primary">
                  {formatLocalizedNumber(
                    Math.round(
                      summary.calorieBalance.eaten +
                        summary.calorieBalance.remaining
                    )
                  )}{' '}
                  {t('dashboard.kcal', { defaultValue: 'kcal' })}
                  <Text className="text-xs font-normal text-text-secondary">
                    {'\n'}
                    {t('dailyMeals.allowance', {
                      defaultValue: 'Daily allowance',
                    })}
                  </Text>
                </Text>
              )}
            </View>
            {!hasGoal && (
              <Text className="text-sm text-text-secondary">
                {t('dashboard.noCalorieGoal', {
                  defaultValue: 'No daily calorie target set',
                })}
              </Text>
            )}
            <View
              className={
                expandedText
                  ? 'gap-4 border-t border-border-subtle pt-3'
                  : 'flex-row flex-wrap gap-4 border-t border-border-subtle pt-3'
              }
            >
              {(
                [
                  {
                    key: 'protein',
                    label: t('foodDetails.protein', {
                      defaultValue: 'Protein',
                    }),
                    color: protein,
                  },
                  {
                    key: 'carbs',
                    label: t('foodDetails.carbs', { defaultValue: 'Carbs' }),
                    color: carbs,
                  },
                  {
                    key: 'fat',
                    label: t('foodDetails.fat', { defaultValue: 'Fat' }),
                    color: fat,
                  },
                ] as const
              ).map((macro) => (
                <View
                  key={macro.key}
                  className={
                    expandedText ? 'w-full gap-1' : 'min-w-[25%] flex-1'
                  }
                >
                  <Text className="text-sm text-text-secondary">
                    {macro.label}
                  </Text>
                  <Text
                    className="text-lg font-bold"
                    style={{ color: macro.color }}
                  >
                    {formatLocalizedNumber(summary[macro.key].consumed, {
                      maximumFractionDigits: 1,
                    })}{' '}
                    g
                  </Text>
                </View>
              ))}
            </View>
            <Text className="text-xs text-text-secondary">
              {t('dailyMeals.knownNutrition', {
                defaultValue:
                  'Known nutrition only. Captured photos remain pending until nutrition is confirmed.',
              })}
            </Text>
          </View>
        )}
        <View className="mb-4 flex-row flex-wrap items-center gap-2">
          <Button
            className={expandedText ? 'w-full' : 'flex-1'}
            onPress={() => navigation.navigate('FoodSearch', { date })}
          >
            {t('dailyMeals.addFood', { defaultValue: 'Add food' })}
          </Button>
          <Button
            variant="secondary"
            accessibilityLabel={t('dashboard.mealPhoto', {
              defaultValue: 'Meal photo',
            })}
            onPress={() => navigation.navigate('FoodPhotoIntro', { date })}
          >
            <Icon name="camera" size={22} color={accent} />
          </Button>
          <Button
            variant="secondary"
            disabled={!isConnected || edit.bulkBusy}
            onPress={() =>
              edit.editingFoods
                ? edit.finishFoodEditing()
                : edit.setEditingFoods(true)
            }
          >
            {edit.editingFoods
              ? t('common.done', { defaultValue: 'Done' })
              : t('common.edit', { defaultValue: 'Edit' })}
          </Button>
        </View>
        {!summary && (
          <StatusView
            loading={daily.isLoading}
            title={
              daily.isError
                ? t('diary.loadFailed', {
                    defaultValue: 'Failed to load diary',
                  })
                : t('dailyMeals.noSummary', {
                    defaultValue: 'No saved summary for this day.',
                  })
            }
            action={{
              label: t('common.retry', { defaultValue: 'Retry' }),
              onPress: () => void daily.refetch(),
            }}
          />
        )}
        <PendingNutritionActions
          actions={local.actions}
          storageError={local.storageError}
        />
        <NutritionPhotoEntries
          local={local.photoActions}
          remote={remote.captures}
          completions={local.photoCompletionActions}
          completedFoodEntries={summary?.foodEntries ?? EMPTY}
          isConnected={isConnected}
        />
        {edit.editingFoods && (
          <View className="mb-3 flex-row flex-wrap gap-2">
            {(['move', 'copy'] as const).map((action) => (
              <Button
                key={action}
                variant="secondary"
                disabled={!edit.selectedFoodIds.size || edit.bulkBusy}
                onPress={() => edit.setBulkAction(action)}
              >
                {action === 'move'
                  ? t('diary.bulk.move', { defaultValue: 'Move' })
                  : t('diary.bulk.copy', { defaultValue: 'Copy' })}
              </Button>
            ))}
            <Button
              variant="secondary"
              disabled={!edit.selectedFoodIds.size || edit.bulkBusy}
              onPress={edit.confirmBulkDelete}
            >
              {t('common.delete', { defaultValue: 'Delete' })}
            </Button>
            {!!edit.selectedFoodIds.size && (
              <Button
                variant="secondary"
                onPress={() =>
                  savePreset(
                    entries.filter((entry) =>
                      edit.selectedFoodIds.has(entry.id)
                    ),
                    t('dailyMeals.newTemplate', {
                      defaultValue: 'Meal template',
                    })
                  )
                }
              >
                {t('dailyMeals.savePreset', {
                  defaultValue: 'Save as template',
                })}
              </Button>
            )}
          </View>
        )}
        <FoodSummary
          key={date}
          groups={groups}
          collapsible
          focusedMealTypeId={route.params?.mealTypeId}
          foodEntries={entries}
          capturePhotos={photos}
          mealTypes={types.mealTypes}
          goals={summary?.goals}
          calorieGoal={summary?.calorieGoal}
          onAddFood={(mealTypeId) =>
            navigation.navigate('FoodSearch', { date, mealTypeId })
          }
          onAdjustServing={(entry) => serving.current?.present(entry)}
          onPressMealType={(mealTypeId, mealType) =>
            navigation.navigate('MealTypeDetail', {
              date,
              mealTypeId: mealTypeId ?? undefined,
              mealType,
            })
          }
          onSavePreset={isConnected ? savePreset : undefined}
          selectionMode={edit.editingFoods}
          selectedEntryIds={edit.selectedFoodIds}
          onSelectEntry={edit.toggleFoodSelection}
          onDropFood={isConnected ? edit.moveDroppedFood : undefined}
          onDragPosition={drag.onDragPosition}
          mealStates={isConnected ? states : undefined}
          mealStatusBusy={saveStatus.isPending}
          onSetMealStatus={
            isConnected && date <= today()
              ? (meal_type_id, value) => {
                  if (date > today()) return;
                  saveStatus.mutate(
                    { entry_date: date, meal_type_id, status: value },
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
                }
              : undefined
          }
        />
      </DailyDetailScreen>
      <ServingAdjustSheet
        ref={serving}
        onViewEntry={(entry) => navigation.navigate('FoodEntryView', { entry })}
      />
      {edit.bulkAction && (
        <DiaryBulkActionSheet
          key={`${edit.bulkAction}:${date}`}
          action={edit.bulkAction}
          sourceDate={date}
          mealTypes={types.mealTypes.filter(
            (meal) => meal.purpose !== 'import'
          )}
          selectedCount={edit.selectedFoodIds.size}
          busy={edit.bulkBusy}
          onClose={() => edit.setBulkAction(null)}
          onApply={(action, targetDate, mealId) =>
            void edit.runBulkAction(action, targetDate, mealId)
          }
        />
      )}
    </>
  );
}
