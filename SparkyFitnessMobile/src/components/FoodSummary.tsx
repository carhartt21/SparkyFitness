import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';
import type { FoodEntry } from '../types/foodEntries';
import type { DailyGoals } from '../types/goals';
import type { MealType } from '../types/mealTypes';
import type { MealDayStatusValue, MealTrackingState } from '@workspace/shared';
import Icon from './Icon';
import MealStatusControl from './tracking/MealStatusControl';
import { glowSurfaceStyle, useGlowTheme } from './ui/glow';
import { MEAL_CONFIG } from '../constants/meals';
import SwipeableFoodRow from './SwipeableFoodRow';
import type { CapturePhotoRef } from './SwipeableFoodRow';
import {
  calculateEntryNutrition,
  calculateMealNutrition,
  getMealGroupLabel,
  groupFoodEntriesByMealType,
  getMealPercentage,
  type MealGroup,
} from '../utils/mealNutrition';

interface FoodSummaryProps {
  foodEntries: FoodEntry[];
  capturePhotos?: Record<string, CapturePhotoRef>;
  mealTypes: MealType[];
  goals?: DailyGoals;
  calorieGoal?: number;
  onAddFood?: (mealTypeId?: string) => void;
  onAdjustServing?: (entry: FoodEntry) => void;
  selectionMode?: boolean;
  selectedEntryIds?: ReadonlySet<string>;
  onSelectEntry?: (entry: FoodEntry) => void;
  onDropFood?: (entry: FoodEntry, mealTypeId: string) => void;
  onPressMealType?: (
    mealTypeId: string | null,
    mealTypeName: string,
    entries: FoodEntry[]
  ) => void;
  /** Explicit meal resolution by meal type id; omit to hide the control. */
  mealStates?: ReadonlyMap<string, MealTrackingState>;
  onSetMealStatus?: (
    mealTypeId: string,
    status: MealDayStatusValue | null
  ) => void;
}

interface MealSectionProps {
  group: MealGroup;
  capturePhotos?: Record<string, CapturePhotoRef>;
  goals?: DailyGoals;
  calorieGoal?: number;
  onAdjustServing?: (entry: FoodEntry) => void;
  selectionMode?: boolean;
  selectedEntryIds?: ReadonlySet<string>;
  onSelectEntry?: (entry: FoodEntry) => void;
  onDragStart?: () => void;
  onDragEnd?: (entry: FoodEntry, pageX: number, pageY: number) => void;
  registerDropTarget?: (mealTypeId: string, view: View | null) => void;
  draggingFood?: boolean;
  onAddFood?: (mealTypeId: string) => void;
  onPressMealType?: (
    mealTypeId: string | null,
    mealTypeName: string,
    entries: FoodEntry[]
  ) => void;
  mealState?: MealTrackingState;
  onSetMealStatus?: (status: MealDayStatusValue | null) => void;
}

const EmptyState: React.FC<{ onAddFood?: () => void }> = ({ onAddFood }) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onAddFood}
      accessibilityRole="button"
      accessibilityLabel={t('foodSummary.tapToAddFood', {
        defaultValue: 'Tap to add food',
      })}
      className="bg-surface rounded-2xl border border-border-subtle p-4 mb-2 items-center py-6"
    >
      <Text className="text-text-muted text-base">
        {t('foodSummary.tapToAddFood', { defaultValue: 'Tap to add food' })}
      </Text>
    </Pressable>
  );
};

const MealSection: React.FC<MealSectionProps> = ({
  group,
  capturePhotos,
  goals,
  calorieGoal,
  onAdjustServing,
  selectionMode,
  selectedEntryIds,
  onSelectEntry,
  onDragStart,
  onDragEnd,
  registerDropTarget,
  draggingFood,
  onAddFood,
  onPressMealType,
  mealState,
  onSetMealStatus,
}) => {
  const { t } = useTranslation();
  const glowing = useGlowTheme();
  const [accentPrimary, breakfastColor, lunchColor, dinnerColor, snackColor] =
    useCSSVariable([
      '--color-accent-primary',
      '--color-action-training',
      '--color-action-scan',
      '--color-hydration',
      '--color-exercise',
    ]) as string[];

  const label = getMealGroupLabel(group, t);
  // Single canonical MEAL_CONFIG lookup (read once, reuse both fields). A
  // custom category named "breakfast" still gets the neutral icon, never the
  // system one — ownership is decided by isSystem, not by the name.
  const systemConfig = group.isSystem
    ? MEAL_CONFIG[group.name.toLowerCase()]
    : undefined;
  const icon = systemConfig?.icon ?? 'meal-snack';
  // Accent per system meal, echoing the reference's sun/lunch/snack/moon cues.
  const iconColor =
    (group.isSystem &&
      {
        breakfast: breakfastColor,
        lunch: lunchColor,
        dinner: dinnerColor,
        snacks: snackColor,
      }[group.name.toLowerCase()]) ||
    accentPrimary;

  const totalCalories = calculateMealNutrition(group.entries).values.calories;
  const targetCalories = React.useMemo(() => {
    // Target-calorie percentages are only meaningful for SYSTEM meal types: a
    // custom type named "breakfast" (or a historical group) must never inherit
    // the system Breakfast target calories.
    if (!group.isSystem || !goals || !calorieGoal) return 0;
    const percentage = getMealPercentage(group.name, goals);
    return Math.round((calorieGoal * percentage) / 100);
  }, [group.isSystem, group.name, goals, calorieGoal]);

  const headerContent = (
    <>
      <Icon name={icon} size={20} color={iconColor} />
      <Text className="text-base font-bold text-text-primary flex-1">
        {label}
      </Text>
      {(totalCalories > 0 || targetCalories > 0) && (
        <Text className="text-sm text-text-primary font-semibold">
          {totalCalories}
          {targetCalories > 0 ? (
            <Text className="text-text-muted font-normal">
              {` / ${targetCalories}`}
            </Text>
          ) : null}{' '}
          {t('foodSummary.caloriesUnit', { defaultValue: 'Cal' })}
        </Text>
      )}
      {onPressMealType && (
        <Icon name="chevron-forward" size={14} color={accentPrimary} />
      )}
    </>
  );

  return (
    <View
      ref={(view) => {
        if (group.mealTypeId && onAddFood)
          registerDropTarget?.(group.mealTypeId, view);
      }}
      className={`bg-surface rounded-2xl p-4 overflow-hidden ${draggingFood && onAddFood ? 'border-2 border-dashed border-accent-primary' : 'border border-border-subtle'}`}
      style={
        draggingFood && onAddFood
          ? undefined
          : glowSurfaceStyle(iconColor, glowing, 'soft')
      }
    >
      {onPressMealType ? (
        <Pressable
          onPress={() =>
            onPressMealType(group.mealTypeId, group.name, group.entries)
          }
          className="flex-row gap-2 mb-3 items-center"
          accessibilityRole="button"
          accessibilityLabel={t('foodSummary.nutritionBreakdown', {
            defaultValue: '{{label}} nutrition breakdown',
            label,
          })}
        >
          {headerContent}
        </Pressable>
      ) : (
        <View className="flex-row gap-2 mb-3 items-center">
          {headerContent}
        </View>
      )}
      {group.entries.map((entry, index) => {
        const nutrition = calculateEntryNutrition(entry);
        return (
          <SwipeableFoodRow
            key={entry.id || index}
            entry={entry}
            capturePhoto={
              entry.nutrition_capture_id
                ? capturePhotos?.[entry.nutrition_capture_id]
                : undefined
            }
            nutrition={nutrition}
            onAdjustServing={onAdjustServing}
            selectionMode={selectionMode}
            selected={selectedEntryIds?.has(entry.id)}
            onSelect={
              !entry.food_entry_meal_id &&
              !entry.meal_plan_template_id &&
              !entry.nutrition_capture_id &&
              (!entry.source || entry.source === 'manual') &&
              !entry.isPendingNutrition
                ? onSelectEntry
                : undefined
            }
            onDragStart={onDragStart}
            onDragEnd={
              !entry.food_entry_meal_id &&
              !entry.meal_plan_template_id &&
              !entry.nutrition_capture_id &&
              (!entry.source || entry.source === 'manual') &&
              !entry.isPendingNutrition
                ? onDragEnd
                : undefined
            }
          />
        );
      })}
      {(onAddFood && group.mealTypeId) || (mealState && onSetMealStatus) ? (
        <View className="mt-3 flex-row gap-2">
          {onAddFood && group.mealTypeId ? (
            <Pressable
              onPress={() => onAddFood(group.mealTypeId!)}
              accessibilityRole="button"
              accessibilityLabel={t('foodSummary.addFoodToMeal', {
                defaultValue: 'Add food to {{meal}}',
                meal: label,
              })}
              className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border-subtle bg-raised active:opacity-70"
            >
              <Icon name="add" size={18} color={accentPrimary} />
              <Text className="text-sm font-semibold text-text-primary">
                {t('foodSummary.addFood', { defaultValue: 'Add food' })}
              </Text>
            </Pressable>
          ) : null}
          {mealState && onSetMealStatus ? (
            <MealStatusControl
              mealLabel={label}
              state={mealState}
              onChange={onSetMealStatus}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const FoodSummary: React.FC<FoodSummaryProps> = ({
  foodEntries,
  capturePhotos,
  mealStates,
  onSetMealStatus,
  mealTypes,
  goals,
  calorieGoal,
  onAddFood,
  onAdjustServing,
  selectionMode,
  selectedEntryIds,
  onSelectEntry,
  onDropFood,
  onPressMealType,
}) => {
  const { t } = useTranslation();
  const [draggingFood, setDraggingFood] = React.useState(false);
  const dropTargets = React.useRef(new Map<string, View>());
  const registerDropTarget = React.useCallback(
    (mealTypeId: string, view: View | null) => {
      if (view) dropTargets.current.set(mealTypeId, view);
      else dropTargets.current.delete(mealTypeId);
    },
    []
  );
  const handleDragEnd = React.useCallback(
    async (entry: FoodEntry, pageX: number, pageY: number) => {
      setDraggingFood(false);
      if (!onDropFood || !Number.isFinite(pageX) || !Number.isFinite(pageY))
        return;
      const bounds = await Promise.all(
        [...dropTargets.current.entries()].map(
          ([mealTypeId, view]) =>
            new Promise<{
              mealTypeId: string;
              x: number;
              y: number;
              width: number;
              height: number;
            } | null>((resolve) => {
              if (typeof view.measureInWindow !== 'function')
                return resolve(null);
              view.measureInWindow((x, y, width, height) =>
                resolve({ mealTypeId, x, y, width, height })
              );
            })
        )
      );
      const target = bounds.find(
        (item) =>
          item &&
          pageX >= item.x &&
          pageX <= item.x + item.width &&
          pageY >= item.y &&
          pageY <= item.y + item.height
      );
      if (target) onDropFood(entry, target.mealTypeId);
    },
    [onDropFood]
  );
  const entryGroups = groupFoodEntriesByMealType(foodEntries, mealTypes);
  // When logging is available, keep every visible category available even on
  // an empty day. Historical entries remain visible in their own groups.
  const groups = onAddFood
    ? [
        ...mealTypes.map(
          (type) =>
            entryGroups.find((group) => group.mealTypeId === type.id) ?? {
              mealTypeId: type.id,
              name: type.name,
              sortOrder: type.sort_order ?? 999,
              entries: [],
              isSystem: type.user_id === null,
              displayName: type.display_name,
            }
        ),
        ...entryGroups.filter(
          (group) => !mealTypes.some((type) => type.id === group.mealTypeId)
        ),
      ]
    : entryGroups;

  if (groups.length === 0) {
    return <EmptyState onAddFood={onAddFood} />;
  }

  return (
    <View className="gap-2 mb-2">
      {selectionMode && onDropFood && (
        <Text className="text-sm text-text-secondary px-1">
          {t('diary.bulk.dragHint', {
            defaultValue:
              'Drag a food to another meal, or select foods for more actions.',
          })}
        </Text>
      )}
      {groups.map((group) => (
        <MealSection
          key={
            group.mealTypeId
              ? `meal:${group.mealTypeId}`
              : `historical:${group.name.toLowerCase()}`
          }
          group={group}
          capturePhotos={capturePhotos}
          goals={goals}
          calorieGoal={calorieGoal}
          onAdjustServing={onAdjustServing}
          selectionMode={selectionMode}
          selectedEntryIds={selectedEntryIds}
          onSelectEntry={onSelectEntry}
          onDragStart={() => setDraggingFood(true)}
          onDragEnd={handleDragEnd}
          registerDropTarget={registerDropTarget}
          draggingFood={draggingFood}
          onAddFood={
            mealTypes.some((type) => type.id === group.mealTypeId)
              ? onAddFood
              : undefined
          }
          onPressMealType={onPressMealType}
          mealState={
            group.mealTypeId ? mealStates?.get(group.mealTypeId) : undefined
          }
          onSetMealStatus={
            group.mealTypeId && onSetMealStatus
              ? (status) => onSetMealStatus(group.mealTypeId!, status)
              : undefined
          }
        />
      ))}
    </View>
  );
};

export default FoodSummary;
