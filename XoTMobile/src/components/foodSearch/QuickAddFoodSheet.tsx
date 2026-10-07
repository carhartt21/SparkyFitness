import Button from '../ui/Button';
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import Toast from 'react-native-toast-message';
import { useCSSVariable } from 'uniwind';
import { sheetContainer, useSheetBackdrop } from '../ui/sheetChrome';
import NeonButton from '../ui/NeonButton';
import { useFoodVariants } from '../../hooks/useFoodVariants';
import { useMealTypes } from '../../hooks/useMealTypes';
import { useAddFoodEntry } from '../../hooks/useAddFoodEntry';
import { formatLocalizedNumber } from '../../localization';
import { formatLocalizedUnitQuantity } from '../../utils/foodUnitLocalization';
import { getMealTypeDisplayLabel } from '../../utils/mealNutrition';
import { convertDraftToPayload } from '../../utils/multiAddFoodEntries';
import {
  buildQuickAddPresets,
  scaleServingNutrition,
  type QuickAddServingBasis,
} from '../../utils/quickAddServings';
import type { FoodItem } from '../../types/foods';

export interface QuickAddFoodSheetRef {
  present: (food: FoodItem) => void;
  dismiss: () => void;
}

interface QuickAddFoodSheetProps {
  /** Calendar day (YYYY-MM-DD) the entry is logged to. */
  date: string;
  /** Meal chosen by the caller (e.g. Diary meal "Add food"); else the app default. */
  mealTypeId?: string;
  /** Opens the full entry screen for options the sheet does not offer. */
  onMoreOptions: (food: FoodItem) => void;
}

interface ServingOption extends QuickAddServingBasis {
  id?: string;
}

const Chip = ({
  label,
  selected,
  onPress,
  accent,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accent: string;
  testID?: string;
}) => {
  return (
    <Button
      variant={selected ? 'primary' : 'secondary'}
      color={accent}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-11 justify-center   px-4 ${selected ? '' : ' '}`}
      style={selected ? {} : undefined}
    >
      <Text className="text-sm font-medium text-text-primary">{label}</Text>
    </Button>
  );
};

/**
 * Logs a food straight from the search list: choose one of the food's stored
 * servings and a preset amount, then add it without leaving the search.
 */
const QuickAddFoodSheet = forwardRef<
  QuickAddFoodSheetRef,
  QuickAddFoodSheetProps
>(({ date, mealTypeId, onMoreOptions }, ref) => {
  const { t } = useTranslation();
  const sheetRef = useRef<BottomSheetModal>(null);
  const renderBackdrop = useSheetBackdrop();
  const [surfaceBg, textMuted, accent] = useCSSVariable([
    '--color-surface',
    '--color-text-muted',
    '--color-accent-primary',
  ]) as [string, string, string];
  const [food, setFood] = useState<FoodItem | null>(null);
  const [variantKey, setVariantKey] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [chosenMealTypeId, setChosenMealTypeId] = useState<string | null>(null);

  const { variants } = useFoodVariants(food?.id ?? '', {
    enabled: !!food?.id,
  });
  const { mealTypes, defaultMealTypeId } = useMealTypes();

  const servingOptions = useMemo<ServingOption[]>(() => {
    if (!food) return [];
    const stored = (variants ?? []).map((variant) => ({ ...variant }));
    return stored.length > 0 ? stored : [{ ...food.default_variant }];
  }, [food, variants]);
  const optionKey = (option: ServingOption, index: number) =>
    option.id ?? `default-${index}`;
  const selectedIndex = Math.max(
    0,
    servingOptions.findIndex(
      (option, index) =>
        optionKey(option, index) ===
        (variantKey ?? food?.default_variant?.id ?? optionKey(option, 0))
    )
  );
  const serving = servingOptions[selectedIndex];
  const presets = serving ? buildQuickAddPresets(serving) : [];
  const quantity =
    presets.find((preset) => preset.multiplier === multiplier)?.quantity ??
    serving?.serving_size ??
    0;
  const nutrition = serving
    ? scaleServingNutrition(serving, quantity)
    : { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const mealId = chosenMealTypeId ?? mealTypeId ?? defaultMealTypeId ?? '';
  const selectedMeal = mealTypes.find((meal) => meal.id === mealId);

  const { addEntryAsync, isPending } = useAddFoodEntry();

  useImperativeHandle(ref, () => ({
    present: (next: FoodItem) => {
      setFood(next);
      setVariantKey(next.default_variant?.id ?? null);
      setMultiplier(1);
      setChosenMealTypeId(null);
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleAdd = async () => {
    if (!food || !serving || !mealId || isPending) return;
    const conversion = convertDraftToPayload({
      food,
      variant: {
        id: serving.id,
        serving_size: serving.serving_size,
        serving_unit: serving.serving_unit,
      },
      quantityText: String(quantity),
      mealTypeId: mealId,
      entryDate: date,
    });
    if (conversion.status !== 'ok') return;
    try {
      await addEntryAsync({ createEntryPayload: conversion.payload });
      Toast.show({
        type: 'success',
        text1: t('foodSearch.quickAdd.added', {
          defaultValue: 'Added {{food}} to {{meal}}',
          food: food.name,
          meal: selectedMeal
            ? getMealTypeDisplayLabel(selectedMeal, t)
            : t('foodSearch.quickAdd.diary', { defaultValue: 'your diary' }),
        }),
      });
      sheetRef.current?.dismiss();
    } catch {
      // useAddFoodEntry reports the failure; keep the sheet open to retry.
    }
  };

  const amountLabel = (value: number) =>
    serving ? formatLocalizedUnitQuantity(value, serving.serving_unit, t) : '';
  const macro = (value: number) =>
    formatLocalizedNumber(value, { maximumFractionDigits: 1 });

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      // Food search is a native modal; the overlay container keeps the sheet
      // above it instead of underneath the modal presentation.
      containerComponent={sheetContainer}
      backgroundStyle={{ backgroundColor: surfaceBg }}
      handleIndicatorStyle={{ backgroundColor: textMuted }}
    >
      <BottomSheetView className="px-5 pb-safe-or-6" testID="quick-add-sheet">
        {food && serving ? (
          <>
            <Text
              className="text-xl font-bold text-text-primary"
              accessibilityRole="header"
            >
              {food.name}
            </Text>
            {food.brand ? (
              <Text className="text-sm text-text-secondary">{food.brand}</Text>
            ) : null}

            <View
              className="mt-4 flex-row items-end justify-between rounded-2xl border border-border-subtle bg-raised px-4 py-3"
              testID="quick-add-summary"
            >
              <View>
                <Text className="text-3xl font-bold text-text-primary">
                  {formatLocalizedNumber(Math.round(nutrition.calories))}
                  <Text className="text-base font-medium text-text-secondary">
                    {' '}
                    {t('dashboard.kcal', { defaultValue: 'kcal' })}
                  </Text>
                </Text>
                <Text className="text-xs text-text-secondary">
                  {amountLabel(quantity)}
                </Text>
              </View>
              <Text className="text-xs text-text-secondary text-right">
                {t('foodSearch.quickAdd.macros', {
                  defaultValue: 'P {{protein}} g · C {{carbs}} g · F {{fat}} g',
                  protein: macro(nutrition.protein),
                  carbs: macro(nutrition.carbs),
                  fat: macro(nutrition.fat),
                })}
              </Text>
            </View>

            {servingOptions.length > 1 ? (
              <>
                <Text className="mt-4 mb-2 text-sm font-semibold text-text-primary">
                  {t('foodSearch.quickAdd.serving', {
                    defaultValue: 'Serving',
                  })}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {servingOptions.map((option, index) => (
                    <Chip
                      key={optionKey(option, index)}
                      testID={`quick-add-serving-${index}`}
                      label={formatLocalizedUnitQuantity(
                        option.serving_size,
                        option.serving_unit,
                        t
                      )}
                      selected={index === selectedIndex}
                      accent={accent}
                      onPress={() => {
                        setVariantKey(optionKey(option, index));
                        setMultiplier(1);
                      }}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text className="mt-4 mb-2 text-sm font-semibold text-text-primary">
              {t('foodSearch.quickAdd.amount', { defaultValue: 'Amount' })}
            </Text>
            <View className="flex-row gap-2">
              {presets.map((preset) => (
                <View key={preset.multiplier} className="flex-1">
                  <Chip
                    testID={`quick-add-amount-${preset.multiplier}`}
                    label={amountLabel(preset.quantity)}
                    selected={preset.multiplier === multiplier}
                    accent={accent}
                    onPress={() => setMultiplier(preset.multiplier)}
                  />
                </View>
              ))}
            </View>

            {mealTypes.length > 0 ? (
              <>
                <Text className="mt-4 mb-2 text-sm font-semibold text-text-primary">
                  {t('foodSearch.quickAdd.meal', { defaultValue: 'Meal' })}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {mealTypes.map((meal) => (
                    <Chip
                      key={meal.id}
                      testID={`quick-add-meal-${meal.id}`}
                      label={getMealTypeDisplayLabel(meal, t)}
                      selected={meal.id === mealId}
                      accent={accent}
                      onPress={() => setChosenMealTypeId(meal.id)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            <View className="mt-5 flex-row gap-3">
              <NeonButton
                testID="quick-add-more"
                variant="outline"
                label={t('foodSearch.quickAdd.moreOptionsShort', {
                  defaultValue: 'Options',
                })}
                accessibilityLabel={t('foodSearch.quickAdd.moreOptions', {
                  defaultValue: 'More options',
                })}
                className="min-w-0 flex-1"
                onPress={() => {
                  sheetRef.current?.dismiss();
                  onMoreOptions(food);
                }}
              />
              <NeonButton
                testID="quick-add-confirm"
                label={t('foodSearch.quickAdd.addShort', {
                  defaultValue: 'Add',
                })}
                accessibilityLabel={t('foodSearch.quickAdd.add', {
                  defaultValue: 'Add to diary',
                })}
                className="min-w-0 flex-1"
                loading={isPending}
                disabled={!mealId}
                onPress={() => void handleAdd()}
              />
            </View>
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

QuickAddFoodSheet.displayName = 'QuickAddFoodSheet';

export default QuickAddFoodSheet;
