import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocalizedNumber } from '../localization';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Platform,
  Animated,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import Toast from 'react-native-toast-message';
import { StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useGlowTheme, withAlpha } from '../components/ui/glow';
import { useQuery } from '@tanstack/react-query';
import { formatLocalizedUnitQuantity } from '../utils/foodUnitLocalization';
import Icon from '../components/Icon';
import MarkdownNotesField from '../components/MarkdownNotesField';
import { useKeepNoteVisible } from '../hooks/useKeepNoteVisible';
import { NoteMarkdown } from '../components/NoteMarkdown';
import SafeImage from '../components/SafeImage';
import { Image } from 'expo-image';
import { foodFallbackImage } from '../utils/foodFallbackImages';
import type { ExternalFoodItem } from '../types/externalFoods';
import VerifiedBadge from '../components/VerifiedBadge';
import { useFoodImageSourceContext } from '../components/FoodImageSourceProvider';
import { externalFoodImage, usableFoodImages } from '../utils/foodImages';
import BottomSheetPicker from '../components/BottomSheetPicker';
import AmountWheel, { AMOUNT_WHEEL_HEIGHT } from '../components/AmountWheel';
import UnitDropdown from '../components/UnitDropdown';
import { buildEditFoodParams } from '../utils/editFoodRoute';
import { FoodNutrientBreakdown } from '../components/FoodNutritionSummary';
import { localizeNutrientKey } from '../utils/nutrientLocalization';
import { fetchDailyGoals } from '../services/api/goalsApi';
import { setPendingMealIngredientSelection } from '../services/mealBuilderSelection';
import {
  buildMealPlanFoodAssignment,
  buildMealPlanMealAssignment,
  setPendingMealPlanSelection,
} from '../services/mealPlanSelection';
import { setPendingContainerLinkSelection } from '../services/waterContainerLinkSelection';
import {
  CreateFoodEntryPayload,
  deleteFoodEntry,
} from '../services/api/foodEntriesApi';
import {
  addDays,
  formatDateLabel,
  getTodayDate,
  getDeviceTimezone,
} from '../utils/dateUtils';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import {
  isMetricInputUnit,
  prefillEntryTime,
  servingWeightOf,
  userHourMinute,
} from '@workspace/shared';
import TimeSheet, { type TimeSheetRef } from '../components/TimeSheet';
import { formatTimeLabel } from '../utils/entryTimeDisplay';
import { getMealTypeDisplayLabel } from '../utils/mealNutrition';
import { goalsQueryKey } from '../hooks/queryKeys';
import {
  useFavorites,
  useMealTypes,
  usePreferences,
  useProfile,
  useServerConnection,
  useToggleFavorite,
} from '../hooks';
import type { FoodItem } from '../types/foods';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { getNetCarbsValue } from '../utils/nutrientUtils';
import {
  useCreateFoodVariant,
  useFoodVariants,
} from '../hooks/useFoodVariants';
import { useSaveFood } from '../hooks/useSaveFood';
import { useAddFoodEntry } from '../hooks/useAddFoodEntry';
import { useFoodLastServing } from '../hooks/useFoodLastServing';
import { useAddFoodEntryMeal } from '../hooks/useAddFoodEntryMeal';
import type { FoodEntryMealCreateData } from '../types/foodEntryMeals';
import CalendarSheet, {
  type CalendarSheetRef,
} from '../components/CalendarSheet';
import DateSelectRow from '../components/DateSelectRow';
import { FooterSaveBar } from '../components/FormScreenChrome';
import Button from '../components/ui/Button';
import { createDuplicatePressGuard } from '../utils/duplicatePress';
import type { FoodFormData } from '../components/FoodForm';
import type { Meal, MealIngredientDraft } from '../types/meals';
import type {
  EquivalentUnit,
  FoodUnitSelectionResult,
  FoodUnitVariant,
} from '../types/foodUnitVariants';
import {
  createFoodVariant,
  type CreateFoodVariantPayload,
} from '../services/api/foodsApi';
import {
  type FoodInfoItem,
  foodItemToFoodInfo,
  toFormString,
  parseOptional,
} from '../types/foodInfo';
import type { RootStackScreenProps } from '../types/navigation';
import {
  buildCreateFoodVariantInput,
  buildCreateFoodVariantPayload,
  buildExternalUnitVariants,
  buildExternalVariantOptions,
  buildLocalUnitVariants,
  foodInfoToUnitVariant,
  localVariantToUnitVariant,
  formatQuantityUnitLabel,
  formatServingSizeDisplay,
  formatVariantLabel,
  formatVariantServingLabel,
  resolveFoodDisplayValues,
  toPersistedServingUnit,
  unitVariantToDisplayValues,
  type FoodDisplayValues,
} from '../utils/foodDetails';
import {
  buildQuickAddServings,
  buildServingOptions,
  convertServingQuantity,
  findNutritionBasis,
  type QuickAddServing,
  type ServingOption,
} from '../utils/servingOptions';
import { buildMealIngredientDraft } from '../utils/mealBuilderDraft';
import { persistExternalVariants } from '../utils/persistExternalVariants';
import { parseDecimalInput } from '../utils/numericInput';
import { completeMealPhotoWithFoodLocally } from '../services/nutritionPhotoCompletion';
import { reconcileNutritionActions } from '../services/nutritionActionSync';

type FoodEntryAddScreenProps = RootStackScreenProps<'FoodEntryAdd'>;
const EXTERNAL_DRAFT_VARIANT_ID = '__draft-external-unit__';
// Sentinel written by FoodForm for AI-converted draft units; never a real DB ID.
const FORM_DRAFT_UNIT_ID = '__food-form-draft-unit__';

const NUTRITION_FIELDS = [
  'fiber',
  'saturatedFat',
  'sodium',
  'sugars',
  'transFat',
  'potassium',
  'calcium',
  'iron',
  'caffeineMg',
  'waterMl',
  'alcoholG',
  'cholesterol',
  'vitaminA',
  'vitaminC',
] as const;

function toFiniteNumber(value: unknown, fallback: number): number {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toOptionalFiniteNumber(
  value: unknown,
  fallback: number | undefined
): number | undefined {
  if (value == null || value === '') {
    return fallback;
  }

  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

/** Provider variants may contain null for unknown nutrients despite UI types. */
function knownSnapshotNumber(
  value: number | null | undefined
): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function toNonEmptyString(value: unknown, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : fallback;
}

function mergeVariantDisplayValues(
  variant: Partial<FoodUnitVariant> | null | undefined,
  fallback: FoodDisplayValues
): FoodDisplayValues {
  const mergedValues: FoodDisplayValues = {
    servingSize: toFiniteNumber(variant?.serving_size, fallback.servingSize),
    servingUnit: toNonEmptyString(variant?.serving_unit, fallback.servingUnit),
    calories: toFiniteNumber(variant?.calories, fallback.calories),
    protein: toFiniteNumber(variant?.protein, fallback.protein),
    carbs: toFiniteNumber(variant?.carbs, fallback.carbs),
    fat: toFiniteNumber(variant?.fat, fallback.fat),
  };

  for (const field of NUTRITION_FIELDS) {
    const variantFieldKey =
      field === 'fiber'
        ? 'dietary_fiber'
        : field === 'saturatedFat'
          ? 'saturated_fat'
          : field === 'transFat'
            ? 'trans_fat'
            : field === 'vitaminA'
              ? 'vitamin_a'
              : field === 'vitaminC'
                ? 'vitamin_c'
                : field;

    mergedValues[field] = toOptionalFiniteNumber(
      variant?.[variantFieldKey as keyof FoodUnitVariant],
      fallback[field]
    );
  }

  return mergedValues;
}

const FoodEntryAddScreenContent: React.FC<FoodEntryAddScreenProps> = ({
  navigation,
  route,
}) => {
  const { item, date: initialDate } = route.params;
  const photoCapture = route.params.photoCapture;
  const { t, i18n } = useTranslation();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [logDetailsExpanded, setLogDetailsExpanded] = useState(false);
  const allowAddPress = useRef(createDuplicatePressGuard()).current;
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const getFoodImageSource = useFoodImageSourceContext();
  const pickerMode = route.params?.pickerMode ?? 'log-entry';
  const returnDepth = route.params?.returnDepth ?? 1;
  const ingredientIndex = route.params?.ingredientIndex;
  const isMealBuilderMode = pickerMode === 'meal-builder';
  const isMealPlanMode = pickerMode === 'meal-plan';
  const isContainerLinkMode = pickerMode === 'container-link';
  const isSelectionMode =
    isMealBuilderMode || isMealPlanMode || isContainerLinkMode;
  const mealPlanTarget = route.params?.mealPlanTarget;
  const [selectedDate, setSelectedDateState] = useState(
    initialDate ?? useDiaryDateStore.getState().selectedDate
  );
  // Logging always targets the Dashboard/Diary date; changing it here should
  // carry back so the other views stay on the same day, not just inherit it.
  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    useDiaryDateStore.getState().setSelectedDate(date);
  }, []);
  const calendarRef = useRef<CalendarSheetRef>(null);
  const timeSheetRef = useRef<TimeSheetRef>(null);
  const { mealTypes, defaultMealTypeId } = useMealTypes();
  const { isConnected } = useServerConnection();
  const { preferences } = usePreferences({ enabled: isConnected });
  const showNetCarbs = preferences?.show_net_carbs === true;
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>(
    route.params?.mealTypeId
  );
  // When editing an existing meal ingredient, pre-populate adjustedValues from
  // the ingredient's stored nutrition snapshot so the form shows the actual
  // saved values, not the API variant which may differ.
  const [adjustedValues, setAdjustedValues] = useState<FoodFormData | null>(
    () => {
      if (ingredientIndex === undefined) return null;
      return {
        name: item.name,
        brand: item.brand ?? '',
        // A meal ingredient carries a nutrition snapshot, not a note; the note
        // belongs to the food and to the diary entry, not to this row.
        notes: '',
        servingSize: item.servingSize != null ? String(item.servingSize) : '',
        servingUnit: item.servingUnit,
        calories: item.calories != null ? String(item.calories) : '',
        protein: item.protein != null ? String(item.protein) : '',
        carbs: item.carbs != null ? String(item.carbs) : '',
        fat: item.fat != null ? String(item.fat) : '',
        fiber: toFormString(item.fiber),
        saturatedFat: toFormString(item.saturatedFat),
        transFat: toFormString(item.transFat),
        sodium: toFormString(item.sodium),
        sugars: toFormString(item.sugars),
        potassium: toFormString(item.potassium),
        cholesterol: toFormString(item.cholesterol),
        calcium: toFormString(item.calcium),
        iron: toFormString(item.iron),
        vitaminA: toFormString(item.vitaminA),
        vitaminC: toFormString(item.vitaminC),
        caffeineMg: toFormString(item.caffeineMg),
        waterMl: toFormString(item.waterMl),
        alcoholG: toFormString(item.alcoholG),
      };
    }
  );
  // Custom-nutrient overrides returned from the adjust screen. `undefined`
  // means "not adjusted" (fall back to the variant/item snapshot).
  const [adjustedCustomNutrients, setAdjustedCustomNutrients] = useState<
    Record<string, string | number> | null | undefined
  >(undefined);
  const [savedFoodOverride, setSavedFoodOverride] =
    useState<FoodInfoItem | null>(null);
  // Edit Food returns the saved food (name, brand, photos) to this screen.
  const updatedItemFromEdit = route.params?.updatedItem;
  useEffect(() => {
    if (!updatedItemFromEdit) return;
    setSavedFoodOverride(updatedItemFromEdit);
    navigation.setParams({
      updatedItem: undefined,
      updatedSelectedVariantId: undefined,
    });
  }, [updatedItemFromEdit, navigation]);
  const [selectedVariantOverride, setSelectedVariantOverride] =
    useState<FoodUnitVariant | null>(
      route.params?.selectedVariantOverride ?? null
    );
  const activeItem = savedFoodOverride ?? item;
  const displayBrand = adjustedValues?.brand ?? activeItem.brand;
  const foodImagePath = externalFoodImage(activeItem);
  const foodImageSource = foodImagePath
    ? getFoodImageSource(foodImagePath)
    : null;
  // Category artwork is display-only; it is never saved as the food's image.
  const foodGroupTags =
    activeItem.source === 'external'
      ? (activeItem.originalItem as ExternalFoodItem).food_group_tags
      : undefined;
  const fallbackArtwork = foodFallbackImage(
    activeItem.name,
    activeItem.source === 'meal',
    foodGroupTags
  );
  const effectiveMealId = selectedMealId ?? defaultMealTypeId;
  const selectedMealType = mealTypes.find((mt) => mt.id === effectiveMealId);

  const [entryTime, setEntryTime] = useState('');
  // The note for THIS diary entry. The food's own note is shown read-only
  // beside it and is never copied in.
  const [entryNotes, setEntryNotes] = useState('');
  const noteVisibility = useKeepNoteVisible(96);
  const entryTimeTouched = useRef(false);
  useEffect(() => {
    if (entryTimeTouched.current) return;
    setEntryTime(
      prefillEntryTime({
        defaultTime: selectedMealType?.default_time,
        isToday: selectedDate === getTodayDate(),
        tz: getDeviceTimezone(),
      })
    );
  }, [selectedDate, selectedMealType?.default_time]);
  const handleSelectEntryTime = (time: string) => {
    entryTimeTouched.current = true;
    setEntryTime(time);
  };
  const handleSetEntryTimeNow = () => {
    const { hour, minute } = userHourMinute(getDeviceTimezone());
    handleSelectEntryTime(
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    );
  };

  const isLocalFood = activeItem.source === 'local';
  const hasExternalVariants = !!(
    activeItem.externalVariants && activeItem.externalVariants.length >= 1
  );
  const [selectedVariantId, setSelectedVariantId] = useState<
    string | undefined
  >(hasExternalVariants ? (item.variantId ?? 'ext-0') : item.variantId);

  const { variants } = useFoodVariants(activeItem.id, { enabled: isLocalFood });
  const { createVariant, isPending: isCreateVariantPending } =
    useCreateFoodVariant();

  // Grams (or ml) first, then the saved portions in the user's order. A grams
  // option derived from a weighed serving is logged against that row with
  // serving overrides, which meal and plan pickers cannot carry.
  const localVariantOptions = useMemo<ServingOption[]>(
    () =>
      buildServingOptions(variants, {
        allowSynthesizedMetric: !isSelectionMode,
      }),
    [variants, isSelectionMode]
  );
  const localUnitVariants = useMemo(
    () => buildLocalUnitVariants(variants),
    [variants]
  );
  const selectedServingOption = isLocalFood
    ? localVariantOptions.find((option) => option.id === selectedVariantId)
    : undefined;
  /** The food_variants row an entry for the current selection is logged to. */
  const loggedVariantId = selectedServingOption?.variantId ?? selectedVariantId;
  const servingOverrideFields = selectedServingOption?.servingOverride
    ? {
        serving_size: selectedServingOption.servingOverride.serving_size,
        serving_unit: selectedServingOption.servingOverride.serving_unit,
      }
    : {};
  // Opening a food fresh starts in grams; a serving the user already chose
  // (an ingredient, an entry, an adjusted unit) is kept.
  const keepsInitialServing =
    ingredientIndex !== undefined ||
    !!route.params?.selectedVariantOverride ||
    (activeItem.source === 'local' &&
      'quantity' in activeItem.originalItem &&
      activeItem.originalItem.quantity != null);
  const initialUnitResolvedRef = useRef(keepsInitialServing);
  const { lastServing } = useFoodLastServing(activeItem.id, {
    enabled: isLocalFood && isConnected && !isSelectionMode,
  });
  const quickAddServings = useMemo(
    () =>
      isLocalFood && !isSelectionMode && !photoCapture
        ? buildQuickAddServings(localVariantOptions, lastServing)
        : [],
    [
      isLocalFood,
      isSelectionMode,
      photoCapture,
      localVariantOptions,
      lastServing,
    ]
  );
  const externalVariantOptions = useMemo(
    () =>
      buildExternalVariantOptions(activeItem.externalVariants).sort(
        (a, b) =>
          Number(b.servingUnit.toLowerCase() === 'g') -
          Number(a.servingUnit.toLowerCase() === 'g')
      ),
    [activeItem.externalVariants]
  );
  const externalUnitVariants = useMemo(
    () => buildExternalUnitVariants(activeItem.externalVariants),
    [activeItem.externalVariants]
  );
  const activeItemVariant = useMemo(
    () => foodInfoToUnitVariant(activeItem),
    [activeItem]
  );

  const selectorVariants = useMemo(() => {
    if (isLocalFood) {
      const currentVariant =
        selectedVariantId &&
        !localUnitVariants.some((variant) => variant.id === selectedVariantId)
          ? {
              ...activeItemVariant,
              id: selectedVariantId,
            }
          : null;
      const loadedVariants =
        selectedVariantOverride?.id &&
        !localUnitVariants.some(
          (variant) => variant.id === selectedVariantOverride.id
        )
          ? [selectedVariantOverride, ...localUnitVariants]
          : currentVariant
            ? [currentVariant, ...localUnitVariants]
            : localUnitVariants;

      return loadedVariants.length > 0 ? loadedVariants : [activeItemVariant];
    }

    const loadedVariants =
      selectedVariantOverride &&
      !externalUnitVariants.some(
        (variant) => variant.id === selectedVariantOverride.id
      )
        ? [selectedVariantOverride, ...externalUnitVariants]
        : externalUnitVariants;

    return loadedVariants.length > 0 ? loadedVariants : [activeItemVariant];
  }, [
    activeItemVariant,
    externalUnitVariants,
    isLocalFood,
    localUnitVariants,
    selectedVariantId,
    selectedVariantOverride,
  ]);

  const variantPickerOptions = useMemo(() => {
    const effectiveId = selectedVariantId;
    const baseOptions = isLocalFood
      ? localVariantOptions
      : externalVariantOptions;
    if (
      effectiveId &&
      !baseOptions.some((variant) => variant.id === effectiveId)
    ) {
      const fallbackVariant: FoodDisplayValues =
        selectedVariantOverride &&
        selectedVariantOverride.id === selectedVariantId
          ? unitVariantToDisplayValues(selectedVariantOverride)
          : unitVariantToDisplayValues(activeItemVariant);

      return [
        {
          id: selectedVariantId,
          label: formatVariantLabel(fallbackVariant),
          quantityUnitLabel: formatQuantityUnitLabel(fallbackVariant),
          perServingLabel: formatVariantServingLabel(fallbackVariant),
          ...fallbackVariant,
        },
        ...baseOptions,
      ];
    }

    if (
      !selectedVariantOverride?.id ||
      selectedVariantOverride.id === EXTERNAL_DRAFT_VARIANT_ID
    ) {
      return baseOptions;
    }

    if (
      baseOptions.some((variant) => variant.id === selectedVariantOverride.id)
    ) {
      return baseOptions;
    }

    return [
      {
        id: selectedVariantOverride.id,
        label: formatVariantLabel(
          unitVariantToDisplayValues(selectedVariantOverride)
        ),
        quantityUnitLabel: formatQuantityUnitLabel(
          unitVariantToDisplayValues(selectedVariantOverride)
        ),
        perServingLabel: formatVariantServingLabel(
          unitVariantToDisplayValues(selectedVariantOverride)
        ),
        ...unitVariantToDisplayValues(selectedVariantOverride),
      },
      ...baseOptions,
    ];
  }, [
    activeItemVariant,
    externalVariantOptions,
    isLocalFood,
    localVariantOptions,
    selectedVariantId,
    selectedVariantOverride,
  ]);

  const selectedUnitSelection = useMemo<
    FoodUnitSelectionResult | undefined
  >(() => {
    if (selectedVariantOverride) {
      return {
        kind:
          !selectedVariantOverride.id ||
          selectedVariantOverride.id === EXTERNAL_DRAFT_VARIANT_ID ||
          selectedVariantOverride.id === FORM_DRAFT_UNIT_ID
            ? 'draft'
            : 'existing',
        variant: selectedVariantOverride,
      };
    }

    const selectedVariant =
      selectorVariants.find((variant) => variant.id === selectedVariantId) ??
      null;
    return selectedVariant
      ? { kind: 'existing', variant: selectedVariant }
      : undefined;
  }, [selectedVariantId, selectedVariantOverride, selectorVariants]);

  const selectedBaseVariant = useMemo(
    () =>
      resolveFoodDisplayValues({
        item: activeItem,
        selectedVariantId,
        localVariantOptions,
        externalVariantOptions,
      }),
    [activeItem, selectedVariantId, localVariantOptions, externalVariantOptions]
  );

  const activeVariant = useMemo(
    () =>
      selectedVariantOverride
        ? unitVariantToDisplayValues(selectedVariantOverride)
        : selectedBaseVariant,
    [selectedBaseVariant, selectedVariantOverride]
  );

  const selectedCustomNutrients = useMemo(() => {
    // Edits from the adjust screen take priority over the stored snapshot.
    if (adjustedCustomNutrients !== undefined) {
      return adjustedCustomNutrients;
    }

    if (selectedVariantOverride) {
      return selectedVariantOverride.custom_nutrients ?? null;
    }

    if (isLocalFood && variants && selectedVariantId) {
      const selectedVariant = variants.find(
        (variant) => variant.id === selectedVariantId
      );
      if (selectedVariant) {
        return selectedVariant.custom_nutrients ?? null;
      }
    }

    if ((selectedVariantId ?? null) === (activeItem.variantId ?? null)) {
      return activeItem.customNutrients ?? null;
    }

    return undefined;
  }, [
    adjustedCustomNutrients,
    activeItem.customNutrients,
    activeItem.variantId,
    isLocalFood,
    selectedVariantId,
    selectedVariantOverride,
    variants,
  ]);

  const displayValues = useMemo(() => {
    if (!adjustedValues) return activeVariant;
    return {
      servingSize:
        parseDecimalInput(adjustedValues.servingSize) ||
        activeVariant.servingSize,
      servingUnit: adjustedValues.servingUnit || activeVariant.servingUnit,
      calories: parseDecimalInput(adjustedValues.calories) || 0,
      protein: parseDecimalInput(adjustedValues.protein) || 0,
      carbs: parseDecimalInput(adjustedValues.carbs) || 0,
      fat: parseDecimalInput(adjustedValues.fat) || 0,
      fiber: parseOptional(adjustedValues.fiber),
      saturatedFat: parseOptional(adjustedValues.saturatedFat),
      sodium: parseOptional(adjustedValues.sodium),
      sugars: parseOptional(adjustedValues.sugars),
      transFat: parseOptional(adjustedValues.transFat),
      potassium: parseOptional(adjustedValues.potassium),
      calcium: parseOptional(adjustedValues.calcium),
      iron: parseOptional(adjustedValues.iron),
      caffeineMg: parseOptional(adjustedValues.caffeineMg),
      waterMl: parseOptional(adjustedValues.waterMl),
      alcoholG: parseOptional(adjustedValues.alcoholG),
      cholesterol: parseOptional(adjustedValues.cholesterol),
      vitaminA: parseOptional(adjustedValues.vitaminA),
      vitaminC: parseOptional(adjustedValues.vitaminC),
    };
  }, [adjustedValues, activeVariant]);

  const quantityUnitLabel = selectedServingOption
    ? (selectedServingOption.quantityUnitLabel ?? selectedServingOption.label)
    : displayValues.servingUnit.toLowerCase() === 'g'
      ? formatQuantityUnitLabel({
          servingUnit: 'g',
          servingDescription: undefined,
        })
      : (variantPickerOptions.find((option) => option.id === selectedVariantId)
          ?.quantityUnitLabel ?? formatQuantityUnitLabel(displayValues));
  const gramVariantId = variantPickerOptions.find(
    (option) => option.id && option.servingUnit.toLowerCase() === 'g'
  )?.id;
  const perServingLabel =
    variantPickerOptions.find((option) => option.id === selectedVariantId)
      ?.perServingLabel ?? formatVariantServingLabel(displayValues);

  const pendingVariantToPersist = useMemo<FoodUnitVariant | null>(() => {
    if (!selectedVariantOverride) return null;

    return {
      ...selectedVariantOverride,
      serving_size: displayValues.servingSize,
      serving_unit: displayValues.servingUnit,
      calories: displayValues.calories,
      protein: displayValues.protein,
      carbs: displayValues.carbs,
      fat: displayValues.fat,
      saturated_fat: displayValues.saturatedFat,
      trans_fat: displayValues.transFat,
      cholesterol: displayValues.cholesterol,
      sodium: displayValues.sodium,
      potassium: displayValues.potassium,
      dietary_fiber: displayValues.fiber,
      sugars: displayValues.sugars,
      vitamin_a: displayValues.vitaminA,
      vitamin_c: displayValues.vitaminC,
      calcium: displayValues.calcium,
      iron: displayValues.iron,
      caffeine_mg: displayValues.caffeineMg,
      water_ml: displayValues.waterMl,
      alcohol_g: displayValues.alcoholG,
    };
  }, [displayValues, selectedVariantOverride]);

  const saveFoodSourceValues = useMemo(() => {
    if (activeItem.source === 'external' && pendingVariantToPersist) {
      return selectedBaseVariant;
    }
    return displayValues;
  }, [
    activeItem.source,
    displayValues,
    pendingVariantToPersist,
    selectedBaseVariant,
  ]);

  const initialQuantity = useMemo(() => {
    if (
      activeItem.source === 'local' &&
      'quantity' in activeItem.originalItem &&
      activeItem.originalItem.quantity != null
    ) {
      const originalQuantity = parseDecimalInput(
        String(activeItem.originalItem.quantity)
      );
      if (originalQuantity && originalQuantity > 0) {
        return originalQuantity;
      }
    }
    return activeVariant.servingSize;
  }, [activeItem, activeVariant.servingSize]);

  const [quantityText, setQuantityText] = useState(String(initialQuantity));
  const quantity = parseDecimalInput(quantityText) || 0;
  const servings =
    displayValues.servingSize > 0 ? quantity / displayValues.servingSize : 0;
  const servingSizeRef = useRef(displayValues.servingSize);
  const pendingEquivalentsRef = useRef<EquivalentUnit[] | null>(null);

  const adjustedFromNav = route.params?.adjustedValues;
  const adjustedUnitSelectionFromNav = route.params?.adjustedUnitSelection;
  const adjustedCustomNutrientsFromNav = route.params?.adjustedCustomNutrients;
  const pendingEquivalentsFromNav = route.params?.pendingEquivalents;
  useEffect(() => {
    servingSizeRef.current = displayValues.servingSize;
  }, [displayValues.servingSize]);

  useEffect(() => {
    if (
      !adjustedFromNav &&
      !adjustedUnitSelectionFromNav &&
      adjustedCustomNutrientsFromNav === undefined
    ) {
      return;
    }

    const previousServingSize = servingSizeRef.current;
    const nextServingSize =
      parseDecimalInput(adjustedFromNav?.servingSize ?? '') ||
      adjustedUnitSelectionFromNav?.variant.serving_size ||
      previousServingSize;

    if (adjustedUnitSelectionFromNav) {
      if (adjustedUnitSelectionFromNav.kind === 'draft') {
        const draftVariant = {
          ...adjustedUnitSelectionFromNav.variant,
          id:
            adjustedUnitSelectionFromNav.variant.id ??
            EXTERNAL_DRAFT_VARIANT_ID,
        };
        setSelectedVariantOverride(draftVariant);
        // selectedUnitSelection prefers selectedVariantOverride for UI/re-entry
        // consistency. For local foods, preserve the real persisted
        // selectedVariantId so save payloads use the real variant_id, not a
        // draft ID that was never written to the database.
        if (!isLocalFood) {
          setSelectedVariantId(draftVariant.id);
        }
      } else {
        const knownVariants = isLocalFood
          ? localUnitVariants
          : externalUnitVariants;
        const isKnownVariant = knownVariants.some(
          (variant) => variant.id === adjustedUnitSelectionFromNav.variant.id
        );
        setSelectedVariantOverride(
          isKnownVariant ? null : adjustedUnitSelectionFromNav.variant
        );
        // For local foods, guard against draft sentinel IDs that were classified
        // as 'existing' by the selectedUnitSelection memo (e.g. FORM_DRAFT_UNIT_ID
        // from AI-converted units, which isn't EXTERNAL_DRAFT_VARIANT_ID so the
        // memo assigns kind:'existing' even though it's never a real DB ID).
        const isDraftSentinel =
          adjustedUnitSelectionFromNav.variant.id ===
            EXTERNAL_DRAFT_VARIANT_ID ||
          adjustedUnitSelectionFromNav.variant.id === FORM_DRAFT_UNIT_ID;
        if (
          adjustedUnitSelectionFromNav.variant.id &&
          !(isLocalFood && isDraftSentinel)
        ) {
          setSelectedVariantId(adjustedUnitSelectionFromNav.variant.id);
        }
      }
    }

    if (adjustedFromNav) {
      setAdjustedValues(adjustedFromNav);
    }

    if (adjustedCustomNutrientsFromNav !== undefined) {
      setAdjustedCustomNutrients(adjustedCustomNutrientsFromNav);
    }

    if (nextServingSize !== previousServingSize) {
      setQuantityText(String(nextServingSize));
    }

    navigation.setParams({
      adjustedValues: undefined,
      adjustedUnitSelection: undefined,
      adjustedCustomNutrients: undefined,
    });
  }, [
    adjustedFromNav,
    adjustedUnitSelectionFromNav,
    adjustedCustomNutrientsFromNav,
    externalUnitVariants,
    isLocalFood,
    localUnitVariants,
    navigation,
  ]);

  useEffect(() => {
    if (!pendingEquivalentsFromNav) return;
    pendingEquivalentsRef.current = pendingEquivalentsFromNav;
    navigation.setParams({ pendingEquivalents: undefined });
  }, [pendingEquivalentsFromNav, navigation]);

  useEffect(() => {
    if (
      isLocalFood &&
      !selectedVariantOverride &&
      localVariantOptions.length > 0
    ) {
      const metricOption = localVariantOptions.find(
        (option) => option.kind === 'metric'
      );
      if (!initialUnitResolvedRef.current) {
        initialUnitResolvedRef.current = true;
        if (metricOption && metricOption.id !== selectedVariantId) {
          setSelectedVariantId(metricOption.id);
          setQuantityText(formatServingSizeDisplay(metricOption.servingSize));
          return;
        }
      }
      if (
        selectedVariantId &&
        !localVariantOptions.some((option) => option.id === selectedVariantId)
      ) {
        // A row folded into grams (a plain "50 g") or no longer listed.
        const target = metricOption ?? localVariantOptions[0];
        const row = variants?.find(
          (variant) => variant.id === selectedVariantId
        );
        const converted = row
          ? convertServingQuantity(
              quantity,
              {
                servingSize: Number(row.serving_size),
                weight: servingWeightOf(row),
              },
              target
            )
          : undefined;
        setSelectedVariantId(target.id);
        setQuantityText(
          formatServingSizeDisplay(converted ?? target.servingSize)
        );
        return;
      }
    }

    if (!selectedVariantId) {
      const firstVariant =
        localVariantOptions[0] ?? externalVariantOptions[0] ?? null;
      if (firstVariant) {
        setSelectedVariantId(firstVariant.id);
        setQuantityText(String(firstVariant.servingSize));
      }
    }
  }, [
    externalVariantOptions,
    isLocalFood,
    localVariantOptions,
    quantity,
    selectedVariantId,
    selectedVariantOverride,
    variants,
  ]);

  const handleVariantChange = useCallback(
    (variantId: string) => {
      setSelectedVariantId(variantId);
      setSelectedVariantOverride(null);
      setAdjustedValues(null);

      const localVariant = localVariantOptions.find(
        (variant) => variant.id === variantId
      );
      if (localVariant) {
        // A portion starts at one portion; grams take the exact weight of
        // what was selected (1 Medium becomes 130 g), never a rounded fraction.
        const from = localVariantOptions.find(
          (option) => option.id === selectedVariantId
        );
        const converted =
          from && localVariant.kind === 'metric'
            ? convertServingQuantity(quantity, from, localVariant)
            : undefined;
        setQuantityText(
          converted !== undefined
            ? formatServingSizeDisplay(Math.round(converted * 10) / 10)
            : String(localVariant.servingSize)
        );
        return;
      }

      const externalVariant = externalVariantOptions.find(
        (variant) => variant.id === variantId
      );
      if (externalVariant) {
        setQuantityText(String(externalVariant.servingSize));
      }
    },
    [externalVariantOptions, localVariantOptions, quantity, selectedVariantId]
  );

  const scaled = (value: number) => value * servings;

  const insets = useSafeAreaInsets();
  const glowing = useGlowTheme();
  const [
    accentColor,
    textPrimary,
    accentText,
    caloriesHighlight,
    proteinHighlight,
    carbsHighlight,
    fatHighlight,
  ] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-primary',
    '--color-accent-text',
    '--color-calories',
    '--color-macro-protein',
    '--color-macro-carbs',
    '--color-macro-fat',
  ]) as string[];
  const highlightColors: Record<string, string> = {
    calories: caloriesHighlight,
    protein: proteinHighlight,
    carbs: carbsHighlight,
    fat: fatHighlight,
  };

  const buildSaveFoodPayload = useCallback(() => {
    return {
      name: adjustedValues?.name || activeItem.name,
      brand: adjustedValues?.brand ?? activeItem.brand ?? null,
      barcode: activeItem.barcode ?? null,
      provider_type: activeItem.provider_type ?? null,
      provider_external_id: activeItem.provider_external_id ?? null,
      provider_verified: activeItem.provider_verified === true,
      is_custom: activeItem.is_custom ?? true,
      serving_size: saveFoodSourceValues.servingSize,
      serving_unit: toPersistedServingUnit({
        serving_size: saveFoodSourceValues.servingSize,
        serving_unit: saveFoodSourceValues.servingUnit,
        serving_description: saveFoodSourceValues.servingDescription,
      }),
      calories: saveFoodSourceValues.calories,
      protein: saveFoodSourceValues.protein,
      carbs: saveFoodSourceValues.carbs,
      fat: saveFoodSourceValues.fat,
      dietary_fiber: saveFoodSourceValues.fiber,
      saturated_fat: saveFoodSourceValues.saturatedFat,
      sodium: saveFoodSourceValues.sodium,
      sugars: saveFoodSourceValues.sugars,
      trans_fat: saveFoodSourceValues.transFat,
      potassium: saveFoodSourceValues.potassium,
      calcium: saveFoodSourceValues.calcium,
      iron: saveFoodSourceValues.iron,
      caffeine_mg: saveFoodSourceValues.caffeineMg,
      water_ml: saveFoodSourceValues.waterMl,
      alcohol_g: saveFoodSourceValues.alcoholG,
      cholesterol: saveFoodSourceValues.cholesterol,
      vitamin_a: saveFoodSourceValues.vitaminA,
      vitamin_c: saveFoodSourceValues.vitaminC,
      // Carry the provider photo through import. The server localizes remote
      // URLs into /uploads after COMMIT; dropping these here is the exact
      // hand-enumerated-payload trap called out in the food-provider-images
      // developer doc.
      images: activeItem.images ?? undefined,
      image_url: activeItem.image_url ?? null,
      image_source_url: activeItem.image_source_url ?? null,
    };
  }, [
    activeItem.barcode,
    activeItem.brand,
    activeItem.is_custom,
    activeItem.name,
    activeItem.provider_external_id,
    activeItem.provider_type,
    activeItem.provider_verified,
    activeItem.images,
    activeItem.image_url,
    activeItem.image_source_url,
    adjustedValues,
    saveFoodSourceValues,
  ]);

  const { saveFoodAsync, isPending: isSavePending } = useSaveFood();

  const buildFoodEntryPayload = (): CreateFoodEntryPayload => {
    const base = {
      meal_type_id: effectiveMealId!,
      quantity,
      unit: displayValues.servingUnit,
      entry_date: selectedDate,
      entry_time: entryTime || null,
      notes: entryNotes.trim() || null,
    };

    switch (activeItem.source) {
      case 'local':
        if (!selectedVariantId)
          throw new Error('Missing variant ID for local food');
        if (adjustedValues) {
          return {
            ...base,
            food_id: activeItem.id,
            variant_id: loggedVariantId,
            food_name: adjustedValues.name || activeItem.name,
            brand_name: adjustedValues.brand ?? activeItem.brand,
            serving_size: displayValues.servingSize,
            serving_unit: displayValues.servingUnit,
            calories: displayValues.calories,
            protein: displayValues.protein,
            carbs: displayValues.carbs,
            fat: displayValues.fat,
            dietary_fiber: displayValues.fiber,
            saturated_fat: displayValues.saturatedFat,
            sodium: displayValues.sodium,
            sugars: displayValues.sugars,
            trans_fat: displayValues.transFat,
            potassium: displayValues.potassium,
            calcium: displayValues.calcium,
            iron: displayValues.iron,
            caffeine_mg: displayValues.caffeineMg,
            water_ml: displayValues.waterMl,
            alcohol_g: displayValues.alcoholG,
            cholesterol: displayValues.cholesterol,
            vitamin_a: displayValues.vitaminA,
            vitamin_c: displayValues.vitaminC,
            ...(selectedCustomNutrients !== undefined
              ? { custom_nutrients: selectedCustomNutrients }
              : {}),
          };
        }
        return {
          ...base,
          food_id: activeItem.id,
          variant_id: loggedVariantId,
          ...servingOverrideFields,
        };
      case 'external':
        return base;
      case 'meal':
        // Meal entries are dispatched via useAddFoodEntryMeal, not addEntry.
        throw new Error('Meal entries must use buildFoodEntryMealPayload');
    }
  };

  const buildFoodEntryMealPayload = (): FoodEntryMealCreateData => {
    if (item.source !== 'meal') {
      throw new Error('buildFoodEntryMealPayload called for non-meal item');
    }
    const mealTypeName = selectedMealType?.name ?? '';
    return {
      meal_template_id: item.id,
      meal_type: mealTypeName,
      meal_type_id: effectiveMealId ?? undefined,
      entry_date: selectedDate,
      entry_time: entryTime || null,
      name: item.name,
      // The note field is shown for meals too, so it has to travel with the
      // meal payload — this builder is used instead of buildFoodEntryPayload
      // when the item is a meal.
      notes: entryNotes.trim() || null,
      quantity,
      unit: displayValues.servingUnit,
    };
  };

  const {
    addEntry,
    addEntryAsync,
    isPending: isAddPending,
    invalidateCache,
  } = useAddFoodEntry({
    onSuccess: async (entry) => {
      if (entry.food_id && pendingEquivalentsRef.current) {
        const equivalents = pendingEquivalentsRef.current;
        pendingEquivalentsRef.current = null;
        try {
          await Promise.all(
            equivalents.map((eq) =>
              createFoodVariant({
                food_id: entry.food_id!,
                serving_size: eq.serving_size,
                serving_unit: eq.serving_unit,
                calories: displayValues.calories,
                protein: displayValues.protein,
                carbs: displayValues.carbs,
                fat: displayValues.fat,
                dietary_fiber: displayValues.fiber,
                saturated_fat: displayValues.saturatedFat,
                sodium: displayValues.sodium,
                sugars: displayValues.sugars,
                trans_fat: displayValues.transFat,
                potassium: displayValues.potassium,
                calcium: displayValues.calcium,
                iron: displayValues.iron,
                caffeine_mg: displayValues.caffeineMg,
                water_ml: displayValues.waterMl,
                alcohol_g: displayValues.alcoholG,
                cholesterol: displayValues.cholesterol,
                vitamin_a: displayValues.vitaminA,
                vitamin_c: displayValues.vitaminC,
              } as CreateFoodVariantPayload)
            )
          );
        } catch {
          Toast.show({
            type: 'error',
            text1: t('foodEntryAdd.errors.equivalentsNotSaved', {
              defaultValue: 'Some equivalent units could not be saved',
            }),
          });
        }
      }
      invalidateCache(selectedDate);
      // Log-entry adds normally return to the diary root. A returnDepth
      // param (set when launched with a food-search basket in progress)
      // pops back that many screens so the basket survives. Read the param
      // directly — the `returnDepth` local above defaults to 1 for the
      // picker-mode flows, and using it here would turn every plain add
      // into a one-screen pop.
      const logEntryReturnDepth = route.params?.returnDepth;
      navigation.dispatch(
        logEntryReturnDepth
          ? StackActions.pop(logEntryReturnDepth)
          : StackActions.popToTop()
      );
    },
  });

  const {
    addMeal,
    isPending: isAddMealPending,
    invalidateCache: invalidateMealCache,
  } = useAddFoodEntryMeal({
    onSuccess: () => {
      invalidateMealCache(selectedDate);
      const mealReturnDepth = route.params?.returnDepth;
      navigation.dispatch(
        mealReturnDepth
          ? StackActions.pop(mealReturnDepth)
          : StackActions.popToTop()
      );
    },
  });

  const buildDraftFromCurrentValues = (
    foodId: string,
    variantId: string,
    foodName: string,
    brand?: string | null
  ): MealIngredientDraft =>
    buildMealIngredientDraft({
      foodId,
      variantId,
      quantity,
      unit: displayValues.servingUnit,
      foodName,
      brand,
      values: displayValues,
    });

  const finishFoodSelection = (ingredient: MealIngredientDraft) => {
    if (isContainerLinkMode) {
      if (ingredient.food_id && ingredient.variant_id) {
        setPendingContainerLinkSelection({
          foodId: ingredient.food_id,
          variantId: ingredient.variant_id,
          foodName: ingredient.food_name ?? '',
          // The quantity picked here is what one press of the container logs,
          // so it has to travel back with the food rather than reset to 1.
          quantity: ingredient.quantity,
        });
      }
      navigation.dispatch(StackActions.pop(returnDepth));
      return;
    }
    if (isMealPlanMode && mealPlanTarget) {
      setPendingMealPlanSelection({
        ...(mealPlanTarget.assignmentIndex === undefined
          ? {}
          : { assignmentIndex: mealPlanTarget.assignmentIndex }),
        assignment: buildMealPlanFoodAssignment(
          ingredient,
          mealPlanTarget,
          quantityText
        ),
      });
    } else {
      setPendingMealIngredientSelection({
        ingredient,
        ingredientIndex,
      });
    }
    navigation.dispatch(StackActions.pop(returnDepth));
  };

  const handleSelectionAdd = async () => {
    if (quantity <= 0) {
      Toast.show({
        type: 'error',
        text1: t('foodEntryAdd.errors.invalidAmount', {
          defaultValue: 'Invalid amount',
        }),
        text2: t('foodEntryAdd.errors.amountGreaterThanZero', {
          defaultValue: 'Amount must be greater than zero.',
        }),
      });
      return;
    }
    if (isMealPlanMode && !mealPlanTarget) {
      Toast.show({
        type: 'error',
        text1: t('foodEntryAdd.errors.failedToAddFood', {
          defaultValue: 'Failed to add food',
        }),
        text2: t('foodEntryAdd.errors.tryAgain', {
          defaultValue: 'Please try again.',
        }),
      });
      return;
    }

    switch (activeItem.source) {
      case 'local': {
        try {
          const variantId = selectedVariantId ?? activeItem.variantId;
          if (!variantId) {
            throw new Error('Missing variant ID for local food');
          }

          finishFoodSelection(
            buildDraftFromCurrentValues(
              activeItem.id,
              variantId,
              adjustedValues?.name || activeItem.name,
              adjustedValues?.brand ?? activeItem.brand
            )
          );
        } catch {
          Toast.show({
            type: 'error',
            text1: t('foodEntryAdd.errors.failedToAddFood', {
              defaultValue: 'Failed to add food',
            }),
            text2: t('foodEntryAdd.errors.tryAgain', {
              defaultValue: 'Please try again.',
            }),
          });
        }
        return;
      }
      case 'external': {
        let savedFood;
        try {
          savedFood = await saveFoodAsync(buildSaveFoodPayload());
        } catch {
          return;
        }

        try {
          if (pendingVariantToPersist) {
            const createdVariant = await createVariant(
              buildCreateFoodVariantPayload(
                savedFood.id,
                pendingVariantToPersist
              )
            );
            const createdVariantValues = mergeVariantDisplayValues(
              createdVariant,
              unitVariantToDisplayValues(pendingVariantToPersist)
            );
            const createdVariantId = toNonEmptyString(createdVariant.id, '');

            if (!createdVariantId) {
              throw new Error('Server did not return a created variant ID');
            }

            await persistExternalVariants(
              savedFood,
              activeItem.externalVariants
            );

            finishFoodSelection(
              buildMealIngredientDraft({
                foodId: savedFood.id,
                variantId: createdVariantId,
                quantity,
                unit: createdVariantValues.servingUnit,
                foodName: adjustedValues?.name || activeItem.name,
                brand: adjustedValues?.brand ?? activeItem.brand,
                values: createdVariantValues,
              })
            );
            return;
          }

          if (!savedFood.default_variant?.id) {
            throw new Error(
              'Server did not return a variant ID for the saved food'
            );
          }

          await persistExternalVariants(savedFood, activeItem.externalVariants);

          finishFoodSelection(
            buildMealIngredientDraft({
              foodId: savedFood.id,
              variantId: savedFood.default_variant.id,
              quantity,
              unit: displayValues.servingUnit,
              foodName: adjustedValues?.name || activeItem.name,
              brand: adjustedValues?.brand ?? activeItem.brand,
              values: displayValues,
            })
          );
        } catch {
          Toast.show({
            type: 'error',
            text1: t('foodEntryAdd.errors.failedToAddFood', {
              defaultValue: 'Failed to add food',
            }),
            text2: t('foodEntryAdd.errors.tryAgain', {
              defaultValue: 'Please try again.',
            }),
          });
        }
        return;
      }
      case 'meal':
        if (isMealPlanMode && mealPlanTarget) {
          setPendingMealPlanSelection({
            ...(mealPlanTarget.assignmentIndex === undefined
              ? {}
              : { assignmentIndex: mealPlanTarget.assignmentIndex }),
            assignment: buildMealPlanMealAssignment(
              {
                ...activeItem,
                name: adjustedValues?.name || activeItem.name,
                servingSize: displayValues.servingSize,
                servingUnit: displayValues.servingUnit,
                calories: displayValues.calories,
                protein: displayValues.protein,
                carbs: displayValues.carbs,
                fat: displayValues.fat,
              },
              mealPlanTarget,
              quantity,
              quantityText
            ),
          });
          navigation.dispatch(StackActions.pop(returnDepth));
          return;
        }
        Toast.show({
          type: 'error',
          text1: t('foodEntryAdd.errors.mealsNotSupported', {
            defaultValue: 'Meals not supported here',
          }),
          text2: t('foodEntryAdd.errors.selectFoodInstead', {
            defaultValue: 'Select a food instead of another meal.',
          }),
        });
        return;
    }
  };

  const handleSaveExternalFood = async () => {
    try {
      const savedFood = await saveFoodAsync(buildSaveFoodPayload());
      const savedFoodInfo = foodItemToFoodInfo(savedFood);
      let nextVariantId = savedFoodInfo.variantId;
      let nextVariantOverride: FoodUnitVariant | null = null;

      if (pendingVariantToPersist) {
        try {
          const createdVariant = await createVariant(
            buildCreateFoodVariantPayload(savedFood.id, pendingVariantToPersist)
          );
          nextVariantId = createdVariant.id;
          nextVariantOverride = createdVariant;
        } catch {
          Toast.show({
            type: 'error',
            text1: t('foodEntryAdd.errors.savedFoodUnitFailed', {
              defaultValue: 'Saved food, but not the new unit',
            }),
            text2: t('foodEntryAdd.errors.savedFoodUnitFailedDetails', {
              defaultValue:
                'You can still add the food, then try saving that unit again.',
            }),
          });
        }
      }

      // Persist all external (Yazio) variants after initial save
      await persistExternalVariants(savedFood, activeItem.externalVariants);

      setSavedFoodOverride(savedFoodInfo);
      setSelectedVariantOverride(nextVariantOverride);
      setSelectedVariantId(nextVariantId);
      setAdjustedValues(null);
      setQuantityText(
        String(nextVariantOverride?.serving_size ?? savedFoodInfo.servingSize)
      );
    } catch {
      return;
    }
  };

  const { data: goals, isLoading: isGoalsLoading } = useQuery({
    queryKey: goalsQueryKey(selectedDate),
    queryFn: () => fetchDailyGoals(selectedDate),
    staleTime: 1000 * 60 * 5,
  });

  const goalPercent = (value: number, goalValue: number | undefined) => {
    if (!goalValue || goalValue === 0) return null;
    return Math.round((value / goalValue) * 100);
  };

  const carbsForGoal =
    showNetCarbs && displayValues.fiber !== undefined
      ? getNetCarbsValue(displayValues.carbs, displayValues.fiber)
      : displayValues.carbs;
  const calorieGoalPct = goalPercent(
    scaled(displayValues.calories),
    goals?.calories
  );
  const proteinGoalPct = goalPercent(
    scaled(displayValues.protein),
    goals?.protein
  );
  const carbsGoalPct = goalPercent(scaled(carbsForGoal), goals?.carbs);
  const fatGoalPct = goalPercent(scaled(displayValues.fat), goals?.fat);

  const nutritionHighlights = [
    {
      key: 'calories',
      value: scaled(displayValues.calories),
      unit: 'kcal',
      label: localizeNutrientKey(t, 'calories'),
      goalPercent: calorieGoalPct,
    },
    {
      key: 'fat',
      value: scaled(displayValues.fat),
      unit: 'g',
      label: localizeNutrientKey(t, 'fat'),
      goalPercent: fatGoalPct,
    },
    {
      key: 'carbs',
      value: scaled(carbsForGoal),
      unit: 'g',
      label: showNetCarbs
        ? t('foodEntryAdd.labels.netCarbsShort', { defaultValue: 'Net carbs' })
        : t('foodEntryAdd.labels.carbsShort', { defaultValue: 'Carbs' }),
      goalPercent: carbsGoalPct,
    },
    {
      key: 'protein',
      value: scaled(displayValues.protein),
      unit: 'g',
      label: localizeNutrientKey(t, 'protein'),
      goalPercent: proteinGoalPct,
    },
  ];

  const mealPickerOptions = mealTypes.map((mealType) => ({
    label: getMealTypeDisplayLabel(mealType, t),
    value: mealType.id,
  }));
  const logDestinationSummary = [
    formatDateLabel(selectedDate, t, i18n.language),
    selectedMealType ? getMealTypeDisplayLabel(selectedMealType, t) : null,
    formatTimeLabel(entryTime, preferences?.time_format),
  ]
    .filter(Boolean)
    .join(' · ');

  const isActionPending =
    isAddPending || isAddMealPending || isSavePending || isCreateVariantPending;
  const [isPhotoCompletionPending, setPhotoCompletionPending] = useState(false);

  const savePhotoCompletion = async () => {
    if (!photoCapture || !effectiveMealId || isPhotoCompletionPending) return;
    if (activeItem.source === 'meal') {
      Toast.show({
        type: 'error',
        text1: t('nutritionPhotos.selectFood', {
          defaultValue: 'Choose a food to complete this photo',
        }),
      });
      return;
    }
    setPhotoCompletionPending(true);
    try {
      const knownCalories = knownSnapshotNumber(displayValues.calories);
      if (knownCalories === undefined) {
        throw new Error(
          t('nutritionPhotos.caloriesRequired', {
            defaultValue:
              'Select a food with known calories or enter them manually.',
          })
        );
      }
      await completeMealPhotoWithFoodLocally({
        captureId: photoCapture.id,
        consumedAt: photoCapture.consumedAt,
        entryDate: photoCapture.entryDate,
        food: {
          meal_type_id: effectiveMealId,
          quantity,
          unit: displayValues.servingUnit,
          ...(activeItem.source === 'local' && loggedVariantId
            ? { food_id: activeItem.id, variant_id: loggedVariantId }
            : {}),
          food_name: adjustedValues?.name?.trim() || activeItem.name,
          ...(activeItem.brand ? { brand_name: activeItem.brand } : {}),
          serving_size: displayValues.servingSize,
          serving_unit: displayValues.servingUnit,
          calories: knownCalories,
          protein: knownSnapshotNumber(displayValues.protein),
          carbs: knownSnapshotNumber(displayValues.carbs),
          fat: knownSnapshotNumber(displayValues.fat),
          dietary_fiber: knownSnapshotNumber(displayValues.fiber),
          saturated_fat: knownSnapshotNumber(displayValues.saturatedFat),
          sodium: knownSnapshotNumber(displayValues.sodium),
          sugars: knownSnapshotNumber(displayValues.sugars),
          trans_fat: knownSnapshotNumber(displayValues.transFat),
          potassium: knownSnapshotNumber(displayValues.potassium),
          calcium: knownSnapshotNumber(displayValues.calcium),
          iron: knownSnapshotNumber(displayValues.iron),
          caffeine_mg: knownSnapshotNumber(displayValues.caffeineMg),
          water_ml: knownSnapshotNumber(displayValues.waterMl),
          alcohol_g: knownSnapshotNumber(displayValues.alcoholG),
          cholesterol: knownSnapshotNumber(displayValues.cholesterol),
          vitamin_a: knownSnapshotNumber(displayValues.vitaminA),
          vitamin_c: knownSnapshotNumber(displayValues.vitaminC),
          ...(selectedCustomNutrients !== undefined
            ? { custom_nutrients: selectedCustomNutrients }
            : {}),
        },
      });
      navigation.dispatch(StackActions.popToTop());
      void reconcileNutritionActions().catch(() => undefined);
    } catch (cause) {
      Toast.show({
        type: 'error',
        text1: t('nutritionPhotos.saveFailed', {
          defaultValue: 'Meal completion could not be saved',
        }),
        text2: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setPhotoCompletionPending(false);
    }
  };

  // Navigate to FoodForm in adjust-nutrition mode. Shared by the inline header
  // edit button (Android) and the native header Edit item (iOS).
  const handleAdjustNutrition = useCallback(() => {
    // Build selectedUnitSelection from displayValues so FoodForm's
    // variant-sync effect uses the current displayed nutrition rather
    // than overwriting initialValues with DB variant defaults.
    // Spread the existing variant's metadata (source, ai_confidence,
    // custom_nutrients, etc.) then override only the nutrition fields
    // with displayValues so FoodForm's variant-sync effect uses the
    // current displayed nutrition, not DB variant defaults.
    const displayVariant: FoodUnitVariant = {
      ...(selectedUnitSelection?.variant ?? {}),
      id: selectedUnitSelection?.variant.id,
      serving_size: displayValues.servingSize,
      serving_unit: displayValues.servingUnit,
      calories: displayValues.calories,
      protein: displayValues.protein,
      carbs: displayValues.carbs,
      fat: displayValues.fat,
      dietary_fiber: displayValues.fiber,
      saturated_fat: displayValues.saturatedFat,
      sodium: displayValues.sodium,
      sugars: displayValues.sugars,
      trans_fat: displayValues.transFat,
      potassium: displayValues.potassium,
      calcium: displayValues.calcium,
      iron: displayValues.iron,
      caffeine_mg: displayValues.caffeineMg,
      water_ml: displayValues.waterMl,
      alcohol_g: displayValues.alcoholG,
      cholesterol: displayValues.cholesterol,
      vitamin_a: displayValues.vitaminA,
      vitamin_c: displayValues.vitaminC,
    };
    const displayUnitSelection: FoodUnitSelectionResult | undefined =
      selectedUnitSelection
        ? { kind: selectedUnitSelection.kind, variant: displayVariant }
        : undefined;
    navigation.navigate('FoodForm', {
      mode: 'adjust-entry-nutrition',
      returnTo: 'FoodEntryAdd',
      returnKey: route.key,
      foodId: isLocalFood ? activeItem.id : undefined,
      variantId: isLocalFood ? loggedVariantId : undefined,
      customNutrients: isLocalFood
        ? (selectedCustomNutrients ?? null)
        : undefined,
      availableUnitVariants: selectorVariants,
      selectedUnitSelection: displayUnitSelection,
      initialValues: {
        name: adjustedValues?.name || activeItem.name,
        brand: adjustedValues?.brand ?? activeItem.brand ?? '',
        servingSize: String(displayValues.servingSize),
        servingUnit: displayValues.servingUnit,
        calories: String(displayValues.calories),
        protein: String(displayValues.protein),
        carbs: String(displayValues.carbs),
        fat: String(displayValues.fat),
        fiber: toFormString(displayValues.fiber),
        saturatedFat: toFormString(displayValues.saturatedFat),
        sodium: toFormString(displayValues.sodium),
        sugars: toFormString(displayValues.sugars),
        transFat: toFormString(displayValues.transFat),
        potassium: toFormString(displayValues.potassium),
        calcium: toFormString(displayValues.calcium),
        iron: toFormString(displayValues.iron),
        caffeineMg: toFormString(displayValues.caffeineMg),
        waterMl: toFormString(displayValues.waterMl),
        alcoholG: toFormString(displayValues.alcoholG),
        cholesterol: toFormString(displayValues.cholesterol),
        vitaminA: toFormString(displayValues.vitaminA),
        vitaminC: toFormString(displayValues.vitaminC),
      },
    });
  }, [
    navigation,
    route.key,
    isLocalFood,
    activeItem.id,
    activeItem.name,
    activeItem.brand,
    loggedVariantId,
    selectedCustomNutrients,
    selectorVariants,
    selectedUnitSelection,
    adjustedValues,
    displayValues,
  ]);

  const showHeaderActions = activeItem.source !== 'meal';
  const showSaveExternalAction = activeItem.source === 'external';

  // Favorites: persisted local foods and saved meals can be starred. External
  // (unsaved) foods must be saved to the library first (via the bookmark
  // action) before they gain a stable id to favorite.
  const isMealItem = activeItem.source === 'meal';
  const canFavorite = isLocalFood || isMealItem;
  const { favoriteFoods, favoriteMeals } = useFavorites({
    enabled: isConnected && canFavorite,
  });
  const isFavorite = useMemo(
    () =>
      isMealItem
        ? favoriteMeals.some((m) => m.id === activeItem.id)
        : favoriteFoods.some((f) => f.id === activeItem.id),
    [isMealItem, favoriteMeals, favoriteFoods, activeItem.id]
  );
  const { toggleFavorite, isPending: isFavoritePending } = useToggleFavorite();
  const handleToggleFavorite = useCallback(() => {
    // originalItem is the source FoodItem/Meal, used for the optimistic insert.
    if (isMealItem) {
      toggleFavorite({
        type: 'meal',
        id: activeItem.id,
        isFavorite,
        meal: activeItem.originalItem as Meal,
      });
    } else {
      toggleFavorite({
        type: 'food',
        id: activeItem.id,
        isFavorite,
        food: activeItem.originalItem as FoodItem,
      });
    }
  }, [
    isMealItem,
    toggleFavorite,
    activeItem.id,
    activeItem.originalItem,
    isFavorite,
  ]);

  const addLabel = photoCapture
    ? t('nutritionPhotos.completeMeal', { defaultValue: 'Complete meal' })
    : activeItem.source === 'meal'
      ? t('foodEntryAdd.actions.addMeal', { defaultValue: 'Add Meal' })
      : isSelectionMode
        ? t('foodEntryAdd.actions.addFood', { defaultValue: 'Add Food' })
        : t('foodEntryAdd.actions.addToDiary', {
            defaultValue: 'Add to Diary',
          });
  const addDisabled =
    isActionPending ||
    isPhotoCompletionPending ||
    (!isSelectionMode && !effectiveMealId) ||
    quantity <= 0;
  const handleAddPress = () => {
    if (addDisabled || !allowAddPress('food-entry-add')) return;
    if (photoCapture) {
      void savePhotoCompletion();
      return;
    }
    if (isSelectionMode) {
      void handleSelectionAdd();
      return;
    }
    if (!effectiveMealId) return;
    if (activeItem.source === 'meal') {
      addMeal(buildFoodEntryMealPayload());
      return;
    }
    if (activeItem.source === 'external' && pendingVariantToPersist) {
      void addEntryAsync({
        saveFoodPayload: buildSaveFoodPayload(),
        saveThenCreateVariantPayload: buildCreateFoodVariantInput(
          pendingVariantToPersist
        ),
        ...(activeItem.externalVariants
          ? { externalVariants: activeItem.externalVariants }
          : {}),
        createEntryPayload: buildFoodEntryPayload(),
      }).catch(() => undefined);
      return;
    }
    const saveFoodPayload =
      activeItem.source === 'external' ? buildSaveFoodPayload() : undefined;
    addEntry({
      saveFoodPayload,
      ...(activeItem.source === 'external'
        ? { externalVariants: activeItem.externalVariants }
        : {}),
      createEntryPayload: buildFoodEntryPayload(),
    });
  };

  const [quickAddingKey, setQuickAddingKey] = useState<string | null>(null);
  const handleQuickAdd = async (row: QuickAddServing) => {
    if (
      quickAddingKey ||
      isActionPending ||
      !effectiveMealId ||
      !allowAddPress(`food-entry-quick-${row.key}`)
    ) {
      return;
    }
    setQuickAddingKey(row.key);
    try {
      const entry = await addEntryAsync({
        createEntryPayload: {
          meal_type_id: effectiveMealId,
          quantity: row.quantity,
          unit: row.option.servingUnit,
          entry_date: selectedDate,
          entry_time: entryTime || null,
          notes: entryNotes.trim() || null,
          food_id: activeItem.id,
          variant_id: row.option.variantId,
          ...(row.option.servingOverride
            ? {
                serving_size: row.option.servingOverride.serving_size,
                serving_unit: row.option.servingOverride.serving_unit,
              }
            : {}),
        },
      });
      Toast.show({
        type: 'success',
        text1: t('foodEntryAdd.quickAdd.added', {
          defaultValue: 'Added {{portion}}',
          portion: row.title,
        }),
        text2: t('foodEntryAdd.quickAdd.tapToUndo', {
          defaultValue: 'Tap to undo',
        }),
        props: {
          onPress: () => {
            Toast.hide();
            void deleteFoodEntry(entry.id)
              .then(() => {
                invalidateCache(entry.entry_date);
                Toast.show({
                  type: 'info',
                  text1: t('foodEntryAdd.quickAdd.undone', {
                    defaultValue: 'Entry removed',
                  }),
                });
              })
              .catch(() =>
                Toast.show({
                  type: 'error',
                  text1: t('foodEntryAdd.quickAdd.undoFailed', {
                    defaultValue: 'Could not remove the entry',
                  }),
                })
              );
          },
        },
      });
    } catch {
      // useAddFoodEntry already explains the failure.
    } finally {
      setQuickAddingKey(null);
    }
  };
  const [moreOptionsExpanded, setMoreOptionsExpanded] = useState(false);
  // Drives the pinned hero: it shrinks and fades as the cards cover it.
  const scrollY = useRef(new Animated.Value(0)).current;

  // Outlined inputs of the reference: accent hairline over the card surface.
  const outlinedFieldStyle = {
    minHeight: AMOUNT_WHEEL_HEIGHT,
    borderColor: withAlpha(accentColor, 0.7),
    backgroundColor: withAlpha(accentColor, 0.05),
  };

  // A food you own opens Edit Food (name, photo, serving sizes, nutrition);
  // other foods keep the per-entry adjustment.
  const { profile } = useProfile();
  const canEditFood =
    isLocalFood &&
    isConnected &&
    !isSelectionMode &&
    !photoCapture &&
    !!loggedVariantId &&
    !!activeItem.userId &&
    profile?.id === activeItem.userId;
  // The food's own nutrition serving is listed as a unit, not a saved portion.
  const nutritionBasisId = findNutritionBasis(variants)?.id;
  const hasSavedPortions = localVariantOptions.some(
    (option) =>
      option.kind === 'portion' && option.variantId !== nutritionBasisId
  );
  const handleEditFood = () => {
    if (!loggedVariantId) return;
    // Open the stored row, never a derived grams view of it.
    const row = variants?.find((variant) => variant.id === loggedVariantId);
    navigation.navigate(
      'FoodForm',
      buildEditFoodParams({
        food: activeItem,
        values: row
          ? unitVariantToDisplayValues(localVariantToUnitVariant(row))
          : selectedBaseVariant,
        variantId: loggedVariantId,
        customNutrients: row?.custom_nutrients ?? null,
        returnKey: route.key,
      })
    );
  };

  // The food name lives in the summary card; keep the navigation bar quiet.
  const header = useScreenHeader({
    nativeTitle: '',
    left: {
      kind: 'dismiss',
      onPress: () => navigation.goBack(),
      disabled: isActionPending,
      identifier: 'food-entry-add-cancel',
    },
    // The star renders for any favoritable item (incl. meals, which suppress the
    // edit/save actions); edit + save only render when showHeaderActions is true.
    right:
      canFavorite || showHeaderActions
        ? [
            ...(canFavorite
              ? [
                  {
                    kind: 'icon',
                    sfSymbol: isFavorite ? 'star.fill' : 'star',
                    ionicon: isFavorite ? 'star' : 'star-outline',
                    // Accent-tinted (role:'primary') so the star reads as a
                    // tappable button rather than a neutral glyph.
                    role: 'primary',
                    // Also gated on the toggle's own mutation: onMutate flips the
                    // cache optimistically, so a second tap before the first
                    // settles sends the OPPOSITE operation. Two in-flight writes
                    // can then land out of order and leave the server in the
                    // state opposite the user's last tap.
                    // Also disabled offline: the favorites query is gated on
                    // isConnected, so a tap offline would fire a guaranteed-fail
                    // request and surface an error toast.
                    disabled:
                      isActionPending || isFavoritePending || !isConnected,
                    onPress: handleToggleFavorite,
                    accessibilityLabel: isFavorite
                      ? t('foodEntryAdd.actions.removeFavorite', {
                          defaultValue: 'Remove from favorites',
                        })
                      : t('foodEntryAdd.actions.addFavorite', {
                          defaultValue: 'Add to favorites',
                        }),
                    identifier: 'food-entry-add-favorite',
                  } as const,
                ]
              : []),
            ...(showHeaderActions
              ? [
                  {
                    kind: 'icon',
                    sfSymbol: 'pencil',
                    ionicon: 'create-outline',
                    role: 'secondary',
                    disabled: isActionPending,
                    onPress: canEditFood
                      ? handleEditFood
                      : handleAdjustNutrition,
                    accessibilityLabel: canEditFood
                      ? t('foodEntryAdd.actions.editFood', {
                          defaultValue: 'Edit food and serving sizes',
                        })
                      : t('foodEntryAdd.actions.adjustNutrition', {
                          defaultValue: 'Adjust nutrition',
                        }),
                    identifier: 'food-entry-add-edit',
                  } as const,
                  ...(showSaveExternalAction
                    ? [
                        {
                          kind: 'icon',
                          sfSymbol: 'bookmark',
                          ionicon: 'bookmark-outline',
                          role: 'secondary',
                          busy: isSavePending || isCreateVariantPending,
                          disabled: isActionPending,
                          onPress: () => void handleSaveExternalFood(),
                          accessibilityLabel: t(
                            'foodEntryAdd.actions.saveFood',
                            { defaultValue: 'Save Food' }
                          ),
                          identifier: 'food-entry-add-save',
                        } as const,
                      ]
                    : []),
                ]
              : []),
          ]
        : null,
  });

  return (
    <View
      className="flex-1 bg-background"
      style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}
    >
      {header}

      <View className="flex-1">
        <Animated.View
          pointerEvents="none"
          className="absolute left-0 right-0 top-0"
          style={{
            height: 260,
            opacity: scrollY.interpolate({
              inputRange: [0, 260],
              outputRange: [1, 0.25],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                translateY: scrollY.interpolate({
                  inputRange: [-120, 0, 260],
                  outputRange: [0, 0, -52],
                  extrapolate: 'clamp',
                }),
              },
              {
                scale: scrollY.interpolate({
                  inputRange: [-120, 0, 260],
                  outputRange: [1.25, 1, 0.86],
                  extrapolate: 'clamp',
                }),
              },
            ],
          }}
        >
          {foodImagePath ? (
            <View
              className="overflow-hidden bg-surface"
              accessibilityLabel={t('foodEntryAdd.labels.foodPhoto', {
                defaultValue: 'Photo of {{name}}',
                name: activeItem.name,
              })}
            >
              <SafeImage
                source={foodImageSource}
                style={{ width: '100%', height: 260 }}
                contentFit="cover"
                fallback={
                  <View
                    testID="food-entry-fallback-artwork"
                    className="h-full items-center justify-center bg-surface"
                  >
                    <Image
                      source={fallbackArtwork}
                      style={{ width: 160, height: 160 }}
                      contentFit="contain"
                    />
                  </View>
                }
              />
            </View>
          ) : (
            // No photo: the food group's artwork fills the hero, display-only
            // (never saved as the food's image), as in the reference layout.
            <View
              testID="food-entry-category-hero"
              className="items-center justify-center overflow-hidden"
              style={{
                height: 260,
                experimental_backgroundImage: `radial-gradient(circle at 50% 45%, ${withAlpha(accentColor, 0.18)} 0%, #00000000 70%)`,
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Image
                source={fallbackArtwork}
                style={{ width: 190, height: 190 }}
                contentFit="contain"
              />
            </View>
          )}
        </Animated.View>
        <KeyboardAwareScrollView
          mode="layout"
          ref={noteVisibility.scrollRef}
          onScroll={(event) => {
            scrollY.setValue(event.nativeEvent.contentOffset.y);
            noteVisibility.onScroll(event);
          }}
          onScrollBeginDrag={noteVisibility.onScrollBeginDrag}
          scrollEventThrottle={16}
          onContentSizeChange={noteVisibility.onContentSizeChange}
          className="flex-1"
          contentContainerClassName=""
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 12) + 96,
          }}
          keyboardShouldPersistTaps="handled"
          bottomOffset={96}
        >
          {/* The hero stays pinned behind the cards; this spacer lets the
            first card start over its lower edge. */}
          <View style={{ height: 224 }} pointerEvents="none" />

          <View
            className="mx-4 rounded-2xl border bg-surface px-4 py-5 gap-5"
            style={[
              {
                borderColor: withAlpha(accentColor, 0.45),
                boxShadow: `0px 0px ${glowing ? 30 : 18}px 0px ${withAlpha(
                  accentColor,
                  glowing ? 0.35 : 0.2
                )}`,
              },
              glowing
                ? {
                    experimental_backgroundImage:
                      'linear-gradient(180deg, #ffffff0d 0%, #ffffff00 40%)',
                  }
                : null,
            ]}
          >
            <View>
              <View className="flex-row items-start gap-2">
                <Text className="flex-1 text-xl font-bold text-text-primary">
                  {adjustedValues?.name || activeItem.name}
                </Text>
                {activeItem.provider_verified ? (
                  <VerifiedBadge size="md" />
                ) : null}
              </View>
              {displayBrand ? (
                <Text className="mt-1 text-sm text-text-secondary">
                  {displayBrand}
                </Text>
              ) : null}
            </View>

            {/* Energy and macros for the chosen amount, as in the reference:
              value over label, separated by hairlines, in the app's macro
              colours with the share of today's goal. */}
            <View className="flex-row" testID="food-entry-highlights">
              {nutritionHighlights.map((nutrient, index) => {
                const amount = formatLocalizedNumber(nutrient.value, {
                  maximumFractionDigits: nutrient.key === 'calories' ? 0 : 1,
                });
                const percent =
                  nutrient.goalPercent != null && !isGoalsLoading
                    ? formatLocalizedNumber(nutrient.goalPercent, {
                        maximumFractionDigits: 0,
                      })
                    : null;
                return (
                  <View
                    key={nutrient.key}
                    testID={`food-entry-highlight-${nutrient.key}`}
                    accessible
                    accessibilityLabel={
                      percent === null
                        ? t('foodEntryAdd.labels.nutrientAmountA11y', {
                            defaultValue: '{{label}}: {{amount}} {{unit}}',
                            label: nutrient.label,
                            amount,
                            unit: nutrient.unit,
                          })
                        : t('foodEntryAdd.labels.nutrientGoalA11y', {
                            defaultValue:
                              '{{label}}: {{amount}} {{unit}}, {{percent}}% of your daily goal',
                            label: nutrient.label,
                            amount,
                            unit: nutrient.unit,
                            percent,
                          })
                    }
                    className={`min-w-0 flex-1 items-center py-1 ${
                      index > 0 ? 'border-l border-border-subtle' : ''
                    }`}
                  >
                    <Text
                      className="text-xl font-bold"
                      style={{ color: highlightColors[nutrient.key] }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {nutrient.key === 'calories'
                        ? amount
                        : `${amount} ${nutrient.unit}`}
                    </Text>
                    <Text
                      className="text-sm text-text-secondary"
                      testID={`food-entry-highlight-${nutrient.key}-label`}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {nutrient.key === 'calories'
                        ? nutrient.unit
                        : nutrient.label}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs text-text-muted"
                      testID={`food-entry-highlight-${nutrient.key}-caption`}
                      numberOfLines={1}
                    >
                      {percent === null
                        ? t('foodEntryAdd.labels.goalNotSet', {
                            defaultValue: 'No goal',
                          })
                        : `${percent}%`}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View>
              <View className="mb-2 flex-row items-end justify-between gap-3">
                <Text className="text-sm text-text-secondary">
                  {t('foodEntryAdd.servings.title', {
                    defaultValue: 'Serving size',
                  })}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {t('foodEntryAdd.servings.amountPerServing', {
                    defaultValue: 'Amount per serving',
                  })}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <AmountWheel
                  value={quantity}
                  onChange={(next) =>
                    setQuantityText(formatServingSizeDisplay(next))
                  }
                  metric={
                    selectedServingOption
                      ? selectedServingOption.kind === 'metric'
                      : isMetricInputUnit(displayValues.servingUnit)
                  }
                  unitLabel={quantityUnitLabel}
                  disabled={isActionPending}
                />
                <UnitDropdown
                  testID="food-entry-unit-picker"
                  value={selectedVariantId ?? variantPickerOptions[0]?.id ?? ''}
                  label={quantityUnitLabel}
                  options={variantPickerOptions.map((variant) => ({
                    label: variant.label,
                    value: variant.id ?? '',
                  }))}
                  onSelect={handleVariantChange}
                  busy={isCreateVariantPending}
                  disabled={isCreateVariantPending}
                  accessibilityLabel={t('foodEntryAdd.actions.changeUnit', {
                    defaultValue: 'Change unit: {{unit}}',
                    unit: quantityUnitLabel,
                  })}
                  className="min-w-0 flex-1 flex-row items-center justify-between rounded-xl border px-4"
                  style={outlinedFieldStyle}
                />
              </View>
              {selectedServingOption ? (
                selectedServingOption.kind === 'portion' &&
                selectedServingOption.weight &&
                quantity > 0 ? (
                  <Text
                    className="mt-2 text-sm text-text-secondary"
                    testID="food-entry-amount-weight"
                  >
                    {t('foodEntryAdd.servings.totalWeight', {
                      defaultValue: '{{weight}} in total',
                      weight: formatLocalizedUnitQuantity(
                        (quantity / selectedServingOption.servingSize) *
                          selectedServingOption.weight.metric_amount,
                        selectedServingOption.weight.metric_unit,
                        t
                      ),
                    })}
                  </Text>
                ) : null
              ) : (
                <View className="flex-row flex-wrap items-center mt-2">
                  <Text className="text-text-secondary text-sm">
                    {formatLocalizedNumber(servings, {
                      maximumFractionDigits: 1,
                    })}{' '}
                    {t('foodEntryAdd.labels.serving', {
                      defaultValue: 'servings',
                      defaultValue_one: 'serving',
                      defaultValue_other: 'servings',
                      count: servings,
                    })}
                  </Text>
                  {/* Suppress the redundant "X serving per serving" suffix when the
                unit is already 'serving' \u2014 that would just say e.g.
                "1 serving \u00b7 1 serving per serving". Keep it for ml/g/etc.
                where "X ml per serving" is meaningful info. */}
                  {displayValues.servingUnit !== 'serving' &&
                    !displayValues.servingDescription
                      ?.toLowerCase()
                      .includes('serving') && (
                      <Text className="text-text-secondary text-sm">
                        {' · '}
                        {perServingLabel}{' '}
                        {t('foodEntryAdd.labels.perServing', {
                          defaultValue: 'per serving',
                        })}
                      </Text>
                    )}
                  {/* Serving-unit meals: surface the meal's yield count as a
                substitute for the suppressed "per serving" suffix above.
                Singular meals (total_servings <= 1) don't need this \u2014 there's
                no yield context to convey. */}
                  {displayValues.servingUnit === 'serving' &&
                    item.source === 'meal' &&
                    (item.mealTotalServings ?? 1) > 1 && (
                      <Text className="text-text-secondary text-sm">
                        {' \u00b7 '}
                        {t('foodEntryAdd.labels.mealMakes', {
                          defaultValue:
                            'meal makes {{formattedCount}} servings',
                          defaultValue_one:
                            'meal makes {{formattedCount}} serving',
                          defaultValue_other:
                            'meal makes {{formattedCount}} servings',
                          count: item.mealTotalServings ?? 1,
                          formattedCount: formatLocalizedNumber(
                            item.mealTotalServings ?? 1,
                            { maximumFractionDigits: 1 }
                          ),
                        })}
                      </Text>
                    )}
                </View>
              )}
              {(
                isLocalFood && localVariantOptions.length > 0
                  ? !localVariantOptions.some(
                      (option) => option.kind === 'metric'
                    )
                  : !gramVariantId && displayValues.servingUnit === 'serving'
              ) ? (
                <Text className="mt-2 text-sm text-text-secondary">
                  {t('foodEntryAdd.labels.unknownGramSize', {
                    defaultValue:
                      'A gram weight was not provided for this serving.',
                  })}
                </Text>
              ) : null}
            </View>

            {!isLocalFood && variantPickerOptions.length > 1 ? (
              <View className="border-t border-border-subtle pt-4">
                <Text className="mb-2 text-lg font-semibold text-text-primary">
                  {t('foodEntryAdd.labels.quickPortions', {
                    defaultValue: 'Available portions',
                  })}
                </Text>
                {variantPickerOptions.map((variant, index) => {
                  const selected =
                    variant.id ===
                    (selectedVariantId ?? variantPickerOptions[0]?.id);
                  return (
                    <TouchableOpacity
                      key={variant.id ?? `${variant.label}-${index}`}
                      onPress={() => handleVariantChange(variant.id ?? '')}
                      disabled={isActionPending || !variant.id}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected,
                        disabled: isActionPending || !variant.id,
                      }}
                      accessibilityLabel={t(
                        'foodEntryAdd.actions.choosePortion',
                        {
                          defaultValue: 'Choose {{portion}}',
                          portion: variant.label,
                        }
                      )}
                      accessibilityHint={t(
                        'foodEntryAdd.actions.choosePortionHint',
                        {
                          defaultValue:
                            'Selects the portion. Use Add Food to log it.',
                        }
                      )}
                      className="min-h-16 flex-row items-center gap-3 border-t border-border-subtle py-4"
                    >
                      <View className="flex-1">
                        <Text className="text-lg font-semibold text-text-primary">
                          {variant.perServingLabel}
                        </Text>
                        <Text className="text-sm text-text-secondary">
                          {t('foodEntryAdd.labels.quickPortionNutrition', {
                            defaultValue:
                              '{{calories}} kcal · {{fat}} g fat · {{carbs}} g carbs · {{protein}} g protein',
                            calories: formatLocalizedNumber(variant.calories, {
                              maximumFractionDigits: 0,
                            }),
                            fat: formatLocalizedNumber(variant.fat, {
                              maximumFractionDigits: 1,
                            }),
                            carbs: formatLocalizedNumber(variant.carbs, {
                              maximumFractionDigits: 1,
                            }),
                            protein: formatLocalizedNumber(variant.protein, {
                              maximumFractionDigits: 1,
                            }),
                          })}
                        </Text>
                      </View>
                      <Icon
                        name={
                          selected
                            ? 'checkmark-circle-filled'
                            : 'chevron-forward'
                        }
                        size={24}
                        color={accentColor}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <Button
              variant="primary"
              testID="food-entry-add-button"
              onPress={handleAddPress}
              disabled={addDisabled}
              loading={isActionPending || isPhotoCompletionPending}
              accessibilityLabel={addLabel}
              className="min-h-14"
              style={
                glowing && !addDisabled
                  ? {
                      boxShadow: `0px 0px 16px 0px ${withAlpha(accentColor, 0.45)}`,
                    }
                  : undefined
              }
            >
              <View className="flex-row items-center justify-center gap-2">
                <Icon name="add" size={20} color={accentText} />
                <Text
                  className="text-base font-semibold text-accent-text"
                  numberOfLines={1}
                >
                  {addLabel}
                </Text>
              </View>
            </Button>

            {!isSelectionMode && !photoCapture ? (
              <View className="gap-3">
                <TouchableOpacity
                  testID="food-entry-log-destination"
                  onPress={() => setLogDetailsExpanded((expanded) => !expanded)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: logDetailsExpanded }}
                  accessibilityLabel={t(
                    'foodEntryAdd.actions.editLogDestination',
                    { defaultValue: 'Edit log destination' }
                  )}
                  accessibilityHint={logDestinationSummary}
                  className="min-h-14 flex-row items-center gap-3 rounded-xl border border-border-subtle bg-raised px-4"
                >
                  <Icon name="calendar" size={22} color={accentColor} />
                  <Text
                    className="min-w-0 flex-1 text-sm font-medium text-text-primary"
                    numberOfLines={2}
                  >
                    {logDestinationSummary}
                  </Text>
                  <Icon
                    name={
                      logDetailsExpanded ? 'chevron-down' : 'chevron-forward'
                    }
                    size={16}
                    color={textPrimary}
                  />
                </TouchableOpacity>
                {logDetailsExpanded ? (
                  <View className="gap-3 border-t border-border-subtle pt-3">
                    <View className="flex-row flex-wrap items-center">
                      <DateSelectRow
                        date={selectedDate}
                        onPress={() => calendarRef.current?.present()}
                      />

                      {selectedDate === getTodayDate() ? (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          className="flex-row items-center ml-2"
                          onPress={() =>
                            setSelectedDate(addDays(getTodayDate(), -1))
                          }
                        >
                          <Text className="text-text-link text-sm font-medium mx-1.5">
                            {t('foodEntryAdd.actions.useYesterday', {
                              defaultValue: 'Use Yesterday',
                            })}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          className="flex-row items-center ml-2"
                          onPress={() => setSelectedDate(getTodayDate())}
                        >
                          <Text className="text-text-link text-sm font-medium mx-1.5">
                            {t('foodEntryAdd.actions.useToday', {
                              defaultValue: 'Use Today',
                            })}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View className="flex-row flex-wrap items-center">
                      <TouchableOpacity
                        onPress={() => timeSheetRef.current?.present()}
                        activeOpacity={0.7}
                        className="flex-row items-center"
                      >
                        <Text className="text-text-secondary text-base">
                          {t('foodEntryAdd.labels.time', {
                            defaultValue: 'Time',
                          })}
                        </Text>
                        <Text className="text-text-primary text-base font-medium mx-1.5">
                          {formatTimeLabel(
                            entryTime,
                            preferences?.time_format
                          ) ??
                            t('foodEntryAdd.labels.none', {
                              defaultValue: 'None',
                            })}
                        </Text>
                        <Icon
                          name="chevron-down"
                          size={12}
                          color={textPrimary}
                          weight="medium"
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        className="flex-row items-center ml-2"
                        onPress={handleSetEntryTimeNow}
                      >
                        <Text className="text-text-link text-sm font-medium mx-1.5">
                          {t('foodEntryAdd.actions.now', {
                            defaultValue: 'Now',
                          })}
                        </Text>
                      </TouchableOpacity>

                      {entryTime !== '' && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          className="flex-row items-center"
                          onPress={() => handleSelectEntryTime('')}
                        >
                          <Text className="text-text-link text-sm font-medium mx-1.5">
                            {t('foodEntryAdd.actions.clear', {
                              defaultValue: 'Clear',
                            })}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {selectedMealType ? (
                      <View className="flex-row flex-wrap items-center">
                        <Text className="text-text-secondary text-base">
                          {t('foodEntryAdd.labels.meal', {
                            defaultValue: 'Meal',
                          })}
                        </Text>
                        <BottomSheetPicker
                          value={effectiveMealId!}
                          options={mealPickerOptions}
                          onSelect={setSelectedMealId}
                          title={t('foodEntryAdd.pickers.selectMeal', {
                            defaultValue: 'Select Meal',
                          })}
                          renderTrigger={({ onPress }) => (
                            <TouchableOpacity
                              onPress={onPress}
                              activeOpacity={0.7}
                              className="flex-row items-center"
                            >
                              <Text className="text-text-primary text-base font-medium mx-1.5">
                                {getMealTypeDisplayLabel(selectedMealType, t)}
                              </Text>
                              <Icon
                                name="chevron-down"
                                size={12}
                                color={textPrimary}
                                weight="medium"
                              />
                            </TouchableOpacity>
                          )}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {quickAddServings.length > 0 || (canEditFood && !hasSavedPortions) ? (
            <View
              className="mx-4 mt-4 rounded-2xl border bg-surface p-4"
              style={{ borderColor: withAlpha(accentColor, 0.35) }}
              testID="food-entry-quick-add"
            >
              <View className="mb-3 flex-row items-center gap-2">
                <Icon name="bolt" size={20} color={accentColor} />
                <Text className="flex-1 text-lg font-semibold text-text-primary">
                  {t('foodEntryAdd.quickAdd.title', {
                    defaultValue: 'Quick Add',
                  })}
                </Text>
                <Text className="text-xs font-medium uppercase tracking-widest text-text-secondary">
                  {t('foodEntryAdd.quickAdd.subtitle', {
                    defaultValue: 'Saved portions',
                  })}
                </Text>
              </View>
              <View className="overflow-hidden rounded-xl border border-border-subtle bg-raised">
                {quickAddServings.map((row, index) => {
                  const kcal = formatLocalizedNumber(row.calories, {
                    maximumFractionDigits: 0,
                  });
                  const busy = quickAddingKey === row.key;
                  const disabled =
                    isActionPending || !!quickAddingKey || !effectiveMealId;
                  return (
                    <View
                      key={row.key}
                      testID={`food-entry-quick-add-${row.key}`}
                      className={`min-h-16 flex-row items-center gap-3 px-4 py-3 ${
                        index > 0 ? 'border-t border-border-subtle' : ''
                      }`}
                    >
                      <View className="min-w-0 flex-1">
                        {row.kind === 'last' ? (
                          <Text className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                            {t('foodEntryAdd.quickAdd.lastUsed', {
                              defaultValue: 'Last used',
                            })}
                          </Text>
                        ) : null}
                        <Text
                          className="text-base font-medium text-text-primary"
                          numberOfLines={2}
                        >
                          {row.title}
                        </Text>
                        <Text className="text-sm text-text-secondary">
                          {t('foodEntryAdd.quickAdd.nutrition', {
                            defaultValue:
                              '{{calories}} kcal – {{fat}} g F, {{carbs}} g C, {{protein}} g P',
                            calories: kcal,
                            fat: formatLocalizedNumber(row.fat, {
                              maximumFractionDigits: 0,
                            }),
                            carbs: formatLocalizedNumber(row.carbs, {
                              maximumFractionDigits: 0,
                            }),
                            protein: formatLocalizedNumber(row.protein, {
                              maximumFractionDigits: 0,
                            }),
                          })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        testID={`food-entry-quick-add-button-${row.key}`}
                        onPress={() => void handleQuickAdd(row)}
                        disabled={disabled}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ disabled, busy }}
                        accessibilityLabel={
                          row.kind === 'last'
                            ? t('foodEntryAdd.quickAdd.addLastA11y', {
                                defaultValue:
                                  'Add last used, {{portion}}, {{calories}} kilocalories',
                                portion: row.title,
                                calories: kcal,
                              })
                            : t('foodEntryAdd.quickAdd.addA11y', {
                                defaultValue:
                                  'Add {{portion}}, {{calories}} kilocalories',
                                portion: row.title,
                                calories: kcal,
                              })
                        }
                        // Smaller circle; the hit area stays 44 pt.
                        hitSlop={5}
                        className="h-[34px] w-[34px] items-center justify-center rounded-full border"
                        style={{
                          borderColor: accentColor,
                          backgroundColor: withAlpha(accentColor, 0.12),
                          opacity: disabled && !busy ? 0.5 : 1,
                        }}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color={accentColor} />
                        ) : (
                          <Icon name="add" size={18} color={accentColor} />
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {canEditFood && !hasSavedPortions ? (
                  <TouchableOpacity
                    testID="food-entry-edit-servings"
                    onPress={handleEditFood}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    className={`min-h-16 flex-row items-center gap-3 px-4 py-3 ${
                      quickAddServings.length > 0
                        ? 'border-t border-border-subtle'
                        : ''
                    }`}
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="text-base font-medium text-text-primary">
                        {t('foodEntryAdd.editServings.title', {
                          defaultValue: 'Add serving sizes',
                        })}
                      </Text>
                      <Text className="text-sm text-text-secondary">
                        {t('foodEntryAdd.editServings.subtitle', {
                          defaultValue:
                            'Save portions like “1 slice” to log them with one tap.',
                        })}
                      </Text>
                    </View>
                    <Icon
                      name="chevron-forward"
                      size={18}
                      color={accentColor}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          <View
            className="mx-4 mt-4 rounded-2xl border bg-surface px-4"
            style={{ borderColor: withAlpha(accentColor, 0.35) }}
          >
            <TouchableOpacity
              testID="food-entry-more-options"
              onPress={() => setMoreOptionsExpanded((expanded) => !expanded)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ expanded: moreOptionsExpanded }}
              className="min-h-20 flex-row items-center gap-3"
            >
              <View className="h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-raised">
                <Icon
                  name="ellipsis-horizontal"
                  size={20}
                  color={textPrimary}
                />
              </View>
              <Text
                className="flex-1 text-base font-medium text-text-primary"
                numberOfLines={1}
              >
                {t('foodEntryAdd.moreOptions.title', {
                  defaultValue: 'More options',
                })}
              </Text>
              <Text
                className="max-w-[40%] text-right text-[10px] font-medium uppercase tracking-widest text-text-secondary"
                numberOfLines={2}
              >
                {t('foodEntryAdd.moreOptions.subtitle', {
                  defaultValue: 'Nutrition facts & more',
                })}
              </Text>
              <Icon
                name={moreOptionsExpanded ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={textPrimary}
              />
            </TouchableOpacity>
            {moreOptionsExpanded ? (
              <View className="gap-4 border-t border-border-subtle pb-4 pt-4">
                {canEditFood ? (
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onPress={handleEditFood}
                      className="min-h-11 flex-1 rounded-xl"
                      accessibilityLabel={t(
                        'foodEntryAdd.moreOptions.editFood',
                        {
                          defaultValue: 'Edit food',
                        }
                      )}
                    >
                      {t('foodEntryAdd.moreOptions.editFood', {
                        defaultValue: 'Edit food',
                      })}
                    </Button>
                    <Button
                      variant="secondary"
                      onPress={handleAdjustNutrition}
                      className="min-h-11 flex-1 rounded-xl"
                      accessibilityLabel={t(
                        'foodEntryAdd.moreOptions.adjustEntry',
                        { defaultValue: 'Adjust this entry only' }
                      )}
                    >
                      {t('foodEntryAdd.moreOptions.adjustEntry', {
                        defaultValue: 'Adjust this entry only',
                      })}
                    </Button>
                  </View>
                ) : null}
                <FoodNutrientBreakdown
                  values={displayValues}
                  servings={servings}
                  showNetCarbs={showNetCarbs}
                  customNutrients={selectedCustomNutrients}
                />
              </View>
            ) : null}
          </View>

          {/* Keep the entry note close to the logging controls so it is easier to
            reach and keep visible while the keyboard is open. */}
          {!isSelectionMode ? (
            <>
              {activeItem.notes ? (
                <View className="mx-4 mt-5">
                  <Text className="text-xs font-semibold uppercase text-text-muted mb-1">
                    {t('foodEntryAdd.labels.aboutThisFood', {
                      defaultValue: 'About this food',
                    })}
                  </Text>
                  <View className="rounded-lg border border-border-subtle bg-raised px-3 py-2">
                    <NoteMarkdown
                      text={activeItem.notes}
                      fontSize={14}
                      images={usableFoodImages(activeItem.images)}
                    />
                  </View>
                </View>
              ) : null}

              <View
                ref={noteVisibility.noteRef}
                onLayout={noteVisibility.onNoteLayout}
                className="mx-4 mt-5"
              >
                <MarkdownNotesField
                  showFormattingControls={false}
                  maxInputHeight={144}
                  onFocus={noteVisibility.onFocus}
                  onBlur={noteVisibility.onBlur}
                  images={usableFoodImages(activeItem.images)}
                  value={entryNotes}
                  onCommit={(text) => {
                    setEntryNotes(text);
                    noteVisibility.onDraftChange();
                  }}
                  label={t('foodEntryAdd.labels.entryNotes', {
                    defaultValue: 'Note for this entry',
                  })}
                  placeholder={t('foodEntryAdd.labels.entryNotesPlaceholder', {
                    defaultValue:
                      'Anything specific about this time you ate it',
                  })}
                />
              </View>
            </>
          ) : null}
        </KeyboardAwareScrollView>
      </View>

      {/* The card owns the action at rest; the keyboard gets a reachable copy. */}
      {keyboardVisible ? (
        <KeyboardStickyView
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        >
          <View
            ref={noteVisibility.obstructionRef}
            collapsable={false}
            onLayout={noteVisibility.onNoteLayout}
            className="bg-background"
          >
            <FooterSaveBar
              label={addLabel}
              busy={isActionPending || isPhotoCompletionPending}
              disabled={addDisabled}
              onPress={handleAddPress}
            />
          </View>
        </KeyboardStickyView>
      ) : null}

      <CalendarSheet
        ref={calendarRef}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
      <TimeSheet
        ref={timeSheetRef}
        value={entryTime}
        onSelectTime={handleSelectEntryTime}
      />
    </View>
  );
};

// Native-stack modal screens may not receive keyboard events from the root
// provider. Keep the scroll view and floating Save bar in the modal's window.
const FoodEntryAddScreen: React.FC<FoodEntryAddScreenProps> = (props) => (
  <KeyboardProvider>
    <FoodEntryAddScreenContent {...props} />
  </KeyboardProvider>
);

export default FoodEntryAddScreen;
