import Button from '../ui/Button';
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
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
import { logCachedFood, logCachedMeal } from '../../services/quickNutritionLog';
import type { OfflineMealSnapshot } from '@workspace/shared';
import type { CachedMealType } from '../../services/nutritionFavoriteCache';
import type { NutritionActionIdentity } from '../../services/nutritionActionOutbox';
import { parseDecimalInput } from '../../utils/numericInput';

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
  onLogged?: () => void;
  offline?: {
    identity: NutritionActionIdentity;
    mealTypes: CachedMealType[];
    meal?: OfflineMealSnapshot;
  };
}

interface ServingOption extends QuickAddServingBasis {
  id?: string;
}

const Chip = ({
  label,
  caption,
  accessibilityLabel,
  selected,
  onPress,
  accent,
  testID,
}: {
  label: string;
  caption?: string;
  accessibilityLabel?: string;
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
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-11 justify-center   px-4 ${selected ? '' : ' '}`}
      style={selected ? {} : undefined}
    >
      <Text numberOfLines={1} className="text-sm font-medium text-text-primary">
        {label}
      </Text>
      {caption ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          className="text-xs text-text-secondary"
        >
          {caption}
        </Text>
      ) : null}
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
>(({ date, mealTypeId, onMoreOptions, onLogged, offline }, ref) => {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
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
  const [quantityText, setQuantityText] = useState<string | null>(null);
  const [savingOffline, setSavingOffline] = useState(false);
  const saving = useRef(false);

  const { variants } = useFoodVariants(food?.id ?? '', {
    enabled: !!food?.id && !offline,
  });
  const onlineMealTypes = useMealTypes({ enabled: !offline });
  const mealTypes =
    offline?.mealTypes
      .filter((meal) => meal.is_visible)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((meal) => ({ ...meal, user_id: meal.user_id ?? null })) ??
    onlineMealTypes.mealTypes;
  const defaultMealTypeId = offline
    ? (
        mealTypes.find(
          (meal) => 'show_in_quick_log' in meal && meal.show_in_quick_log
        ) ?? mealTypes[0]
      )?.id
    : onlineMealTypes.defaultMealTypeId;

  const servingOptions = useMemo<ServingOption[]>(() => {
    if (!food) return [];
    const stored = (offline ? [] : (variants ?? [])).map((variant) => ({
      ...variant,
    }));
    return stored.length > 0 ? stored : [{ ...food.default_variant }];
  }, [food, variants, offline]);
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
  const presetQuantity =
    presets.find((preset) => preset.multiplier === multiplier)?.quantity ??
    serving?.serving_size ??
    0;
  const quantity =
    quantityText === null ? presetQuantity : parseDecimalInput(quantityText);
  const validQuantity = Number.isFinite(quantity) && quantity > 0;
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
      setQuantityText(null);
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleAdd = async () => {
    if (
      !food ||
      !serving ||
      !mealId ||
      isPending ||
      saving.current ||
      !validQuantity
    )
      return;
    if (offline) {
      saving.current = true;
      setSavingOffline(true);
      try {
        const options = {
          identity: offline.identity,
          snapshot: food,
          entryDate: date,
          mealTypeId: mealId,
          quantity,
        };
        if (offline.meal) await logCachedMeal(offline.meal, options);
        else await logCachedFood(food.id, options);
        Toast.show({
          type: 'success',
          text1: t('foodSearch.offline.saved', {
            defaultValue: 'Saved on this device',
          }),
          text2: t('foodSearch.offline.pending', {
            defaultValue: 'Waiting to sync when connected.',
          }),
        });
        sheetRef.current?.dismiss();
        onLogged?.();
      } catch {
        Toast.show({
          type: 'error',
          text1: t('foodSearch.offline.saveFailed', {
            defaultValue: 'Could not save this entry',
          }),
          text2: t('foodSearch.offline.retry', {
            defaultValue:
              'Keep this screen open and try again. Check that the same account is selected.',
          }),
        });
      } finally {
        saving.current = false;
        setSavingOffline(false);
      }
      return;
    }
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
      onLogged?.();
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
      accessible={false}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      // Food search is a native modal; the overlay container keeps the sheet
      // above it instead of underneath the modal presentation.
      containerComponent={sheetContainer}
      backgroundStyle={{ backgroundColor: surfaceBg }}
      handleIndicatorStyle={{ backgroundColor: textMuted }}
    >
      <BottomSheetScrollView
        contentContainerClassName="px-5 pb-safe-or-6"
        keyboardShouldPersistTaps="handled"
        testID="quick-add-sheet"
      >
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
              className={`mt-4 gap-2 rounded-2xl border border-border-subtle bg-raised px-4 py-3 ${fontScale > 1.3 ? 'flex-col items-stretch' : 'flex-row items-end justify-between'}`}
              testID="quick-add-summary"
            >
              <View className="min-w-0 shrink">
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
              <Text
                testID="quick-add-macros"
                className={`min-w-0 shrink text-xs text-text-secondary ${fontScale > 1.3 ? 'text-left' : 'flex-1 text-right'}`}
              >
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
                        setQuantityText(null);
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
              {presets.map((preset) => {
                const fullLabel = amountLabel(preset.quantity);
                const number = formatLocalizedNumber(preset.quantity, {
                  useGrouping: false,
                  maximumFractionDigits: 4,
                });
                const split = fullLabel.length > 8;
                return (
                  <View key={preset.multiplier} className="flex-1">
                    <Chip
                      testID={`quick-add-amount-${preset.multiplier}`}
                      label={split ? number : fullLabel}
                      caption={
                        split
                          ? fullLabel.slice(number.length).trim()
                          : undefined
                      }
                      accessibilityLabel={fullLabel}
                      selected={
                        quantityText === null &&
                        preset.multiplier === multiplier
                      }
                      accent={accent}
                      onPress={() => {
                        setMultiplier(preset.multiplier);
                        setQuantityText(null);
                      }}
                    />
                  </View>
                );
              })}
            </View>

            {offline ? (
              <View className="mt-3">
                <BottomSheetTextInput
                  testID="quick-add-offline-quantity"
                  accessibilityLabel={t('foodSearch.quickAdd.amount', {
                    defaultValue: 'Amount',
                  })}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  value={
                    quantityText ??
                    formatLocalizedNumber(presetQuantity, {
                      useGrouping: false,
                      maximumFractionDigits: 3,
                    })
                  }
                  onChangeText={setQuantityText}
                  className="min-h-12 rounded-xl border border-border-subtle bg-raised px-4 py-2 text-base text-text-primary"
                />
                <Text className="mt-2 text-xs text-text-secondary">
                  {t('foodSearch.offline.servingNote', {
                    defaultValue:
                      'Uses the serving saved on this device. New servings need a connection.',
                  })}
                </Text>
                {!validQuantity ? (
                  <Text
                    className="mt-1 text-sm text-icon-danger"
                    accessibilityRole="alert"
                  >
                    {t('foodSearch.offline.invalidAmount', {
                      defaultValue: 'Enter an amount greater than zero.',
                    })}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {mealTypes.length > 0 ? (
              <>
                <Text className="mt-4 mb-2 text-sm font-semibold text-text-primary">
                  {t('foodSearch.quickAdd.meal', {
                    defaultValue: 'Meal',
                  })}
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
              {!offline ? (
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
              ) : null}
              <NeonButton
                testID="quick-add-confirm"
                label={t('foodSearch.quickAdd.addShort', {
                  defaultValue: 'Add',
                })}
                accessibilityLabel={t('foodSearch.quickAdd.add', {
                  defaultValue: 'Add to diary',
                })}
                className="min-w-0 flex-1"
                loading={isPending || savingOffline}
                disabled={!mealId || !validQuantity}
                onPress={() => void handleAdd()}
              />
            </View>
          </>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

QuickAddFoodSheet.displayName = 'QuickAddFoodSheet';

export default QuickAddFoodSheet;
