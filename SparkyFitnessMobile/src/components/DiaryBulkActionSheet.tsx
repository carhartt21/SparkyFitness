import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MealType } from '../types/mealTypes';
import { getMealTypeDisplayLabel } from '../utils/mealNutrition';

type BulkAction = 'move' | 'copy';

interface Props {
  action: BulkAction;
  sourceDate: string;
  mealTypes: MealType[];
  selectedCount: number;
  busy: boolean;
  onClose: () => void;
  onApply: (action: BulkAction, targetDate: string, mealTypeId: string) => void;
}

const validDay = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

export default function DiaryBulkActionSheet({
  action,
  sourceDate,
  mealTypes,
  selectedCount,
  busy,
  onClose,
  onApply,
}: Props) {
  const { t } = useTranslation();
  const [targetDate, setTargetDate] = useState(sourceDate);
  const [targetMealTypeId, setTargetMealTypeId] = useState<string | null>(null);
  const dateIsValid = validDay(targetDate);
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/60"
      >
        <View className="max-h-[80%] rounded-t-3xl bg-background px-5 pt-5 pb-10">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xl font-bold text-text-primary">
              {action === 'copy'
                ? t('diary.bulk.copyTitle', {
                    defaultValue: 'Copy selected foods',
                  })
                : t('diary.bulk.moveTitle', {
                    defaultValue: 'Move selected foods',
                  })}
            </Text>
            <Pressable
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              className="min-h-11 min-w-11 items-center justify-center"
            >
              <Text className="text-accent-primary text-base">
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Text>
            </Pressable>
          </View>
          <Text className="text-sm text-text-secondary mb-4">
            {t('diary.bulk.selectedCount', {
              defaultValue: '{{count}} selected foods',
              count: selectedCount,
            })}
          </Text>
          <Text className="text-sm font-medium text-text-primary mb-1">
            {t('diary.bulk.targetDate', {
              defaultValue: 'Destination date (YYYY-MM-DD)',
            })}
          </Text>
          <TextInput
            value={targetDate}
            onChangeText={setTargetDate}
            accessibilityLabel={t('diary.bulk.targetDate', {
              defaultValue: 'Destination date (YYYY-MM-DD)',
            })}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            className="min-h-11 rounded-xl border border-border bg-surface px-3 text-text-primary mb-2"
          />
          {!dateIsValid && (
            <Text className="text-text-danger mb-2">
              {t('diary.bulk.invalidDate', {
                defaultValue: 'Enter a valid date.',
              })}
            </Text>
          )}
          <Text className="text-sm font-medium text-text-primary mb-2">
            {t('diary.bulk.targetMeal', { defaultValue: 'Destination meal' })}
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 6 }}
          >
            {mealTypes
              .filter((meal) => meal.is_visible)
              .map((meal) => (
                <Pressable
                  key={meal.id}
                  onPress={() => setTargetMealTypeId(meal.id)}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: targetMealTypeId === meal.id,
                  }}
                  className={`min-h-11 rounded-xl border px-4 py-3 ${targetMealTypeId === meal.id ? 'border-accent-primary bg-accent-primary/10' : 'border-border bg-surface'}`}
                >
                  <Text className="text-text-primary">
                    {getMealTypeDisplayLabel(meal, t)}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
          <Pressable
            disabled={busy || !action || !targetMealTypeId || !dateIsValid}
            onPress={() =>
              action &&
              targetMealTypeId &&
              onApply(action, targetDate, targetMealTypeId)
            }
            accessibilityRole="button"
            className="min-h-12 items-center justify-center rounded-xl bg-accent-primary mt-4 disabled:opacity-50"
          >
            <Text className="font-semibold text-white">
              {busy
                ? t('common.saving', { defaultValue: 'Saving…' })
                : t('diary.bulk.apply', { defaultValue: 'Apply' })}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
