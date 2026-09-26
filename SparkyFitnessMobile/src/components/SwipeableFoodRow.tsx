import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import Button from './ui/Button';
import { useNavigation } from '@react-navigation/native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated from 'react-native-reanimated';
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
  entry: FoodEntry;
  nutrition: EntryNutrition;
  capturePhoto?: CapturePhotoRef;
  onAdjustServing?: (entry: FoodEntry) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onSelect?: (entry: FoodEntry) => void;
  onDragStart?: () => void;
  onDragEnd?: (entry: FoodEntry, pageX: number, pageY: number) => void;
}

const SwipeableFoodRow: React.FC<SwipeableFoodRowProps> = ({
  entry,
  nutrition,
  capturePhoto,
  onAdjustServing,
  selectionMode = false,
  selected = false,
  onSelect,
  onDragStart,
  onDragEnd,
}) => {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const navigation = useNavigation();
  const swipeableRef = useRef<any>(null);
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
  const dragResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => onDragStart?.(),
        onPanResponderRelease: (event) =>
          onDragEnd?.(entry, event.nativeEvent.pageX, event.nativeEvent.pageY),
        onPanResponderTerminate: () =>
          onDragEnd?.(entry, Number.NaN, Number.NaN),
      }),
    [entry, onDragEnd, onDragStart]
  );

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
    <Animated.View style={animatedStyle} onLayout={handleLayout}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        renderRightActions={
          isPending || selectionMode ? undefined : renderRightActions
        }
        enabled={!isPending && !selectionMode}
        overshootRight={false}
        rightThreshold={40}
      >
        <View className="min-h-11 py-2.5 flex-row items-center bg-surface">
          {selectionMode && onSelect && (
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
              getImageSource={getImageSource}
              size={48}
              style={{ marginRight: 12 }}
              onPress={
                entryImage
                  ? () => openLightbox(diaryEntryImages(entry), 0, name)
                  : undefined
              }
            />
          )}
          <TouchableOpacity
            className="flex-1 min-h-11 justify-center mr-2"
            activeOpacity={0.7}
            onPress={handlePress}
            onLongPress={handleLongPress}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${entry.quantity} ${entry.unit}`}
            accessibilityState={
              selectionMode && onSelect ? { selected } : undefined
            }
          >
            <View className="gap-0.5">
              <Text className="text-md text-text-primary" numberOfLines={2}>
                {name}
              </Text>
              <Text className="text-sm text-text-secondary" numberOfLines={1}>
                {entry.quantity} {entry.unit}
              </Text>
              {timeLabel && (
                <Text className="text-xs text-text-secondary" numberOfLines={1}>
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
              onPress={() => onAdjustServing!(entry)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              className="min-h-11 justify-center px-2"
              textClassName="text-sm text-text-secondary font-medium"
            >
              {`${Math.round(nutrition.calories)} ${t('foodRow.caloriesUnit', { defaultValue: 'Cal' })} ▾`}
            </Button>
          ) : (
            <Text className="text-sm text-text-secondary font-medium mr-2">
              {Math.round(nutrition.calories)}{' '}
              {t('foodRow.caloriesUnit', { defaultValue: 'Cal' })}
            </Text>
          )}
          {selectionMode && onDragEnd && onSelect && (
            <View
              {...dragResponder.panHandlers}
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
          )}
        </View>
      </ReanimatedSwipeable>
    </Animated.View>
  );
};

export default SwipeableFoodRow;
