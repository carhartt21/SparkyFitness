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
import { useQuery } from '@tanstack/react-query';
import Icon from '../components/Icon';
import StepperInput from '../components/StepperInput';
import MarkdownNotesField from '../components/MarkdownNotesField';
import { useKeepNoteVisible } from '../hooks/useKeepNoteVisible';
import { NoteMarkdown } from '../components/NoteMarkdown';
import SafeImage from '../components/SafeImage';
import VerifiedBadge from '../components/VerifiedBadge';
import { useFoodImageSourceContext } from '../components/FoodImageSourceProvider';
import { externalFoodImage, usableFoodImages } from '../utils/foodImages';
import BottomSheetPicker from '../components/BottomSheetPicker';
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
import { CreateFoodEntryPayload } from '../services/api/foodEntriesApi';
import {
  addDays,
  formatDateLabel,
  getTodayDate,
  getDeviceTimezone,
} from '../utils/dateUtils';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import { prefillEntryTime, userHourMinute } from '@workspace/shared';
import TimeSheet, { type TimeSheetRef } from '../components/TimeSheet';
import { formatTimeLabel } from '../utils/entryTimeDisplay';
import { getMealTypeDisplayLabel } from '../utils/mealNutrition';
import { goalsQueryKey } from '../hooks/queryKeys';
import {
  useFavorites,
  useMealTypes,
  usePreferences,
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
  buildLocalVariantOptions,
  convertEquivalentVariantQuantity,
  foodInfoToUnitVariant,
  formatQuantityUnitLabel,
  formatServingSizeDisplay,
  formatVariantLabel,
  formatVariantServingLabel,
  resolveFoodDisplayValues,
  resolveLocalPickerVariantId,
  toPersistedServingUnit,
  unitVariantToDisplayValues,
  type FoodDisplayValues,
  nextQuantity,
} from '../utils/foodDetails';
import { buildMealIngredientDraft } from '../utils/mealBuilderDraft';
import { persistExternalVariants } from '../utils/persistExternalVariants';
import { DECIMAL_INPUT_REGEX, parseDecimalInput } from '../utils/numericInput';
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

  const localVariantOptions = useMemo(
    () => buildLocalVariantOptions(variants),
    [variants]
  );
  const localUnitVariants = useMemo(
    () => buildLocalUnitVariants(variants),
    [variants]
  );
  const resolvedLocalPickerVariantId = useMemo(
    () =>
      isLocalFood && !selectedVariantOverride
        ? resolveLocalPickerVariantId(variants, selectedVariantId)
        : undefined,
    [isLocalFood, selectedVariantId, selectedVariantOverride, variants]
  );
  const externalVariantOptions = useMemo(
    () => buildExternalVariantOptions(activeItem.externalVariants),
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
    const effectiveId =
      isLocalFood && !selectedVariantOverride
        ? (resolvedLocalPickerVariantId ?? selectedVariantId)
        : selectedVariantId;
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
    resolvedLocalPickerVariantId,
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

  const quantityUnitLabel =
    variantPickerOptions.find((option) => option.id === selectedVariantId)
      ?.quantityUnitLabel ?? formatQuantityUnitLabel(displayValues);
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
      resolvedLocalPickerVariantId &&
      resolvedLocalPickerVariantId !== selectedVariantId
    ) {
      const selectedVariant = selectorVariants.find(
        (variant) => variant.id === selectedVariantId
      );
      const resolvedVariant = localVariantOptions.find(
        (variant) => variant.id === resolvedLocalPickerVariantId
      );
      const convertedQuantity = convertEquivalentVariantQuantity(
        quantity,
        selectedVariant?.serving_size,
        resolvedVariant?.servingSize
      );
      setSelectedVariantId(resolvedLocalPickerVariantId);
      if (convertedQuantity !== undefined) {
        setQuantityText(formatServingSizeDisplay(convertedQuantity));
      }
      return;
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
    localVariantOptions,
    quantity,
    resolvedLocalPickerVariantId,
    selectedVariantId,
    selectorVariants,
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
        setQuantityText(String(localVariant.servingSize));
        return;
      }

      const externalVariant = externalVariantOptions.find(
        (variant) => variant.id === variantId
      );
      if (externalVariant) {
        setQuantityText(String(externalVariant.servingSize));
      }
    },
    [externalVariantOptions, localVariantOptions]
  );

  const updateQuantityText = (text: string) => {
    if (DECIMAL_INPUT_REGEX.test(text)) {
      setQuantityText(text);
    }
  };

  const clampQuantity = () => {
    if (quantity <= 0) {
      const minQuantity = displayValues.servingSize * 0.5 || 1;
      setQuantityText(String(minQuantity));
    }
  };

  const adjustQuantity = (delta: number) => {
    setQuantityText(
      String(nextQuantity(quantity, delta, displayValues.servingSize))
    );
  };

  const scaled = (value: number) => value * servings;

  const insets = useSafeAreaInsets();
  const [accentColor, textPrimary] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-primary',
  ]) as [string, string];

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
            variant_id: selectedVariantId,
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
          variant_id: selectedVariantId,
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
      label: localizeNutrientKey(t, showNetCarbs ? 'netCarbs' : 'carbs'),
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
          ...(activeItem.source === 'local' && selectedVariantId
            ? { food_id: activeItem.id, variant_id: selectedVariantId }
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
      variantId: isLocalFood ? selectedVariantId : undefined,
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
    selectedVariantId,
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
      : t('foodEntryAdd.actions.addFood', { defaultValue: 'Add Food' });
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
                    onPress: handleAdjustNutrition,
                    accessibilityLabel: t(
                      'foodEntryAdd.actions.adjustNutrition',
                      { defaultValue: 'Adjust nutrition' }
                    ),
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

      <KeyboardAwareScrollView
        mode="layout"
        ref={noteVisibility.scrollRef}
        onContentSizeChange={noteVisibility.onContentSizeChange}
        className="flex-1"
        contentContainerClassName={foodImagePath ? '' : 'pt-4'}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 12) + 96,
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={96}
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
              style={{ width: '100%', height: 284 }}
              contentFit="cover"
              fallback={
                <View className="h-full items-center justify-center bg-surface">
                  <Icon name="food" size={40} color={textPrimary} />
                </View>
              }
            />
          </View>
        ) : null}

        <View
          className="mx-4 rounded-2xl bg-raised px-5 py-6 gap-6"
          style={foodImagePath ? { marginTop: -32 } : undefined}
        >
          <View>
            <View className="flex-row items-start gap-2">
              <Text className="flex-1 text-3xl font-bold text-text-primary">
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
            <Text className="mt-1 text-sm text-text-secondary">
              {t('foodEntryAdd.labels.nutritionForAmount', {
                defaultValue: 'Nutrition for selected amount',
              })}
            </Text>
          </View>

          <View className="flex-row justify-between gap-2 border-y border-border-subtle py-4">
            {nutritionHighlights.map((nutrient) => (
              <View
                key={nutrient.key}
                className="min-w-0 flex-1 items-center gap-1"
              >
                <Text
                  className="text-center text-xl font-bold text-text-primary"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatLocalizedNumber(nutrient.value, {
                    maximumFractionDigits: nutrient.key === 'calories' ? 0 : 1,
                  })}{' '}
                  <Text className="text-xs font-medium">{nutrient.unit}</Text>
                </Text>
                <Text
                  className="text-center text-sm text-text-secondary"
                  numberOfLines={2}
                >
                  {nutrient.label}
                </Text>
                {nutrient.goalPercent != null && !isGoalsLoading ? (
                  <Text className="mt-1 text-center text-xs text-text-secondary">
                    {t('foodEntryAdd.labels.ofGoal', {
                      defaultValue: '{{percent}}% of goal',
                      percent: nutrient.goalPercent,
                    })}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          <View>
            <Text className="mb-2 text-sm font-semibold text-text-primary">
              {t('foodEntryAdd.labels.amount', { defaultValue: 'Amount' })}
            </Text>
            <View className="flex-row items-center gap-3">
              <StepperInput
                value={quantityText}
                onChangeText={updateQuantityText}
                onBlur={clampQuantity}
                onDecrement={() => adjustQuantity(-1)}
                onIncrement={() => adjustQuantity(1)}
                accessibilityLabels={{
                  decrement: t('foodEntryAdd.actions.decreaseAmount', {
                    defaultValue: 'Decrease amount',
                  }),
                  input: t('foodEntryAdd.labels.amount', {
                    defaultValue: 'Amount',
                  }),
                  increment: t('foodEntryAdd.actions.increaseAmount', {
                    defaultValue: 'Increase amount',
                  }),
                }}
              />
              {variantPickerOptions.length > 1 ? (
                <BottomSheetPicker
                  value={selectedVariantId ?? variantPickerOptions[0]?.id ?? ''}
                  options={variantPickerOptions.map((variant) => ({
                    label: variant.label,
                    value: variant.id ?? '',
                  }))}
                  onSelect={handleVariantChange}
                  title={t('foodEntryAdd.pickers.selectServing', {
                    defaultValue: 'Select Serving',
                  })}
                  renderTrigger={({ onPress }) => (
                    <TouchableOpacity
                      onPress={onPress}
                      activeOpacity={0.7}
                      disabled={isCreateVariantPending}
                      accessibilityRole="button"
                      accessibilityLabel={t('foodEntryAdd.actions.changeUnit', {
                        defaultValue: 'Change unit: {{unit}}',
                        unit: quantityUnitLabel,
                      })}
                      className="min-h-12 min-w-0 flex-1 flex-row items-center justify-between rounded-xl border border-border-subtle bg-surface px-4"
                    >
                      <Text
                        className="min-w-0 flex-1 text-base font-medium text-text-primary"
                        numberOfLines={1}
                      >
                        {quantityUnitLabel}
                      </Text>
                      {isCreateVariantPending ? (
                        <ActivityIndicator size="small" color={accentColor} />
                      ) : (
                        <Icon
                          name="chevron-down"
                          size={16}
                          color={textPrimary}
                          weight="medium"
                        />
                      )}
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <View className="min-h-12 min-w-0 flex-1 justify-center rounded-xl border border-border-subtle bg-surface px-4">
                  <Text
                    className="text-base font-medium text-text-primary"
                    numberOfLines={1}
                  >
                    {quantityUnitLabel}
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-row flex-wrap items-center mt-2">
              <Text className="text-text-secondary text-sm">
                {formatLocalizedNumber(servings, { maximumFractionDigits: 1 })}{' '}
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
                      defaultValue: 'meal makes {{formattedCount}} servings',
                      defaultValue_one: 'meal makes {{formattedCount}} serving',
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
          </View>

          <Button
            variant="primary"
            onPress={handleAddPress}
            disabled={addDisabled}
            loading={isActionPending || isPhotoCompletionPending}
            accessibilityLabel={addLabel}
            className="min-h-14 rounded-2xl"
            textClassName="text-base text-center"
          >
            {addLabel}
          </Button>

          {!isSelectionMode && !photoCapture ? (
            <View className="gap-3 border-t border-border-subtle pt-4">
              <TouchableOpacity
                onPress={() => setLogDetailsExpanded((expanded) => !expanded)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: logDetailsExpanded }}
                accessibilityLabel={t(
                  'foodEntryAdd.actions.editLogDestination',
                  { defaultValue: 'Edit log destination' }
                )}
                accessibilityHint={logDestinationSummary}
                className="min-h-14 flex-row items-center gap-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                  <Icon name="calendar" size={18} color={accentColor} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-text-secondary">
                    {t('foodEntryAdd.labels.logTo', { defaultValue: 'Log to' })}
                  </Text>
                  <Text
                    className="mt-0.5 text-base font-medium text-text-primary"
                    numberOfLines={2}
                  >
                    {logDestinationSummary}
                  </Text>
                </View>
                <Icon
                  name={logDetailsExpanded ? 'chevron-up' : 'chevron-down'}
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
                        {formatTimeLabel(entryTime, preferences?.time_format) ??
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
                        {t('foodEntryAdd.actions.now', { defaultValue: 'Now' })}
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

        {variantPickerOptions.length > 1 ? (
          <View className="mx-4 mt-6 rounded-2xl bg-surface px-5 py-5">
            <Text className="mb-2 text-xl font-semibold text-text-primary">
              {t('foodEntryAdd.labels.quickPortions', {
                defaultValue: 'Choose a portion',
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
                  accessibilityLabel={t('foodEntryAdd.actions.choosePortion', {
                    defaultValue: 'Choose {{portion}}',
                    portion: variant.label,
                  })}
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
                      selected ? 'checkmark-circle-filled' : 'chevron-forward'
                    }
                    size={24}
                    color={accentColor}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

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
                  defaultValue: 'Anything specific about this time you ate it',
                })}
              />
            </View>
          </>
        ) : null}

        <View className="mx-4 mt-5">
          <FoodNutrientBreakdown
            values={displayValues}
            servings={servings}
            showNetCarbs={showNetCarbs}
            customNutrients={selectedCustomNutrients}
          />
        </View>
      </KeyboardAwareScrollView>

      {/* The card owns the action at rest; the keyboard gets a reachable copy. */}
      {keyboardVisible ? (
        <KeyboardStickyView
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        >
          <View className="bg-background">
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
