import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { applyBulkFoodEntryAction } from '../services/api/foodEntriesApi';
import { invalidateFoodCache } from './invalidateFoodCache';
import type { FoodEntry } from '../types/foodEntries';

/** Shared selection and mutation behavior for the diary and daily Meals. */
export function useDiaryFoodEditing(date: string) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const inFlight = useRef(false);
  const currentDate = useRef(date);
  currentDate.current = date;
  const [editingFoods, setEditingFoods] = useState(false);
  const [selectedFoodIds, setSelectedFoodIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [bulkAction, setBulkAction] = useState<'move' | 'copy' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editingDate, setEditingDate] = useState(date);
  if (editingDate !== date) {
    setEditingDate(date);
    setEditingFoods(false);
    setSelectedFoodIds(new Set());
    setBulkAction(null);
  }
  const finishFoodEditing = () => {
    setEditingFoods(false);
    setSelectedFoodIds(new Set());
    setBulkAction(null);
  };
  const toggleFoodSelection = (entry: FoodEntry) => {
    setEditingFoods(true);
    setSelectedFoodIds((previous) => {
      const next = new Set(previous);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  };
  const execute = async (
    ids: string[],
    action: 'move' | 'copy' | 'delete',
    targetDate?: string,
    targetMealTypeId?: string
  ) => {
    if (!ids.length || inFlight.current) return;
    inFlight.current = true;
    setBulkBusy(true);
    try {
      await applyBulkFoodEntryAction({
        ids,
        action,
        sourceDate: date,
        targetDate,
        targetMealTypeId,
      });
      invalidateFoodCache(client, date);
      if (targetDate && targetDate !== date)
        invalidateFoodCache(client, targetDate);
      if (currentDate.current === date) finishFoodEditing();
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
      inFlight.current = false;
      setBulkBusy(false);
    }
  };
  const runBulkAction = async (
    action: 'move' | 'copy' | 'delete',
    targetDate?: string,
    targetMealTypeId?: string
  ) => {
    await execute([...selectedFoodIds], action, targetDate, targetMealTypeId);
  };
  const moveDroppedFood = (entry: FoodEntry, targetMealTypeId: string) => {
    const ids = selectedFoodIds.has(entry.id)
      ? [...selectedFoodIds]
      : [entry.id];
    if (ids.length === 1 && entry.meal_type_id === targetMealTypeId) return;
    void execute(ids, 'move', date, targetMealTypeId);
  };
  const confirmBulkDelete = () => {
    if (!selectedFoodIds.size) return;
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
  };
  return {
    editingFoods,
    setEditingFoods,
    selectedFoodIds,
    toggleFoodSelection,
    bulkAction,
    setBulkAction,
    bulkBusy,
    finishFoodEditing,
    runBulkAction,
    moveDroppedFood,
    confirmBulkDelete,
  };
}
