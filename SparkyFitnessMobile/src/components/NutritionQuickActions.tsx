import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCachedNutritionFavorites } from '../hooks/useCachedNutritionFavorites';
import {
  logFavoriteFood,
  logQuickNutrition,
} from '../services/quickNutritionLog';

const numericValue = (text: string): number | undefined => {
  if (!text.trim()) return undefined;
  return Number(text.trim().replace(',', '.'));
};

interface Props {
  onTakePhoto?: () => void;
}

/** Shared outbox-backed entry points; server reachability is not consulted. */
export default function NutritionQuickActions({ onTakePhoto }: Props) {
  const { t } = useTranslation();
  const { cache, storageError } = useCachedNutritionFavorites();
  const [busy, setBusy] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const ready = cache && cache.mealTypes.some((type) => type.is_visible);
  if (!ready && !storageError && !onTakePhoto) return null;

  const error = (caught: unknown) => {
    Alert.alert(
      t('nutritionQuick.errorTitle', { defaultValue: 'Could not save entry' }),
      caught instanceof Error
        ? caught.message
        : t('nutritionQuick.storageError', {
            defaultValue: 'Please check device storage and try again.',
          })
    );
  };

  const favorite = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await logFavoriteFood(id);
    } catch (caught) {
      error(caught);
    } finally {
      setBusy(false);
    }
  };

  const saveQuick = async () => {
    if (busy) return;
    const parsedCalories = numericValue(calories);
    if (parsedCalories === undefined) {
      error(
        new Error(
          t('nutritionQuick.caloriesRequired', {
            defaultValue: 'Enter calories.',
          })
        )
      );
      return;
    }
    setBusy(true);
    try {
      await logQuickNutrition({
        calories: parsedCalories,
        protein: numericValue(protein),
        carbs: numericValue(carbs),
        fat: numericValue(fat),
      });
      setShowQuick(false);
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
    } catch (caught) {
      error(caught);
    } finally {
      setBusy(false);
    }
  };

  const foods = cache?.foods.slice(0, 4) ?? [];
  return (
    <View className="bg-surface rounded-xl p-4 mb-3 gap-3">
      <Text className="text-base font-bold text-text-primary">
        {t('nutritionQuick.title', { defaultValue: 'Quick nutrition' })}
      </Text>
      {storageError && (
        <Text className="text-sm text-text-danger">
          {t('nutritionQuick.cacheUnavailable', {
            defaultValue: 'Saved favorites are unavailable on this device.',
          })}
        </Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        {onTakePhoto && (
          <Pressable
            accessibilityRole="button"
            onPress={onTakePhoto}
            className="rounded-lg bg-background px-3 py-2"
          >
            <Text className="text-sm text-text-primary">
              {t('nutritionQuick.photo', { defaultValue: '📷 Meal photo' })}
            </Text>
          </Pressable>
        )}
        {foods.map((food) => (
          <Pressable
            key={food.id}
            accessibilityRole="button"
            accessibilityLabel={t('nutritionQuick.logFavorite', {
              defaultValue: 'Log {{name}}',
              name: food.name,
            })}
            disabled={busy}
            onPress={() => void favorite(food.id)}
            className="rounded-lg bg-background px-3 py-2"
          >
            <Text className="text-sm text-text-primary">★ {food.name}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          disabled={busy || !ready}
          onPress={() => setShowQuick(true)}
          className="rounded-lg bg-background px-3 py-2"
        >
          <Text className="text-sm text-text-primary">
            {t('nutritionQuick.manual', {
              defaultValue: '+ Calories and macros',
            })}
          </Text>
        </Pressable>
      </View>
      <Modal
        visible={showQuick}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuick(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface rounded-t-2xl p-5 gap-3">
            <Text className="text-lg font-bold text-text-primary">
              {t('nutritionQuick.manual', {
                defaultValue: '+ Calories and macros',
              })}
            </Text>
            {[
              {
                key: 'calories',
                label: t('nutritionQuick.calories', {
                  defaultValue: 'Calories',
                }),
                value: calories,
                setter: setCalories,
              },
              {
                key: 'protein',
                label: t('nutritionQuick.protein', {
                  defaultValue: 'Protein (g)',
                }),
                value: protein,
                setter: setProtein,
              },
              {
                key: 'carbs',
                label: t('nutritionQuick.carbs', {
                  defaultValue: 'Carbohydrate (g)',
                }),
                value: carbs,
                setter: setCarbs,
              },
              {
                key: 'fat',
                label: t('nutritionQuick.fat', { defaultValue: 'Fat (g)' }),
                value: fat,
                setter: setFat,
              },
            ].map((field) => (
              <TextInput
                key={field.key}
                accessibilityLabel={field.label}
                placeholder={field.label}
                placeholderTextColor="#888888"
                value={field.value}
                onChangeText={field.setter}
                keyboardType="decimal-pad"
                className="rounded-lg bg-background px-3 py-3 text-text-primary"
              />
            ))}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void saveQuick()}
              className="rounded-lg bg-accent-primary px-3 py-3"
            >
              <Text className="text-center font-semibold text-white">
                {t('common.save', { defaultValue: 'Save' })}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowQuick(false)}
            >
              <Text className="text-center text-text-secondary">
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
