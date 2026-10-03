import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import BottomSheetPicker from '../components/BottomSheetPicker';
import {
  useMedicationDetail,
  useCreateMedication,
  useUpdateMedication,
} from '../hooks/useMedications';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import FormInput from '../components/FormInput';
import Icon from '../components/Icon';
import Switch from '../components/ui/Switch';
import type { RootStackScreenProps } from '../types/navigation';
import {
  medicationKindLabel,
  medicationTypeLabel,
} from '../utils/medicationLocalization';
import { MEDICATION_TYPES } from '../types/medications';
import { SUPPLEMENT_FORMS } from '@workspace/shared';
import { useQueryClient } from '@tanstack/react-query';
import CollapsibleSection from '../components/CollapsibleSection';
import { useCustomNutrients } from '../hooks/useCustomNutrients';
import { invalidateNutritionCaches } from '../hooks/invalidateNutritionCaches';
import { ensureCatalogNutrients } from '../services/api/customNutrientsApi';
import type { UserCustomNutrient } from '../services/api/customNutrientsApi';
import {
  SUPPLEMENT_FIXED_FIELDS,
  SUPPLEMENT_NATIVE_FIELDS,
  supplementDefinition,
  supplementNutritionDraft,
  parseSupplementNutritionDraft,
  applySupplementNutritionDraft,
} from '../utils/supplementNutrition';

type MedicationFormScreenProps = RootStackScreenProps<'MedicationForm'>;

interface FormState {
  name: string;
  typeId: string;
  strengthValue: string;
  strengthUnit: string;
  doseAmount: string;
  doseUnit: string;
  reason: string;
  prescriber: string;
  pharmacy: string;
  notes: string;
  isActive: boolean;
  isSupplement: boolean;
  nutrients: Record<string, string>;
}

const EMPTY_FORM: FormState = {
  name: '',
  typeId: 'pill',
  strengthValue: '',
  strengthUnit: 'mg',
  doseAmount: '',
  doseUnit: 'tablet',
  reason: '',
  prescriber: '',
  pharmacy: '',
  notes: '',
  isActive: true,
  isSupplement: false,
  nutrients: {},
};

const hasDetailsContent = (form: FormState): boolean =>
  Boolean(form.reason || form.prescriber || form.pharmacy || form.notes);

function baseFromMed(
  existingMed:
    NonNullable<ReturnType<typeof useMedicationDetail>['data']> | undefined,
  definitions: readonly UserCustomNutrient[]
): FormState {
  if (!existingMed) return EMPTY_FORM;
  return {
    name: existingMed.name,
    typeId: existingMed.type_id ?? EMPTY_FORM.typeId,
    strengthValue:
      existingMed.strength_value != null
        ? String(existingMed.strength_value)
        : '',
    strengthUnit: existingMed.strength_unit ?? 'mg',
    doseAmount:
      existingMed.dose_amount != null ? String(existingMed.dose_amount) : '',
    doseUnit: existingMed.dose_unit ?? 'tablet',
    reason: existingMed.reason_text ?? '',
    prescriber: existingMed.prescriber ?? '',
    pharmacy: existingMed.pharmacy ?? '',
    notes: existingMed.notes ?? '',
    isActive: existingMed.is_active,
    isSupplement: existingMed.is_supplement === true,
    nutrients: supplementNutritionDraft(existingMed.nutrients, definitions),
  };
}

const MedicationFormScreen: React.FC<MedicationFormScreenProps> = ({
  route,
  navigation,
}) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const {
    customNutrients,
    isLoading: nutrientsLoading,
    isError: nutrientsError,
  } = useCustomNutrients();
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [showAdditionalNutrients, setShowAdditionalNutrients] = useState(false);
  const allNutrients = [
    ...SUPPLEMENT_FIXED_FIELDS,
    ...SUPPLEMENT_NATIVE_FIELDS,
  ];
  const commonKeys = new Set([
    'calories',
    'protein',
    'carbs',
    'fat',
    'dietary_fiber',
    'sodium',
    'potassium',
    'vitamin_c',
    'calcium',
    'iron',
    'caffeine_mg',
    'water_ml',
    'alcohol_g',
    'catalog:magnesium',
  ]);
  const commonNutrients = allNutrients.filter((field) =>
    commonKeys.has(field.key)
  );
  const additionalNutrients = allNutrients.filter(
    (field) => !commonKeys.has(field.key)
  );
  const nutrientLabel = (field: (typeof allNutrients)[number]) => {
    const key = field.catalogId ?? field.key;
    // i18n-audit-ignore-next-line dynamic-i18n-key -- bounded nutrient registry has reviewed English/German entries.
    return t(`medications.form.nutrient.${key}`, {
      defaultValue: field.defaultLabel,
    });
  };
  const medicationId = route.params?.medicationId;
  const isEditing = !!medicationId;
  const insets = useSafeAreaInsets();
  const usesNativeHeader = useNativeIOSHeadersActive();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const [textMuted] = useCSSVariable(['--color-text-muted']) as [string];

  const { data: existingMed } = useMedicationDetail(medicationId ?? '', {
    enabled: isEditing,
  });
  const createMedication = useCreateMedication();
  const updateMedication = useUpdateMedication();

  // "Add supplement" from the Supplements screen starts pre-flagged.
  const [edits, setEdits] = useState<Partial<FormState>>(() =>
    !isEditing && route.params?.supplement ? { isSupplement: true } : {}
  );

  const form: FormState = useMemo(() => {
    const base = baseFromMed(existingMed, customNutrients);
    return {
      ...base,
      ...edits,
      nutrients: { ...base.nutrients, ...edits.nutrients },
    };
  }, [existingMed, customNutrients, edits]);

  // null until the user toggles; until then follow the data, so a medication
  // with detail content opens expanded even when it arrives after mount.
  const [detailsToggle, setDetailsToggle] = useState<boolean | null>(null);
  const showDetails = detailsToggle ?? hasDetailsContent(form);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setEdits((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (
      createMedication.isPending ||
      updateMedication.isPending ||
      savingNutrition
    )
      return;

    if (!form.name.trim()) {
      Alert.alert(
        t('medications.form.required', { defaultValue: 'Required' }),
        form.isSupplement
          ? t('medications.form.supplementNameRequired', {
              defaultValue: 'Please enter a supplement name.',
            })
          : t('medications.form.nameRequired', {
              defaultValue: 'Please enter a medication name.',
            })
      );
      return;
    }

    const strengthNum = form.strengthValue
      ? parseFloat(form.strengthValue)
      : null;
    const doseNum = form.doseAmount ? parseFloat(form.doseAmount) : null;
    if (
      (form.strengthValue && !Number.isFinite(strengthNum)) ||
      (form.doseAmount && !Number.isFinite(doseNum))
    ) {
      Alert.alert(
        t('medications.form.invalidNumber', { defaultValue: 'Invalid number' }),
        t('medications.form.invalidNumberMessage', {
          defaultValue:
            'Please enter valid numeric values for strength and dose.',
        })
      );
      return;
    }

    let nutrientAmounts = existingMed?.nutrients ?? {};
    if (form.isSupplement) {
      const needsDefinitions =
        Object.keys(existingMed?.nutrients?.custom_nutrients ?? {}).length >
          0 ||
        SUPPLEMENT_NATIVE_FIELDS.some((field) =>
          form.nutrients[field.key]?.trim()
        );
      if (needsDefinitions && (nutrientsLoading || nutrientsError)) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('medications.form.nutrientsUnavailable', {
            defaultValue:
              'Nutrient definitions could not be loaded. Please reopen this form and try again.',
          })
        );
        return;
      }
      try {
        const values = parseSupplementNutritionDraft(form.nutrients);
        const catalogIds = SUPPLEMENT_NATIVE_FIELDS.filter(
          (field) => values[field.key] !== undefined
        ).map((field) => field.catalogId);
        if (catalogIds.length) {
          setSavingNutrition(true);
          const result = await ensureCatalogNutrients(catalogIds);
          nutrientAmounts = applySupplementNutritionDraft(
            values,
            existingMed?.nutrients,
            customNutrients,
            result.resolved,
            result.nutrients
          );
          invalidateNutritionCaches(queryClient);
        } else {
          nutrientAmounts = applySupplementNutritionDraft(
            values,
            existingMed?.nutrients,
            customNutrients,
            []
          );
        }
      } catch {
        Alert.alert(
          t('medications.form.invalidNumber', {
            defaultValue: 'Invalid number',
          }),
          t('medications.form.nutrientSaveFailed', {
            defaultValue:
              'Check nutrient amounts and units. No supplement changes were saved; try again when connected.',
          })
        );
        return;
      } finally {
        setSavingNutrition(false);
      }
    }

    const base = {
      name: form.name.trim(),
      type_id: form.typeId,
      strength_value: strengthNum,
      strength_unit: form.strengthUnit || null,
      dose_amount: doseNum,
      dose_unit: form.doseUnit || null,
      reason_text: form.reason.trim() || null,
      prescriber: form.prescriber.trim() || null,
      pharmacy: form.pharmacy.trim() || null,
      notes: form.notes.trim() || null,
      is_supplement: form.isSupplement,
      // A category change does not erase the saved nutrition definition. The flag
      // controls whether future intake contributes nutrients; history keeps its snapshots.
      nutrients: form.isSupplement
        ? nutrientAmounts
        : (existingMed?.nutrients ?? {}),
    };

    if (isEditing && medicationId) {
      updateMedication.mutate(
        { id: medicationId, body: { ...base, is_active: form.isActive } },
        {
          onSuccess: () => navigation.goBack(),
          onError: (error) =>
            Alert.alert(
              t('common.error', { defaultValue: 'Error' }),
              form.isSupplement
                ? t('medications.form.supplementUpdateFailed', {
                    defaultValue: 'Could not update supplement: {{error}}',
                    error: error.message,
                  })
                : t('medications.form.updateFailed', {
                    defaultValue: 'Failed to update medication: {{error}}',
                    error: error.message,
                  })
            ),
        }
      );
    } else {
      createMedication.mutate(
        { ...base, is_active: form.isActive },
        {
          onSuccess: (med) => {
            navigation.replace('MedicationDetail', { medicationId: med.id });
          },
          onError: (error) =>
            Alert.alert(
              t('common.error', { defaultValue: 'Error' }),
              form.isSupplement
                ? t('medications.form.supplementCreateFailed', {
                    defaultValue: 'Could not create supplement: {{error}}',
                    error: error.message,
                  })
                : t('medications.form.createFailed', {
                    defaultValue: 'Failed to create medication: {{error}}',
                    error: error.message,
                  })
            ),
        }
      );
    }
  }, [
    form,
    isEditing,
    medicationId,
    existingMed,
    createMedication,
    updateMedication,
    navigation,
    t,
    customNutrients,
    nutrientsLoading,
    nutrientsError,
    queryClient,
    savingNutrition,
  ]);

  const formTitle = form.isSupplement
    ? isEditing
      ? t('medications.form.editSupplementTitle', {
          defaultValue: 'Edit supplement',
        })
      : t('medications.form.newSupplementTitle', {
          defaultValue: 'New supplement',
        })
    : isEditing
      ? t('medications.form.editTitle', { defaultValue: 'Edit Medication' })
      : t('medications.form.newTitle', { defaultValue: 'New Medication' });
  const header = useScreenHeader({
    title: formTitle,
    nativeTitle: formTitle,
    left: { kind: 'dismiss', onPress: () => navigation.goBack() },
    right: {
      kind: 'primary',
      label: t('common.save', { defaultValue: 'Save' }),
      busy:
        createMedication.isPending ||
        updateMedication.isPending ||
        savingNutrition,
      busyLabel: t('common.saving', { defaultValue: 'Saving…' }),
      onPress: handleSave,
    },
  });

  const typeOptions = useMemo(() => {
    const types: string[] = form.isSupplement
      ? [...SUPPLEMENT_FORMS]
      : [...MEDICATION_TYPES];
    // Retain legacy/custom forms when editing; never silently rewrite stored type_id.
    if (form.typeId && !types.includes(form.typeId)) types.push(form.typeId);
    return types.map((id) => ({
      label: medicationTypeLabel(id, t),
      value: id,
    }));
  }, [form.isSupplement, form.typeId, t]);

  const renderNutrient = (field: (typeof allNutrients)[number]) => {
    const unit = field.catalogId
      ? (supplementDefinition(field.catalogId, customNutrients)?.unit ??
        field.unit)
      : field.unit;
    const label = nutrientLabel(field);
    return (
      <View key={field.key} className="flex-row items-center gap-3">
        <Text className="flex-1 text-sm text-text-primary">
          {label} ({unit})
        </Text>
        <View style={{ width: 110 }}>
          <FormInput
            testID={`supplement-nutrient-${field.key}`}
            accessibilityLabel={`${label} ${unit}`}
            value={form.nutrients[field.key] ?? ''}
            onChangeText={(value) =>
              setEdits((current) => ({
                ...current,
                nutrients: { ...current.nutrients, [field.key]: value },
              }))
            }
            keyboardType="decimal-pad"
            placeholder="—"
          />
        </View>
      </View>
    );
  };

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <KeyboardAwareScrollView
        contentContainerStyle={{
          padding: 16,
          rowGap: 24,
          paddingBottom: insets.bottom + 80 + activeWorkoutBarPadding,
        }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
        keyboardShouldPersistTaps="handled"
        bottomOffset={80}
      >
        <View className="gap-4">
          <View className="gap-1.5">
            <Text className="text-text-secondary text-sm font-medium">
              {t('medications.form.classification', {
                defaultValue: 'Category',
              })}
            </Text>
            {existingMed?.is_glp1 ? (
              <Text className="text-base text-text-primary">
                {medicationKindLabel({ is_supplement: form.isSupplement }, t)}
              </Text>
            ) : (
              <BottomSheetPicker
                value={form.isSupplement ? 'supplement' : 'medication'}
                options={[
                  {
                    value: 'medication',
                    label: medicationKindLabel({ is_supplement: false }, t),
                  },
                  {
                    value: 'supplement',
                    label: medicationKindLabel({ is_supplement: true }, t),
                  },
                ]}
                onSelect={(value) =>
                  updateField('isSupplement', value === 'supplement')
                }
                title={t('medications.form.classification', {
                  defaultValue: 'Category',
                })}
              />
            )}
            <Text className="text-sm text-text-secondary">
              {existingMed?.is_glp1
                ? t('medications.form.glp1Classification', {
                    defaultValue:
                      'GLP-1 items remain medications. Their classification cannot be changed here.',
                  })
                : t('medications.form.supplementHint', {
                    defaultValue:
                      'Choose the category yourself; it is not inferred from the name. Only supplements with logged intake contribute their recorded nutrients to nutrition totals.',
                  })}
            </Text>
          </View>
          <View className="gap-1.5">
            <Text className="text-text-secondary text-sm font-medium">
              {t('medications.form.name', { defaultValue: 'Name *' })}
            </Text>
            <FormInput
              placeholder={
                form.isSupplement
                  ? t('medications.form.supplementNamePlaceholder', {
                      defaultValue: 'e.g. Vitamin D',
                    })
                  : t('medications.form.namePlaceholder', {
                      defaultValue: 'Ipsumol',
                    })
              }
              value={form.name}
              onChangeText={(v) => updateField('name', v)}
              autoCapitalize="words"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-text-secondary text-sm font-medium">
              {t('medications.form.type', { defaultValue: 'Type' })}
            </Text>
            <BottomSheetPicker
              value={form.typeId}
              options={typeOptions}
              onSelect={(val) => updateField('typeId', val)}
              title={
                form.isSupplement
                  ? t('medications.form.supplementTypeTitle', {
                      defaultValue: 'Supplement form',
                    })
                  : t('medications.form.typeTitle', {
                      defaultValue: 'Medication Type',
                    })
              }
            />
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1 gap-1.5">
              <Text className="text-text-secondary text-sm font-medium">
                {t('medications.form.strength', { defaultValue: 'Strength' })}
              </Text>
              <FormInput
                placeholder="10"
                value={form.strengthValue}
                onChangeText={(v) => updateField('strengthValue', v)}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1 gap-1.5">
              <Text className="text-text-secondary text-sm font-medium">
                {t('medications.form.unit', { defaultValue: 'Unit' })}
              </Text>
              <FormInput
                placeholder={t('medications.form.strengthUnitPlaceholder', {
                  defaultValue: 'mg',
                })}
                value={form.strengthUnit}
                onChangeText={(v) => updateField('strengthUnit', v)}
              />
            </View>
          </View>

          {form.isSupplement && (
            <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
              <Text className="text-base font-semibold text-text-primary">
                {t('medications.form.nutrientsPerDose', {
                  defaultValue: 'Nutrition per dose',
                })}
              </Text>
              <Text className="text-sm text-text-secondary">
                {t('medications.form.nutrientsOptional', {
                  defaultValue: 'Leave unknown values blank.',
                })}
              </Text>
              {commonNutrients.map(renderNutrient)}
              <CollapsibleSection
                title={t('medications.form.additionalNutrients', {
                  defaultValue: 'More nutrients',
                })}
                expanded={showAdditionalNutrients}
                onToggle={() =>
                  setShowAdditionalNutrients(!showAdditionalNutrients)
                }
                itemCount={additionalNutrients.length}
                itemCountLabel={new Intl.NumberFormat(i18n.language).format(
                  additionalNutrients.length
                )}
              >
                <View className="gap-3">
                  {additionalNutrients.map(renderNutrient)}
                </View>
              </CollapsibleSection>
            </View>
          )}

          <View className="flex-row gap-4">
            <View className="flex-1 gap-1.5">
              <Text className="text-text-secondary text-sm font-medium">
                {t('medications.form.dose', { defaultValue: 'Dose' })}
              </Text>
              <FormInput
                placeholder="1"
                value={form.doseAmount}
                onChangeText={(v) => updateField('doseAmount', v)}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1 gap-1.5">
              <Text className="text-text-secondary text-sm font-medium">
                {t('medications.form.unit', { defaultValue: 'Unit' })}
              </Text>
              <FormInput
                placeholder={t('medications.form.doseUnitPlaceholder', {
                  defaultValue: 'tablet',
                })}
                value={form.doseUnit}
                onChangeText={(v) => updateField('doseUnit', v)}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setDetailsToggle(!showDetails)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: showDetails }}
          className="flex-row items-center gap-1 py-2 self-start"
        >
          <Text
            className="text-text-primary font-medium"
            style={{ fontSize: 16 }}
          >
            {t('medications.form.details', { defaultValue: 'Details' })}
          </Text>
          <Icon
            name={showDetails ? 'chevron-down' : 'chevron-forward'}
            size={12}
            color={textMuted}
          />
        </TouchableOpacity>

        {showDetails && (
          <View className="gap-4">
            <View className="gap-1.5">
              <Text className="text-text-secondary text-sm font-medium">
                {t('medications.form.reason', { defaultValue: 'Reason' })}
              </Text>
              <FormInput
                placeholder={t('medications.form.reasonPlaceholder', {
                  defaultValue: 'Blood pressure',
                })}
                value={form.reason}
                onChangeText={(v) => updateField('reason', v)}
              />
            </View>

            {!form.isSupplement && (
              <>
                <View className="gap-1.5">
                  <Text className="text-text-secondary text-sm font-medium">
                    {t('medications.form.prescriber', {
                      defaultValue: 'Prescriber',
                    })}
                  </Text>
                  <FormInput
                    placeholder={t('medications.form.prescriberPlaceholder', {
                      defaultValue: 'Dr. Ipsum',
                    })}
                    value={form.prescriber}
                    onChangeText={(v) => updateField('prescriber', v)}
                  />
                </View>

                <View className="gap-1.5">
                  <Text className="text-text-secondary text-sm font-medium">
                    {t('medications.form.pharmacy', {
                      defaultValue: 'Pharmacy',
                    })}
                  </Text>
                  <FormInput
                    placeholder={t('medications.form.pharmacyPlaceholder', {
                      defaultValue: 'Sunny Pharmacy',
                    })}
                    value={form.pharmacy}
                    onChangeText={(v) => updateField('pharmacy', v)}
                  />
                </View>
              </>
            )}
            <View className="gap-1.5">
              <Text className="text-text-secondary text-sm font-medium">
                {t('medications.form.notes', { defaultValue: 'Notes' })}
              </Text>
              <FormInput
                value={form.notes}
                onChangeText={(v) => updateField('notes', v)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ minHeight: 72 }}
              />
            </View>
          </View>
        )}

        <View className="flex-row justify-between items-center">
          <Text className="text-base text-text-primary">
            {t('medications.form.active', { defaultValue: 'Active' })}
          </Text>
          <Switch
            value={form.isActive}
            onValueChange={(v) => updateField('isActive', v)}
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

export default MedicationFormScreen;
