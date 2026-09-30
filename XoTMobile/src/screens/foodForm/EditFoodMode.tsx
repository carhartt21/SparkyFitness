import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  isMetricInputUnit,
  type MetricUnit,
  type SaveFoodServingsBody,
} from '@workspace/shared';
import FoodForm, { type FoodFormData } from '../../components/FoodForm';
import FoodImagePicker from '../../components/FoodImagePicker';
import ServingSizesEditor from '../../components/foodForm/ServingSizesEditor';
import i18n from '../../localization/i18n';
import { usableFoodImages } from '../../utils/foodImages';
import { foodFallbackImage } from '../../utils/foodFallbackImages';
import {
  pickerImagesDiffer,
  splitPickerImages,
  toSavedImages,
  type PickerImage,
} from '../../utils/pickerImages';
import { useFoodVariants } from '../../hooks/useFoodVariants';
import { parseOptional } from '../../types/foodInfo';
import {
  saveFoodServings,
  updateFoodVariant,
  updateFood,
  updateFoodEntriesSnapshot,
  type UpdateFoodPayload,
} from '../../services/api/foodsApi';
import { ApiError } from '../../services/api/errors';
import type { FoodFormScreenProps } from '../FoodFormScreen';
import type { FoodInfoItem } from '../../types/foodInfo';
import {
  formatServingSizeDisplay,
  localVariantToUnitVariant,
} from '../../utils/foodDetails';
import { parseDecimalInput } from '../../utils/numericInput';
import { findNutritionBasis } from '../../utils/servingOptions';
import {
  buildSaveServingsBody,
  draftDerives,
  draftsDiffer,
  draftsFromVariants,
  validateServingDrafts,
  type ServingBasis,
  type ServingDraft,
} from '../../utils/servingDrafts';
import {
  useScreenHeader,
  SAVE_LABEL,
  SAVING_LABEL,
} from '../../hooks/useScreenHeader';
import {
  FOOD_VARIANT_FIELDS,
  buildFormValuesFromVariant,
  confirmSyncPastEntries,
  hasFoodFormChanges,
  invalidateFoodCaches,
  validateFoodForm,
} from './persistence';

type EditFoodParams = Extract<
  FoodFormScreenProps['route']['params'],
  { mode: 'edit-food' }
>;

function buildUpdatedFoodInfo(
  item: FoodInfoItem,
  data: FoodFormData,
  variantId: string
): FoodInfoItem {
  return {
    ...item,
    name: data.name,
    brand: data.brand || null,
    servingSize: parseDecimalInput(data.servingSize) || item.servingSize,
    servingUnit: data.servingUnit || item.servingUnit,
    calories: parseDecimalInput(data.calories) || 0,
    protein: parseDecimalInput(data.protein) || 0,
    carbs: parseDecimalInput(data.carbs) || 0,
    fat: parseDecimalInput(data.fat) || 0,
    fiber: parseOptional(data.fiber),
    saturatedFat: parseOptional(data.saturatedFat),
    sodium: parseOptional(data.sodium),
    sugars: parseOptional(data.sugars),
    transFat: parseOptional(data.transFat),
    potassium: parseOptional(data.potassium),
    calcium: parseOptional(data.calcium),
    iron: parseOptional(data.iron),
    cholesterol: parseOptional(data.cholesterol),
    vitaminA: parseOptional(data.vitaminA),
    vitaminC: parseOptional(data.vitaminC),
    caffeineMg: parseOptional(data.caffeineMg),
    waterMl: parseOptional(data.waterMl),
    alcoholG: parseOptional(data.alcoholG),
    variantId,
  };
}

function formNutrition(data: Partial<FoodFormData>) {
  return {
    calories: parseDecimalInput(data.calories ?? '') || 0,
    protein: parseDecimalInput(data.protein ?? '') || 0,
    carbs: parseDecimalInput(data.carbs ?? '') || 0,
    fat: parseDecimalInput(data.fat ?? '') || 0,
    dietary_fiber: parseOptional(data.fiber ?? ''),
    saturated_fat: parseOptional(data.saturatedFat ?? ''),
    sodium: parseOptional(data.sodium ?? ''),
    sugars: parseOptional(data.sugars ?? ''),
    trans_fat: parseOptional(data.transFat ?? ''),
    potassium: parseOptional(data.potassium ?? ''),
    calcium: parseOptional(data.calcium ?? ''),
    iron: parseOptional(data.iron ?? ''),
    cholesterol: parseOptional(data.cholesterol ?? ''),
    vitamin_a: parseOptional(data.vitaminA ?? ''),
    vitamin_c: parseOptional(data.vitaminC ?? ''),
    caffeine_mg: parseOptional(data.caffeineMg ?? ''),
    water_ml: parseOptional(data.waterMl ?? ''),
    alcohol_g: parseOptional(data.alcoholG ?? ''),
  };
}

function confirmDialog(
  title: string,
  message: string,
  confirmLabel: string
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: i18n.t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: confirmLabel,
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ],
      { onDismiss: () => resolve(false) }
    );
  });
}

function confirmDiscardServings(): Promise<boolean> {
  return confirmDialog(
    i18n.t('foodForm.servings.discardTitle', {
      defaultValue: 'Discard serving size changes?',
    }),
    i18n.t('foodForm.servings.discardMessage', {
      defaultValue: 'Your changes to the serving sizes are not saved.',
    }),
    i18n.t('foodFormPersistence.discard', { defaultValue: 'Discard' })
  );
}

function templateAssignmentsIn(error: ApiError): number {
  try {
    const body = JSON.parse(error.body ?? '{}') as {
      template_assignments?: number;
    };
    return Number(body.template_assignments ?? 0);
  } catch {
    return 0;
  }
}

export function EditFoodMode({
  params,
  navigation,
}: {
  params: EditFoodParams;
  navigation: FoodFormScreenProps['navigation'];
}) {
  const { item, initialValues, returnKey, foodId, variantId, customNutrients } =
    params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickerImages, setPickerImages] = useState<PickerImage[]>(() =>
    toSavedImages(item?.images)
  );

  // Only already-saved photos can be embedded in a note: a staged file exists
  // solely on the device until the food is saved, so it has no path to link to.
  const savedNoteImages = useMemo(
    () =>
      usableFoodImages(
        pickerImages
          .filter((image) => image.kind === 'saved')
          .map((image) => image.path)
      ),
    [pickerImages]
  );
  const imagesChanged = pickerImagesDiffer(pickerImages, item?.images);
  const { variants } = useFoodVariants(foodId, { enabled: true });

  // The form edits the food's nutrition basis. It is usually the row the
  // screen was opened with; when a portion was open, switch to the basis once
  // the variants are known so its values are what the user edits.
  const basis = useMemo(() => findNutritionBasis(variants), [variants]);
  const basisId = basis?.id ?? variantId;
  const formInitialValues = useMemo<Partial<FoodFormData>>(
    () =>
      basis && basis.id !== variantId
        ? {
            ...initialValues,
            ...buildFormValuesFromVariant(localVariantToUnitVariant(basis)),
          }
        : initialValues,
    [basis, initialValues, variantId]
  );
  const initialCustomNutrients =
    basis && basis.id !== variantId
      ? (basis.custom_nutrients ?? null)
      : customNutrients;
  const [currentCustomNutrients, setCurrentCustomNutrients] = useState<
    Record<string, string | number> | null | undefined
  >(customNutrients);
  const [liveForm, setLiveForm] =
    useState<Partial<FoodFormData>>(formInitialValues);

  // Saved portions, seeded during render whenever the stored list changes.
  const [drafts, setDrafts] = useState<ServingDraft[]>([]);
  const [baseline, setBaseline] = useState<ServingDraft[]>([]);
  const [basisWeightText, setBasisWeightText] = useState('');
  const [savedBasisWeightText, setSavedBasisWeightText] = useState('');
  const [basisWeightUnit, setBasisWeightUnit] = useState<MetricUnit>('g');
  const [showErrors, setShowErrors] = useState(false);
  const seedKey = variants
    ? variants
        .map(
          (v) =>
            `${v.id}:${v.serving_size}:${v.serving_unit}:${v.serving_label ?? ''}:${v.metric_amount ?? ''}:${v.sort_order ?? 0}:${v.calories}`
        )
        .join(',')
    : null;
  const [seededKey, setSeededKey] = useState<string | null>(null);
  if (seedKey !== null && seededKey !== seedKey) {
    setSeededKey(seedKey);
    const seeded = draftsFromVariants(variants, basis?.id);
    setDrafts(seeded);
    setBaseline(seeded);
    const weight =
      basis && !isMetricInputUnit(basis.serving_unit) && basis.metric_amount
        ? formatServingSizeDisplay(Number(basis.metric_amount))
        : '';
    setBasisWeightText(weight);
    setSavedBasisWeightText(weight);
    setBasisWeightUnit(basis?.metric_unit === 'ml' ? 'ml' : 'g');
    if (basis && basis.id !== variantId) {
      setCurrentCustomNutrients(initialCustomNutrients);
      setLiveForm(formInitialValues);
    }
  }

  const servingBasis = useMemo<ServingBasis | null>(() => {
    const size = parseDecimalInput(liveForm.servingSize ?? '');
    const unit = liveForm.servingUnit?.trim();
    if (!(size > 0) || !unit) return null;
    const statedWeight = parseDecimalInput(basisWeightText);
    const weighed = !isMetricInputUnit(unit) && statedWeight > 0;
    return {
      serving_size: size,
      serving_unit: unit,
      metric_amount: weighed ? statedWeight : null,
      metric_unit: weighed ? basisWeightUnit : null,
      ...formNutrition(liveForm),
      custom_nutrients: currentCustomNutrients ?? basis?.custom_nutrients,
    };
  }, [
    liveForm,
    basisWeightText,
    basisWeightUnit,
    currentCustomNutrients,
    basis?.custom_nutrients,
  ]);

  const errors = useMemo(
    () => validateServingDrafts(drafts, servingBasis),
    [drafts, servingBasis]
  );
  const basisWeightChanged =
    basisWeightText.trim() !== savedBasisWeightText.trim() &&
    parseDecimalInput(basisWeightText) !==
      parseDecimalInput(savedBasisWeightText);
  const hasServingChanges =
    draftsDiffer(drafts, baseline) || basisWeightChanged;

  const isSavingRef = useRef(false);
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (isSavingRef.current || !hasServingChanges) return;
      e.preventDefault();
      void confirmDiscardServings().then((ok) => {
        if (ok) navigation.dispatch(e.data.action);
      });
    });
    return unsub;
  }, [navigation, hasServingChanges]);

  /** Saves the portions; false when the user keeps a portion plans still use. */
  const saveServings = useCallback(
    async (body: SaveFoodServingsBody): Promise<boolean> => {
      try {
        await saveFoodServings(foodId, body);
        return true;
      } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 409) {
          throw error;
        }
        const confirmed = await confirmDialog(
          t('foodForm.servings.inUseTitle', {
            defaultValue: 'Remove from meal plans?',
          }),
          t('foodForm.servings.inUseMessage', {
            defaultValue:
              'Meal plan templates use a serving you removed ({{entries}} entries). Removing it also removes those entries. Your diary is not affected.',
            entries: templateAssignmentsIn(error),
          }),
          t('foodForm.servings.inUseConfirm', { defaultValue: 'Remove' })
        );
        if (!confirmed) return false;
        await saveFoodServings(foodId, { ...body, confirm_cascade: true });
        return true;
      }
    },
    [foodId, t]
  );

  const handleSubmit = async (data: FoodFormData) => {
    if (!validateFoodForm(data)) return;
    if (!variants || !basis) {
      // Without the stored rows the portions and the basis cannot be told apart.
      Toast.show({
        type: 'error',
        text1: t('foodForm.loadingDetails', {
          defaultValue: 'Still loading food details. Try again in a moment.',
        }),
      });
      return;
    }
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      Toast.show({
        type: 'error',
        text1: t('foodForm.servings.errors.fixRows', {
          defaultValue: 'Check the highlighted servings.',
        }),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const foodPayload: UpdateFoodPayload = {};
      if (data.name !== initialValues.name) foodPayload.name = data.name;
      if (data.brand !== initialValues.brand)
        foodPayload.brand = data.brand || '';
      // Key presence is the update signal, so only set `notes` when it really
      // changed; an unchanged save must leave the stored note untouched.
      if ((data.notes ?? '') !== (initialValues.notes ?? ''))
        foodPayload.notes = (data.notes ?? '').trim() || null;
      // Only send images when they actually changed: the server treats a
      // supplied `images` array as authoritative and deletes anything omitted.
      const imageArgs = imagesChanged
        ? splitPickerImages(pickerImages)
        : undefined;
      if (Object.keys(foodPayload).length > 0 || imagesChanged) {
        await updateFood(foodId, foodPayload, imageArgs);
      }

      const basisChanged =
        hasFoodFormChanges(
          buildFormValuesFromVariant(localVariantToUnitVariant(basis)),
          data,
          FOOD_VARIANT_FIELDS
        ) || currentCustomNutrients !== initialCustomNutrients;
      if (basisChanged) {
        await updateFoodVariant(basis.id, {
          food_id: foodId,
          serving_size: parseDecimalInput(data.servingSize) || 0,
          serving_unit: data.servingUnit || 'serving',
          ...formNutrition(data),
          polyunsaturated_fat: basis.polyunsaturated_fat,
          monounsaturated_fat: basis.monounsaturated_fat,
          glycemic_index: basis.glycemic_index,
          custom_nutrients:
            currentCustomNutrients ?? basis.custom_nutrients ?? undefined,
        });
      }

      // Portions derived from the basis follow its new values.
      if (hasServingChanges || (basisChanged && drafts.some(draftDerives))) {
        const saved = await saveServings(
          buildSaveServingsBody({
            drafts,
            baseline,
            basis: servingBasis,
            basisWeightText,
            basisWeightUnit,
            basisWeightChanged,
          })
        );
        if (!saved) {
          invalidateFoodCaches(queryClient, foodId);
          return;
        }
      }
      invalidateFoodCaches(queryClient, foodId);
      setBaseline(drafts);
      setSavedBasisWeightText(basisWeightText);

      Toast.show({
        type: 'success',
        text1: t('foodForm.saved', { defaultValue: 'Saved' }),
      });

      // Past diary entries keep the nutrition snapshot they were logged with.
      // Ask before rewriting that history.
      const syncChoice = await confirmSyncPastEntries(imagesChanged);
      if (syncChoice !== 'none') {
        try {
          await updateFoodEntriesSnapshot(
            foodId,
            undefined,
            syncChoice === 'nutrition-and-photos'
          );
          invalidateFoodCaches(queryClient, foodId);
          Toast.show({
            type: 'success',
            text1: t('foodForm.pastEntriesUpdated', {
              defaultValue: 'Past entries updated',
            }),
          });
        } catch {
          // The food itself saved fine; only the optional sync failed.
          Toast.show({
            type: 'error',
            text1: t('foodForm.pastEntriesFailed', {
              defaultValue: 'Could not update past entries',
            }),
            text2: t('foodForm.foodSaved', {
              defaultValue: 'Your food was saved.',
            }),
          });
        }
      }

      const keptIds = new Set(drafts.map((draft) => draft.id));
      isSavingRef.current = true;
      navigation.dispatch({
        ...CommonActions.setParams({
          updatedItem: buildUpdatedFoodInfo(item, data, basis.id),
          // Keep the serving the user had open unless it was removed.
          updatedSelectedVariantId:
            variantId === basis.id || keptIds.has(variantId)
              ? variantId
              : basis.id,
        }),
        source: returnKey,
      });
      navigation.goBack();
    } catch {
      Toast.show({
        type: 'error',
        text1: t('foodForm.updateFailed', {
          defaultValue: 'Could not update food',
        }),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRequestRef = useRef<(() => void) | null>(null);

  const header = useScreenHeader({
    title: t('foodForm.editTitle', { defaultValue: 'Edit Food' }),
    left: {
      kind: 'text',
      label: t('common.cancel', { defaultValue: 'Cancel' }),
      onPress: () => navigation.goBack(),
      disabled: isSubmitting,
      identifier: 'food-edit-cancel',
    },
    right: {
      kind: 'primary',
      label: SAVE_LABEL,
      busyLabel: SAVING_LABEL,
      busy: isSubmitting,
      disabled: isSubmitting,
      pill: true,
      onPress: () => submitRequestRef.current?.(),
      identifier: 'food-edit-save',
    },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}
    >
      {header}

      <FoodForm
        key={basisId}
        onSubmit={(data) => {
          void handleSubmit(data);
        }}
        submitRequestRef={submitRequestRef}
        initialValues={formInitialValues}
        submitLabel={SAVE_LABEL}
        showNotes
        noteImages={savedNoteImages}
        isSubmitting={isSubmitting}
        // Save lives in the header on both header paths (reference layout).
        hideSubmitButton
        onFormChange={setLiveForm}
        identityAside={
          <FoodImagePicker
            variant="cover"
            coverPlaceholder={foodFallbackImage(item?.name)}
            items={pickerImages}
            onItemsChange={setPickerImages}
            disabled={isSubmitting}
          />
        }
        servingsSection={
          <ServingSizesEditor
            basis={servingBasis}
            drafts={drafts}
            onChange={setDrafts}
            storedVariants={variants}
            basisWeightText={basisWeightText}
            basisWeightUnit={basisWeightUnit}
            onBasisWeightChange={setBasisWeightText}
            errors={showErrors ? errors : {}}
            disabled={isSubmitting || !variants}
          />
        }
        customNutrients={currentCustomNutrients}
        onCustomNutrientsChange={setCurrentCustomNutrients}
      />
    </View>
  );
}
