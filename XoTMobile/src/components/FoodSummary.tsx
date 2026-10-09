import { isFddbImportMeal, shouldShowDiaryMeal } from '@workspace/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useCSSVariable } from 'uniwind';
import type { FoodEntry } from '../types/foodEntries';
import type { DailyGoals } from '../types/goals';
import type { MealType } from '../types/mealTypes';
import type { MealDayStatusValue, MealTrackingState } from '@workspace/shared';
import Icon from './Icon';
import Button from './ui/Button';
import { formatLocalizedNumber } from '../localization';
import { formatTimeLabel } from '../utils/entryTimeDisplay';
import MealStatusControl from './tracking/MealStatusControl';
import { glowSurfaceStyle, useGlowTheme } from './ui/glow';
import { MEAL_CONFIG } from '../constants/meals';
import SwipeableFoodRow from './SwipeableFoodRow';
import type { CapturePhotoRef } from './SwipeableFoodRow';
import FoodThumbnail from './FoodThumbnail';
import NutritionCaptureThumbnail from './NutritionCaptureThumbnail';
import { useFoodImageSourceContext } from './FoodImageSourceProvider';
import { diaryEntryImage } from '../utils/foodImages';
import {
  calculateEntryNutrition,
  calculateMealNutrition,
  getMealGroupLabel,
  groupFoodEntriesByMealType,
  getMealPercentage,
  type MealGroup,
} from '../utils/mealNutrition';

interface FoodSummaryProps {
  groups?: MealGroup[];
  collapsible?: boolean;
  focusedMealTypeId?: string;
  onSavePreset?: (entries: FoodEntry[], label: string) => void;
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
  onDragPosition?: (pageY: number | null) => void;
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
  mealStatusBusy?: boolean;
}

interface MealSectionProps {
  collapsible?: boolean;
  initiallyExpanded?: boolean;
  onSavePreset?: (entries: FoodEntry[], label: string) => void;
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
  onDragMove?: (pageX: number, pageY: number) => void;
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
  mealStatusBusy?: boolean;
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
  collapsible,
  initiallyExpanded,
  onSavePreset,
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
  onDragMove,
  registerDropTarget,
  draggingFood,
  onAddFood,
  onPressMealType,
  mealState,
  onSetMealStatus,
  mealStatusBusy,
}) => {
  const { t } = useTranslation();
  const [expandedByUser, setExpanded] = React.useState(
    initiallyExpanded ?? false
  );
  const expanded = !collapsible || selectionMode || expandedByUser;
  const getImageSource = useFoodImageSourceContext();
  const previewEntries = group.entries.filter(
    (entry, index, entries) =>
      entries.findIndex(
        (other) =>
          (other.food_entry_meal_id ??
            other.nutrition_capture_id ??
            other.id) ===
          (entry.food_entry_meal_id ?? entry.nutrition_capture_id ?? entry.id)
      ) === index
  );
  const glowing = useGlowTheme();
  const expandedText = useWindowDimensions().fontScale > 1.3;
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
  const icon = group.iconKey ?? systemConfig?.icon ?? 'meal-snack';
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
  const clock = formatTimeLabel(group.entries[0]?.entry_time) ?? group.clock;
  const pendingNutrition = group.entries.some(
    (entry) => entry.isPendingNutrition
  );
  const groupSummary = group.entries.length
    ? t('dailyMeals.groupSummary', {
        defaultValue: '{{calories}} kcal · {{count}} foods',
        calories: formatLocalizedNumber(Math.round(totalCalories)),
        count: group.entries.length,
      })
    : t('dailyMeals.noEntries', { defaultValue: 'Nothing recorded yet' });
  const targetCalories = React.useMemo(() => {
    // Target-calorie percentages are only meaningful for SYSTEM meal types: a
    // custom type named "breakfast" (or a historical group) must never inherit
    // the system Breakfast target calories.
    if (!group.isSystem || !goals || !calorieGoal) return 0;
    const percentage = getMealPercentage(group.name, goals);
    return Math.round((calorieGoal * percentage) / 100);
  }, [group.isSystem, group.name, goals, calorieGoal]);

  const neutral = useCSSVariable('--color-card-glow') as string;
  const calorieLabel =
    totalCalories > 0 || targetCalories > 0 ? (
      <Text className="text-sm text-text-primary font-semibold">
        {totalCalories}
        {targetCalories > 0 ? (
          <Text className="text-text-muted font-normal">{` / ${targetCalories}`}</Text>
        ) : null}{' '}
        {t('foodSummary.caloriesUnit', { defaultValue: 'Cal' })}
      </Text>
    ) : null;
  const headerContent = (
    <>
      <Icon name={icon} size={20} color={iconColor} />
      {collapsible ? (
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-base font-bold text-text-primary">{label}</Text>
          <Text className="text-xs text-text-secondary">
            {clock ? `${clock} · ` : ''}
            {pendingNutrition
              ? t('dailyMeals.pendingNutrition', {
                  defaultValue: 'Nutrition pending',
                })
              : groupSummary}
          </Text>
        </View>
      ) : expandedText ? (
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-base font-bold text-text-primary">{label}</Text>
          {calorieLabel}
        </View>
      ) : (
        <>
          <Text className="text-base font-bold text-text-primary flex-1">
            {label}
          </Text>
          {calorieLabel}
        </>
      )}
      {(onPressMealType || collapsible) && (
        <Icon
          name={
            collapsible
              ? expanded
                ? 'chevron-up'
                : 'chevron-down'
              : 'chevron-forward'
          }
          size={14}
          color={accentPrimary}
        />
      )}
    </>
  );

  return (
    <View
      testID={`food-drop-meal:${group.mealTypeId ?? group.name}`}
      collapsable={false}
      ref={(view) => {
        if (group.mealTypeId && onAddFood)
          registerDropTarget?.(group.mealTypeId, view);
      }}
      className={`bg-surface rounded-2xl ${collapsible ? 'px-3 py-2' : 'p-4'} ${selectionMode ? 'overflow-visible' : 'overflow-hidden'} ${draggingFood && onAddFood ? 'border-2 border-dashed border-accent-primary' : 'border border-border-subtle'}`}
      style={
        draggingFood && onAddFood
          ? undefined
          : glowSurfaceStyle(neutral, glowing, 'soft')
      }
    >
      <View className="flex-row items-center gap-2">
        {onPressMealType || collapsible ? (
          <Pressable
            onPress={() =>
              collapsible
                ? setExpanded(!expandedByUser)
                : onPressMealType?.(group.mealTypeId, group.name, group.entries)
            }
            className={`${collapsible ? 'min-h-14' : 'min-h-11'} min-w-0 flex-1 flex-row gap-2 items-center`}
            accessibilityRole="button"
            testID={`daily-meal-group-${group.mealTypeId ?? group.name}`}
            accessibilityState={collapsible ? { expanded } : undefined}
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
        {collapsible && mealState && onSetMealStatus ? (
          <MealStatusControl
            mealLabel={label}
            state={mealState}
            onChange={onSetMealStatus}
            busy={mealStatusBusy}
          />
        ) : null}
      </View>
      {collapsible && !expanded && previewEntries.length > 0 && (
        <Pressable
          testID={`meal-previews-${group.mealTypeId ?? group.name}`}
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={t('foodSummary.previewItems', {
            defaultValue: 'Show logged items in {{meal}}',
            meal: label,
          })}
          className="min-h-11 flex-row items-center gap-2 pb-1"
        >
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="flex-row items-center gap-2"
          >
            {previewEntries.slice(0, 3).map((entry) => {
              const photo = entry.nutrition_capture_id
                ? capturePhotos?.[entry.nutrition_capture_id]
                : undefined;
              return photo ? (
                <NutritionCaptureThumbnail
                  key={entry.id}
                  photo={photo}
                  size={32}
                />
              ) : (
                <FoodThumbnail
                  key={entry.id}
                  image={diaryEntryImage(entry)}
                  name={entry.food_name ?? ''}
                  getImageSource={getImageSource}
                  size={32}
                  variant={entry.food_entry_meal_id ? 'meal' : 'food'}
                />
              );
            })}
          </View>
          {previewEntries.length > 3 && (
            <Text className="text-sm text-text-secondary">
              +{formatLocalizedNumber(previewEntries.length - 3)}
            </Text>
          )}
        </Pressable>
      )}
      {expanded && (
        <>
          {group.entries.map((entry, index) => {
            const nutrition = calculateEntryNutrition(entry);
            return (
              <View
                key={entry.id || index}
                className={
                  collapsible ? 'border-t border-border-subtle' : undefined
                }
              >
                <SwipeableFoodRow
                  compact={collapsible}
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
                  onDragMove={onDragMove}
                  onDragEnd={
                    (!entry.food_entry_meal_id ||
                      entry.id === entry.food_entry_meal_id) &&
                    !entry.meal_plan_template_id &&
                    !entry.nutrition_capture_id &&
                    (!entry.source || entry.source === 'manual') &&
                    !entry.isPendingNutrition
                      ? onDragEnd
                      : undefined
                  }
                />
              </View>
            );
          })}
          {collapsible && (onAddFood || onPressMealType || onSavePreset) ? (
            <View
              className={`border-t border-border-subtle gap-2 pt-1 ${expandedText ? 'flex-col' : 'flex-row items-center'}`}
            >
              <View className="flex-row gap-2">
                {onAddFood && group.mealTypeId ? (
                  <Button
                    variant="secondary"
                    className="h-11 w-11 p-0"
                    onPress={() => onAddFood(group.mealTypeId!)}
                    accessibilityLabel={t('foodSummary.addFoodToMeal', {
                      defaultValue: 'Add food to {{meal}}',
                      meal: label,
                    })}
                  >
                    <Icon name="add" size={20} color={accentPrimary} />
                  </Button>
                ) : null}
                {onPressMealType ? (
                  <Button
                    variant="secondary"
                    className="h-11 w-11 p-0"
                    accessibilityLabel={t('dailyMeals.details', {
                      defaultValue: 'Meal details',
                    })}
                    onPress={() =>
                      onPressMealType(
                        group.mealTypeId,
                        group.name,
                        group.entries
                      )
                    }
                  >
                    <Icon
                      name="document-text"
                      size={20}
                      color={accentPrimary}
                    />
                  </Button>
                ) : null}
              </View>
              {onSavePreset && group.entries.length > 0 && (
                <Button
                  variant="ghost"
                  tone="neutral"
                  icon="bookmark"
                  className={`${expandedText ? 'w-full' : 'min-w-0 flex-1'} px-1 py-2`}
                  textClassName="text-sm"
                  onPress={() => onSavePreset(group.entries, label)}
                >
                  {t('dailyMeals.savePreset', {
                    defaultValue: 'Save as template',
                  })}
                </Button>
              )}
            </View>
          ) : null}
          {!collapsible &&
          ((onAddFood && group.mealTypeId) ||
            (mealState && onSetMealStatus)) ? (
            <View className="mt-3 flex-row items-center gap-2">
              {onAddFood && group.mealTypeId ? (
                <Button
                  variant="secondary"
                  icon="add"
                  onPress={() => onAddFood(group.mealTypeId!)}
                  accessibilityLabel={t('foodSummary.addFoodToMeal', {
                    defaultValue: 'Add food to {{meal}}',
                    meal: label,
                  })}
                  className="min-w-0 flex-1 py-2"
                  textClassName="text-sm"
                >
                  {t('foodSummary.addFood', { defaultValue: 'Add food' })}
                </Button>
              ) : null}
              {mealState && onSetMealStatus ? (
                <MealStatusControl
                  mealLabel={label}
                  state={mealState}
                  onChange={onSetMealStatus}
                  busy={mealStatusBusy}
                />
              ) : null}
            </View>
          ) : null}
          {!collapsible && onSavePreset && group.entries.length > 0 && (
            <Pressable
              onPress={() => onSavePreset(group.entries, label)}
              accessibilityRole="button"
              className="min-h-11 flex-row items-center gap-2 border-t border-border-subtle"
            >
              <Icon name="bookmark" size={18} color={accentPrimary} />
              <Text className="flex-1 text-sm font-semibold text-text-primary">
                {t('dailyMeals.savePreset', {
                  defaultValue: 'Save as template',
                })}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
};

const FoodSummary: React.FC<FoodSummaryProps> = ({
  groups: providedGroups,
  collapsible,
  focusedMealTypeId,
  onSavePreset,
  foodEntries,
  capturePhotos,
  mealStates,
  onSetMealStatus,
  mealStatusBusy,
  mealTypes,
  goals,
  calorieGoal,
  onAddFood,
  onAdjustServing,
  selectionMode,
  selectedEntryIds,
  onSelectEntry,
  onDropFood,
  onDragPosition,
  onPressMealType,
}) => {
  const { t } = useTranslation();
  const [draggingFood, setDraggingFood] = React.useState(false);
  const [activeDropTarget, setActiveDropTarget] = React.useState<string | null>(
    null
  );
  const hoverGeneration = React.useRef(0);
  const lastHoverCheck = React.useRef(0);
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
      setActiveDropTarget(null);
      hoverGeneration.current += 1;
      onDragPosition?.(null);
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
    [onDropFood, onDragPosition]
  );
  const handleDragMove = React.useCallback(
    (x: number, y: number) => {
      onDragPosition?.(y);
      if (Date.now() - lastHoverCheck.current < 80) return;
      lastHoverCheck.current = Date.now();
      const generation = ++hoverGeneration.current;
      for (const [id, view] of dropTargets.current) {
        view.measureInWindow?.((left, top, width, height) => {
          if (generation !== hoverGeneration.current) return;
          const inside =
            x >= left && x <= left + width && y >= top && y <= top + height;
          setActiveDropTarget((current) =>
            inside ? id : current === id ? null : current
          );
        });
      }
    },
    [onDragPosition]
  );
  const entryGroups = groupFoodEntriesByMealType(foodEntries, mealTypes);
  // When logging is available, keep every visible category available even on
  // an empty day. Historical entries remain visible in their own groups.
  const groups =
    providedGroups ??
    (onAddFood
      ? [
          ...mealTypes
            .filter(
              (type) =>
                type.purpose !== 'import' ||
                entryGroups.some(
                  (group) =>
                    group.mealTypeId === type.id && group.entries.length > 0
                )
            )
            .map(
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
      : entryGroups);

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
      {groups
        .filter((group) =>
          shouldShowDiaryMeal(group.name, group.entries.length)
        )
        .map((group) => (
          <MealSection
            key={
              group.mealTypeId
                ? `meal:${group.mealTypeId}`
                : `historical:${group.name.toLowerCase()}`
            }
            collapsible={collapsible}
            initiallyExpanded={focusedMealTypeId === group.mealTypeId}
            onSavePreset={
              isFddbImportMeal(group.name) ? undefined : onSavePreset
            }
            group={group}
            capturePhotos={capturePhotos}
            goals={goals}
            calorieGoal={calorieGoal}
            onAdjustServing={
              isFddbImportMeal(group.name) ? undefined : onAdjustServing
            }
            selectionMode={selectionMode && !isFddbImportMeal(group.name)}
            selectedEntryIds={selectedEntryIds}
            onSelectEntry={
              isFddbImportMeal(group.name) ? undefined : onSelectEntry
            }
            onDragStart={() => {
              setDraggingFood(true);
              setActiveDropTarget(null);
            }}
            onDragMove={handleDragMove}
            onDragEnd={isFddbImportMeal(group.name) ? undefined : handleDragEnd}
            registerDropTarget={registerDropTarget}
            draggingFood={draggingFood && activeDropTarget === group.mealTypeId}
            onAddFood={
              !isFddbImportMeal(group.name) &&
              mealTypes.some((type) => type.id === group.mealTypeId)
                ? onAddFood
                : undefined
            }
            onPressMealType={
              isFddbImportMeal(group.name) ? undefined : onPressMealType
            }
            mealState={
              group.mealTypeId ? mealStates?.get(group.mealTypeId) : undefined
            }
            onSetMealStatus={
              !isFddbImportMeal(group.name) &&
              group.mealTypeId &&
              onSetMealStatus
                ? (status) => onSetMealStatus(group.mealTypeId!, status)
                : undefined
            }
            mealStatusBusy={mealStatusBusy}
          />
        ))}
    </View>
  );
};

export default FoodSummary;
