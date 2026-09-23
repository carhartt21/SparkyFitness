import { useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getActiveServerConfig,
  proxyHeadersToRecord,
  type ServerConfig,
} from '../services/storage';
import { getAuthHeaders } from '../services/api/authService';
import { normalizeUrl } from '../services/api/apiClient';
import type { NutritionCapture } from '../services/api/nutritionCaptureApi';
import type {
  PendingPhotoAction,
  PendingPhotoCompletionAction,
} from '../services/nutritionActionOutbox';
import type { FoodEntry } from '../types/foodEntries';
import { completeMealPhotoLocally } from '../services/nutritionPhotoCompletion';
import { reconcileNutritionActions } from '../services/nutritionActionSync';
import SafeImage from './SafeImage';
import { formatDateToTimeLabel } from '../utils/entryTimeDisplay';

interface Props {
  local: PendingPhotoAction[];
  remote: NutritionCapture[];
  completions: PendingPhotoCompletionAction[];
  completedFoodEntries: FoodEntry[];
}

interface PhotoRow {
  id: string;
  consumedAt: string;
  state: 'incomplete' | 'complete';
  localImage: string | null;
  remoteImage: string | null;
  syncState: PendingPhotoAction['syncState'] | null;
  entryDate: string;
  mealTypeId: string | null;
  name: string | null;
  calories: number | null;
}

export default function NutritionPhotoEntries({
  local,
  remote,
  completions,
  completedFoodEntries,
}: Props) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [selected, setSelected] = useState<PhotoRow | null>(null);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => {
      void getActiveServerConfig()
        .then((value) => {
          if (active) setConfig(value);
        })
        .catch(() => undefined);
    };
    load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const rows = useMemo(() => {
    const localById = new Map(
      local.map((action) => [action.payload.id, action])
    );
    const completionByCapture = new Map(
      completions.map((action) => [action.payload.captureId, action])
    );
    const entryByCapture = new Map(
      completedFoodEntries
        .filter((entry) => entry.nutrition_capture_id)
        .map((entry) => [entry.nutrition_capture_id, entry])
    );
    const details = (id: string) => {
      const completion = completionByCapture.get(id);
      const entry = entryByCapture.get(id);
      return {
        state:
          completion || entry ? ('complete' as const) : ('incomplete' as const),
        name: completion?.payload.food.food_name ?? entry?.food_name ?? null,
        calories: completion?.payload.food.calories ?? entry?.calories ?? null,
      };
    };
    const merged: PhotoRow[] = remote.map((capture) => ({
      id: capture.id,
      consumedAt: capture.consumed_at,
      state:
        capture.completion_state === 'complete'
          ? 'complete'
          : details(capture.id).state,
      localImage: localById.get(capture.id)?.payload.images[0]?.uri ?? null,
      remoteImage: capture.images[0]?.url ?? null,
      syncState:
        completionByCapture.get(capture.id)?.syncState ??
        localById.get(capture.id)?.syncState ??
        null,
      entryDate: capture.entry_date,
      mealTypeId: capture.meal_type_id,
      name: details(capture.id).name,
      calories: details(capture.id).calories,
    }));
    const remoteIds = new Set(remote.map((capture) => capture.id));
    for (const action of local) {
      if (remoteIds.has(action.payload.id)) continue;
      merged.push({
        id: action.payload.id,
        consumedAt: action.payload.consumedAt,
        state: details(action.payload.id).state,
        localImage: action.payload.images[0]?.uri ?? null,
        remoteImage: null,
        syncState:
          completionByCapture.get(action.payload.id)?.syncState ??
          action.syncState,
        entryDate: action.payload.entryDate,
        mealTypeId: action.payload.mealTypeId ?? null,
        name: details(action.payload.id).name,
        calories: details(action.payload.id).calories,
      });
    }
    return merged.sort((a, b) => a.consumedAt.localeCompare(b.consumedAt));
  }, [local, remote, completions, completedFoodEntries]);

  const saveCompletion = async () => {
    if (!selected || saving) return;
    const numericValue = (value: string) =>
      Number(value.trim().replace(',', '.'));
    const energy = numericValue(calories);
    const label = name.trim();
    if (!label || !calories.trim() || !Number.isFinite(energy) || energy < 0) {
      setError(
        t('nutritionPhotos.validCompletion', {
          defaultValue: 'Enter a name and known calories.',
        })
      );
      return;
    }
    const optional = (value: string) =>
      value.trim() ? numericValue(value) : undefined;
    const macros = [protein, carbs, fat].map(optional);
    if (
      macros.some(
        (value) => value !== undefined && (!Number.isFinite(value) || value < 0)
      )
    ) {
      setError(
        t('nutritionPhotos.validMacros', {
          defaultValue: 'Macros must be non-negative numbers.',
        })
      );
      return;
    }
    setSaving(true);
    try {
      await completeMealPhotoLocally({
        captureId: selected.id,
        consumedAt: selected.consumedAt,
        entryDate: selected.entryDate,
        mealTypeId: selected.mealTypeId,
        name: label,
        calories: energy,
        protein: macros[0],
        carbs: macros[1],
        fat: macros[2],
      });
      setSelected(null);
      void reconcileNutritionActions().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  if (rows.length === 0) return null;
  const incomplete = rows.filter((row) => row.state === 'incomplete').length;
  return (
    <View className="bg-surface rounded-xl p-4 mb-3 gap-3">
      <Text className="text-base font-bold text-text-primary">
        {t('nutritionPhotos.title', { defaultValue: 'Meal photos' })}
      </Text>
      <Text className="text-sm text-text-muted">
        {t('nutritionPhotos.incompleteCount', {
          count: incomplete,
          defaultValue: '{{count}} incomplete',
        })}
      </Text>
      {rows.map((row) => {
        const source = row.localImage
          ? { uri: row.localImage, headers: {} }
          : row.remoteImage && config
            ? {
                uri: `${normalizeUrl(config.url)}${row.remoteImage}`,
                headers: {
                  ...proxyHeadersToRecord(config.proxyHeaders),
                  ...getAuthHeaders(config),
                },
              }
            : null;
        return (
          <Pressable
            key={row.id}
            className="flex-row gap-3 items-center"
            accessibilityRole="button"
            accessibilityLabel={
              row.state === 'incomplete'
                ? t('nutritionPhotos.completeMeal', {
                    defaultValue: 'Complete meal',
                  })
                : (row.name ?? undefined)
            }
            onPress={() => {
              if (row.state !== 'incomplete') return;
              setSelected(row);
              setName('');
              setCalories('');
              setProtein('');
              setCarbs('');
              setFat('');
              setError(null);
            }}
          >
            <SafeImage
              source={source}
              style={{ width: 64, height: 64, borderRadius: 8 }}
            />
            <View className="flex-1">
              <Text className="text-text-primary">
                {row.name ??
                  (row.state === 'incomplete'
                    ? t('nutritionPhotos.incomplete', {
                        defaultValue: 'Incomplete meal',
                      })
                    : t('nutritionPhotos.complete', {
                        defaultValue: 'Completed meal',
                      }))}
              </Text>
              {row.calories !== null && (
                <Text className="text-xs text-text-muted">
                  {t('nutritionPhotos.energy', {
                    value: row.calories,
                    defaultValue: '{{value}} kcal',
                  })}
                </Text>
              )}
              <Text className="text-xs text-text-muted">
                {formatDateToTimeLabel(new Date(row.consumedAt))}
              </Text>
              {row.syncState === 'attentionRequired' && (
                <Text className="text-xs text-text-danger">
                  {t('nutritionOutbox.attention', {
                    defaultValue: 'Needs attention',
                  })}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface rounded-t-2xl p-5 gap-3">
            <Text className="text-lg font-bold text-text-primary">
              {t('nutritionPhotos.completeMeal', {
                defaultValue: 'Complete meal',
              })}
            </Text>
            {(
              [
                [
                  t('nutritionPhotos.name', { defaultValue: 'Food name' }),
                  name,
                  setName,
                  false,
                ],
                [
                  t('nutritionQuick.calories', { defaultValue: 'Calories' }),
                  calories,
                  setCalories,
                  true,
                ],
                [
                  t('nutritionQuick.protein', { defaultValue: 'Protein (g)' }),
                  protein,
                  setProtein,
                  true,
                ],
                [
                  t('nutritionQuick.carbs', {
                    defaultValue: 'Carbohydrate (g)',
                  }),
                  carbs,
                  setCarbs,
                  true,
                ],
                [
                  t('nutritionQuick.fat', { defaultValue: 'Fat (g)' }),
                  fat,
                  setFat,
                  true,
                ],
              ] as const
            ).map(([label, value, onChange, numeric]) => (
              <TextInput
                key={label}
                accessibilityLabel={label}
                placeholder={label}
                value={value}
                onChangeText={onChange}
                keyboardType={numeric ? 'decimal-pad' : 'default'}
                className="border border-border rounded-lg p-3 text-text-primary"
                placeholderTextColor="#888"
              />
            ))}
            {error && <Text className="text-text-danger">{error}</Text>}
            <Pressable
              accessibilityRole="button"
              onPress={() => void saveCompletion()}
              disabled={saving}
              className="bg-accent-primary rounded-lg p-3"
            >
              <Text className="text-center text-white">
                {t('common.save', { defaultValue: 'Save' })}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelected(null)}
            >
              <Text className="text-center text-text-muted">
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
