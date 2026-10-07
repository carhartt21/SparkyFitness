import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import Button from './ui/Button';
import { useNavigation } from '@react-navigation/native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { DeleteRowAction } from './SwipeableDeleteRow';
import { useRowCollapse } from '../hooks/useRowCollapse';
import { useDeleteFoodEntry } from '../hooks/useDeleteFoodEntry';
import { useDeleteFoodEntryMeal } from '../hooks/useDeleteFoodEntryMeal';
import { usePreferences } from '../hooks/usePreferences';
import type { FoodEntry } from '../types/foodEntries';
import type { EntryNutrition } from '../utils/mealNutrition';
import {
  formatDateToTimeLabel,
  formatTimeLabel,
} from '../utils/entryTimeDisplay';
import FoodThumbnail from './FoodThumbnail';
import { useFoodImageSourceContext } from './FoodImageSourceProvider';
import { diaryEntryImage, diaryEntryImages } from '../utils/foodImages';
import { useOpenLightbox } from './LightboxProvider';
import NutritionCaptureThumbnail, {
  type CapturePhotoRef,
} from './NutritionCaptureThumbnail';
import Icon from './Icon';
import { useCSSVariable } from 'uniwind';

export type { CapturePhotoRef } from './NutritionCaptureThumbnail';

interface SwipeableFoodRowProps {
  readOnly?: boolean;
  showTime?: boolean;
  compact?: boolean;
  entry: FoodEntry;
  nutrition: EntryNutrition;
  capturePhoto?: CapturePhotoRef;
  onAdjustServing?: (entry: FoodEntry) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onSelect?: (entry: FoodEntry) => void;
  onDragStart?: () => void;
  onDragEnd?: (entry: FoodEntry, pageX: number, pageY: number) => void;
  onDragMove?: (pageX: number, pageY: number) => void;
}

const SwipeableFoodRow: React.FC<SwipeableFoodRowProps> = ({
  entry,
  readOnly: requestedReadOnly = false,
  showTime = true,
  compact = false,
  nutrition,
  capturePhoto,
  onAdjustServing,
  selectionMode = false,
  selected = false,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragMove,
}) => {
  const readOnly = requestedReadOnly || entry.source === 'fddb';
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  const navigation = useNavigation();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const invalidateCacheRef = useRef<() => void>(() => {});
  const { collapse, handleLayout, animatedStyle } = useRowCollapse(() =>
    invalidateCacheRef.current()
  );

  const isMealComponent = !!entry.food_entry_meal_id;
  const isPending = entry.isPendingNutrition === true;
  const getImageSource = useFoodImageSourceContext();
  const entryImage = diaryEntryImage(entry);
  const openLightbox = useOpenLightbox();
  const mutedColor = useCSSVariable('--color-text-muted') as string;
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
    zIndex: dragging.value ? 10 : 0,
    opacity: dragging.value ? 0.85 : 1,
  }));
  const dragGesture = Gesture.Pan()
    .minDistance(3)
    .runOnJS(true)
    .onStart(() => {
      dragging.value = true;
      onDragStart?.();
    })
    .onUpdate((event) => {
      dragX.value = event.translationX;
      dragY.value = event.translationY;
      onDragMove?.(event.absoluteX, event.absoluteY);
    })
    .onEnd((event, success) =>
      onDragEnd?.(
        entry,
        success ? event.absoluteX : Number.NaN,
        success ? event.absoluteY : Number.NaN
      )
    )
    .onFinalize((_, success) => {
      if (!success) onDragEnd?.(entry, Number.NaN, Number.NaN);
      dragX.value = 0;
      dragY.value = 0;
      dragging.value = false;
    });

  const onDeleteSuccess = () => {
    swipeableRef.current?.close();
    collapse();
  };

  const foodEntryDelete = useDeleteFoodEntry({
    entryId: entry.id,
    entryDate: entry.entry_date,
    nutritionCaptureId: entry.nutrition_capture_id,
    onSuccess: onDeleteSuccess,
  });

  const mealDelete = useDeleteFoodEntryMeal({
    mealId: entry.food_entry_meal_id ?? '',
    entryDate: entry.entry_date,
    onSuccess: onDeleteSuccess,
  });

  const confirmAndDelete = isMealComponent
    ? mealDelete.confirmAndDelete
    : foodEntryDelete.confirmAndDelete;
  const deleteEntry = isMealComponent
    ? mealDelete.deleteEntry
    : foodEntryDelete.deleteEntry;

  // Keep the latest invalidateCache in a ref so the post-collapse callback
  // (run via runOnJS after the delete) always invokes the current one. Written
  // in an effect rather than during render so the value stays mutable to
  // React's compiler.
  useEffect(() => {
    invalidateCacheRef.current = isMealComponent
      ? mealDelete.invalidateCache
      : foodEntryDelete.invalidateCache;
  }, [
    isMealComponent,
    mealDelete.invalidateCache,
    foodEntryDelete.invalidateCache,
  ]);

  const renderRightActions = () => (
    <DeleteRowAction
      onPress={confirmAndDelete}
      className="ml-4"
      accessibilityLabel={t('foodRow.deleteFood', {
        defaultValue: 'Delete food',
      })}
    />
  );

  const canQuickAdjust =
    !readOnly &&
    !isPending &&
    !isMealComponent &&
    !!onAdjustServing &&
    Number(entry.serving_size) > 0;
  const name =
    entry.food_name ||
    t('foodRow.unknownFood', { defaultValue: 'Unknown food' });
  const sourceLabel =
    entry.source && entry.source !== 'manual'
      ? entry.source
          .replace(/[_-]/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase())
      : null;
  const timeLabel = capturePhoto?.consumedAt
    ? formatDateToTimeLabel(
        new Date(capturePhoto.consumedAt),
        preferences?.time_format
      )
    : formatTimeLabel(entry.entry_time, preferences?.time_format);

  const handlePress = () => {
    if (readOnly) return;
    if (selectionMode) {
      onSelect?.(entry);
      return;
    }
    if (isPending) return;
    if (isMealComponent && entry.food_entry_meal_id) {
      navigation.navigate('EditLoggedMeal', {
        foodEntryMealId: entry.food_entry_meal_id,
      });
      return;
    }
    navigation.navigate('FoodEntryView', { entry });
  };

  const handleLongPress = () => {
    if (readOnly) return;
    if (onSelect) {
      onSelect(entry);
      return;
    }
    if (isPending) return;
    const buttons: {
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }[] = [];
    if (canQuickAdjust) {
      buttons.push({
        text: t('foodRow.adjustServing', { defaultValue: 'Adjust serving' }),
        onPress: () => onAdjustServing!(entry),
      });
    }
    buttons.push({
      text: t('common.delete', { defaultValue: 'Delete' }),
      style: 'destructive',
      onPress: deleteEntry,
    });
    buttons.push({
      text: t('common.cancel', { defaultValue: 'Cancel' }),
      style: 'cancel',
    });
    Alert.alert(name, undefined, buttons);
  };

  return (
    <Animated.View style={[animatedStyle, dragStyle]} onLayout={handleLayout}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        renderRightActions={
          readOnly || isPending || selectionMode
            ? undefined
            : renderRightActions
        }
        enabled={!readOnly && !isPending && !selectionMode}
        overshootRight={false}
        rightThreshold={40}
      >
        {/* Transparent so the meal card's tinted surface continues behind
            each row; the delete action sits off-row until swiped, so it
            never shows through. */}
        <View
          testID="food-row-surface"
          className="min-h-11 py-2.5 flex-row items-center bg-transparent"
        >
          {!readOnly && selectionMode && onSelect && (
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={t('foodRow.selectFood', {
                defaultValue: 'Select {{name}}',
                name,
              })}
              onPress={() => onSelect?.(entry)}
              className="min-h-11 min-w-11 items-center justify-center"
            >
              <Text className="text-accent-primary text-xl">
                {selected ? '●' : '○'}
              </Text>
            </TouchableOpacity>
          )}
          {capturePhoto ? (
            <NutritionCaptureThumbnail photo={capturePhoto} />
          ) : (
            <FoodThumbnail
              image={entryImage}
              name={name}
              getImageSource={getImageSource}
              size={compact ? 40 : 48}
              style={{ marginRight: 12 }}
              onPress={
                entryImage
                  ? () => openLightbox(diaryEntryImages(entry), 0, name)
                  : undefined
              }
            />
          )}
          <View
            className="min-w-0 flex-1"
            style={{
              flexDirection: stacked ? 'column' : 'row',
              alignItems: stacked ? 'stretch' : 'center',
            }}
          >
            <TouchableOpacity
              className="min-w-0 min-h-11 justify-center mr-2"
              style={stacked ? undefined : { flex: 1 }}
              activeOpacity={0.7}
              onPress={handlePress}
              onLongPress={handleLongPress}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${entry.quantity} ${entry.unit}`}
              accessibilityState={
                !readOnly && selectionMode && onSelect
                  ? { selected }
                  : undefined
              }
            >
              <View className="gap-0.5">
                <Text
                  className={
                    compact
                      ? 'text-sm font-medium text-text-primary'
                      : 'text-md text-text-primary'
                  }
                  numberOfLines={stacked ? undefined : 2}
                >
                  {name}
                </Text>
                <Text
                  className={
                    compact
                      ? 'text-xs text-text-secondary'
                      : 'text-sm text-text-secondary'
                  }
                  numberOfLines={stacked ? undefined : 1}
                >
                  {entry.quantity} {entry.unit}
                  {compact && !isPending
                    ? ` · ${Math.round(nutrition.calories)} ${t('foodRow.caloriesUnit', { defaultValue: 'Cal' })}`
                    : ''}
                </Text>
                {showTime && timeLabel && (
                  <Text
                    className="text-xs text-text-secondary"
                    numberOfLines={1}
                  >
                    {timeLabel}
                  </Text>
                )}
              </View>
              {sourceLabel && (
                <Text className="text-xs text-text-secondary" numberOfLines={1}>
                  {sourceLabel}
                </Text>
              )}
              {isPending && (
                <Text className="text-xs text-text-muted">
                  {t('nutritionOutbox.savedOnDevice', {
                    defaultValue: 'Saved on this device',
                  })}
                </Text>
              )}
            </TouchableOpacity>
            {canQuickAdjust && !selectionMode ? (
              <Button
                variant="ghost"
                accessibilityLabel={
                  t('foodRow.adjustServing', {
                    defaultValue: 'Adjust serving',
                  }) + `: ${name}`
                }
                onPress={() => onAdjustServing!(entry)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                className="min-h-11 justify-center px-2"
                textClassName="text-sm text-text-secondary font-medium"
                style={stacked ? { alignSelf: 'flex-start' } : undefined}
              >
                {compact ? (
                  <Icon
                    name="ellipsis-horizontal"
                    size={20}
                    color={mutedColor}
                  />
                ) : (
                  `${Math.round(nutrition.calories)} ${t('foodRow.caloriesUnit', { defaultValue: 'Cal' })} ▾`
                )}
              </Button>
            ) : compact ? null : (
              <Text className="text-sm text-text-secondary font-medium mr-2">
                {Math.round(nutrition.calories)}{' '}
                {t('foodRow.caloriesUnit', { defaultValue: 'Cal' })}
              </Text>
            )}
          </View>
          {!readOnly && selectionMode && onDragEnd && onSelect && (
            <GestureDetector gesture={dragGesture}>
              <View
                testID={`food-drag-${entry.id}`}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('foodRow.dragFood', {
                  defaultValue: 'Drag {{name}} to another meal',
                  name,
                })}
                className="min-h-11 min-w-11 items-center justify-center"
              >
                <Icon name="reorder-handle" size={20} color={mutedColor} />
              </View>
            </GestureDetector>
          )}
        </View>
      </ReanimatedSwipeable>
    </Animated.View>
  );
};

export default SwipeableFoodRow;
