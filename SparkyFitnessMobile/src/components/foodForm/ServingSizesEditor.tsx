import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useCSSVariable } from 'uniwind';
import { isMetricInputUnit, type MetricUnit } from '@workspace/shared';
import BottomSheetPicker from '../BottomSheetPicker';
import FormInput from '../FormInput';
import Icon from '../Icon';
import {
  computeReorderTargetIndex,
  createReorderRowPanGesture,
  REORDER_ROW_HEIGHT,
  resetReorderDragPreview,
  useReorderRowGeometry,
  useReorderRowPreviewStyle,
} from '../WorkoutReorderList';
import { formatLocalizedNumber } from '../../localization';
import type { FoodVariantDetail } from '../../types/foods';
import { makeServingUnitSections } from '../../utils/foodFormState';
import {
  formatLocalizedUnitQuantity,
  localizeFoodUnit,
} from '../../utils/foodUnitLocalization';
import {
  DECIMAL_INPUT_REGEX,
  parseDecimalInput,
} from '../../utils/numericInput';
import {
  basisWeight,
  draftDerives,
  draftPreviewNutrition,
  draftWeight,
  newDraftKey,
  type ServingBasis,
  type ServingDraft,
  type ServingDraftError,
} from '../../utils/servingDrafts';

export interface ServingSizesEditorProps {
  basis: ServingBasis | null;
  drafts: ServingDraft[];
  onChange: (next: ServingDraft[]) => void;
  /** Stored rows, for the preview of rows that keep their own nutrition. */
  storedVariants: FoodVariantDetail[] | undefined;
  /** Weight of a basis measured in its own unit ("1 bar"), as typed. */
  basisWeightText: string;
  basisWeightUnit: MetricUnit;
  onBasisWeightChange: (text: string) => void;
  errors: Record<string, ServingDraftError>;
  disabled?: boolean;
}

type FormInputProps = React.ComponentProps<typeof FormInput>;

/** A form input with a visible label that is also its accessibility label. */
const LabeledInput: React.FC<FormInputProps & { label: string }> = ({
  label,
  ...props
}) => (
  <View className="gap-1.5">
    <Text className="text-sm font-medium text-text-secondary">{label}</Text>
    <FormInput accessibilityLabel={label} {...props} />
  </View>
);

function amountLabel(
  size: number,
  unit: string,
  t: ReturnType<typeof useTranslation>['t']
) {
  return formatLocalizedUnitQuantity(size, unit, t);
}

const ServingRow: React.FC<{
  index: number;
  lastIndex: number;
  selected: boolean;
  title: string;
  subtitle: string;
  hasError: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  disabled: boolean;
  textMuted: string;
  dangerColor: string;
  accentColor: string;
  activeDragIndex: SharedValue<number>;
  panY: SharedValue<number>;
  committingTranslate: SharedValue<number>;
  targetIndex: SharedValue<number>;
  strides: number[];
}> = ({
  index,
  lastIndex,
  selected,
  title,
  subtitle,
  hasError,
  onSelect,
  onDelete,
  onMove,
  disabled,
  textMuted,
  dangerColor,
  accentColor,
  activeDragIndex,
  panY,
  committingTranslate,
  targetIndex,
  strides,
}) => {
  const { t } = useTranslation();
  const dragGesture = createReorderRowPanGesture({
    index,
    activeDragIndex,
    panY,
    committingTranslate,
    targetIndex,
    onMove,
  });
  const previewStyle = useReorderRowPreviewStyle(
    index,
    activeDragIndex,
    panY,
    committingTranslate,
    targetIndex,
    strides
  );
  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') {
      onMove(index, Math.min(index + 1, lastIndex));
    } else if (event.nativeEvent.actionName === 'decrement') {
      onMove(index, Math.max(index - 1, 0));
    }
  };

  return (
    <Animated.View
      testID={`serving-row-${index}`}
      className="flex-row items-center rounded-xl border bg-raised"
      style={[
        previewStyle,
        {
          height: REORDER_ROW_HEIGHT - 8,
          marginBottom: 8,
          borderColor: hasError
            ? dangerColor
            : selected
              ? accentColor
              : 'transparent',
        },
      ]}
    >
      <GestureDetector gesture={dragGesture}>
        <View
          testID={`serving-drag-handle-${index}`}
          className="h-full justify-center px-3"
          accessibilityRole="adjustable"
          accessibilityLabel={t('foodForm.servings.reorder', {
            defaultValue: 'Reorder {{name}}',
            name: title,
          })}
          accessibilityValue={{
            text: t('foodForm.servings.position', {
              defaultValue: 'Serving {{position}} of {{total}}',
              position: index + 1,
              total: lastIndex + 1,
            }),
          }}
          accessibilityActions={[
            {
              name: 'decrement',
              label: t('foodForm.servings.moveUp', { defaultValue: 'Move up' }),
            },
            {
              name: 'increment',
              label: t('foodForm.servings.moveDown', {
                defaultValue: 'Move down',
              }),
            },
          ]}
          onAccessibilityAction={handleAccessibilityAction}
        >
          <Icon name="reorder-handle" size={20} color={textMuted} />
        </View>
      </GestureDetector>
      <TouchableOpacity
        testID={`serving-row-select-${index}`}
        className="h-full min-w-0 flex-1 justify-center"
        onPress={onSelect}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${title}, ${subtitle}`}
        accessibilityHint={t('foodForm.servings.editHint', {
          defaultValue: 'Edit this serving',
        })}
      >
        <Text
          className="text-base font-semibold text-text-primary"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="text-xs text-text-secondary" numberOfLines={1}>
          {subtitle}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`serving-delete-${index}`}
        onPress={onDelete}
        disabled={disabled}
        className="h-11 w-11 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={t('foodForm.servings.delete', {
          defaultValue: 'Delete {{name}}',
          name: title,
        })}
      >
        <Icon name="trash" size={18} color={textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * The Edit Food "Serving sizes" card: saved portions with label, amount, unit
 * and weight, reordered by drag (or VoiceOver actions), plus a preview of
 * what one serving holds. Grams/ml are always available when logging and are
 * never rows here; the food's own nutrition values are edited separately.
 */
const ServingSizesEditor: React.FC<ServingSizesEditorProps> = ({
  basis,
  drafts,
  onChange,
  storedVariants,
  basisWeightText,
  basisWeightUnit,
  onBasisWeightChange,
  errors,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [textMuted, accentColor, dangerColor] = useCSSVariable([
    '--color-text-muted',
    '--color-accent-primary',
    '--color-text-danger',
  ]) as [string, string, string];
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string>('basis');
  const selectedIndex = drafts.findIndex((draft) => draft.key === selectedKey);
  const selected = selectedIndex >= 0 ? drafts[selectedIndex] : null;
  const weightOfBasis = basisWeight(basis);
  const basisIsMetric = !!basis && isMetricInputUnit(basis.serving_unit);

  const { strides, offsets } = useReorderRowGeometry(drafts.length);
  const activeDragIndex = useSharedValue(-1);
  const panY = useSharedValue(0);
  const committingTranslate = useSharedValue(0);
  const pendingDragResetRef = useRef(false);
  const targetIndex = useDerivedValue(() =>
    activeDragIndex.value < 0
      ? -1
      : computeReorderTargetIndex(
          strides,
          offsets,
          activeDragIndex.value,
          panY.value
        )
  );

  const handleMove = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const next = drafts.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      pendingDragResetRef.current = true;
      onChange(next);
    },
    [drafts, onChange]
  );

  // Release the floating transform once the reordered rows have rendered.
  useEffect(() => {
    if (!pendingDragResetRef.current) return;
    pendingDragResetRef.current = false;
    resetReorderDragPreview(activeDragIndex, panY, committingTranslate);
  }, [drafts, activeDragIndex, panY, committingTranslate]);

  const update = (key: string, patch: Partial<ServingDraft>) => {
    onChange(
      drafts.map((draft) => {
        if (draft.key !== key) return draft;
        const next = { ...draft, ...patch };
        // A new amount, unit or weight on a row with its own nutrition means
        // the user wants it recalculated from the food's values.
        if (
          draft.ownNutrition &&
          ('amountText' in patch || 'unit' in patch || 'weightText' in patch)
        ) {
          next.reweighed = true;
        }
        return next;
      })
    );
  };

  const addServing = () => {
    const key = newDraftKey();
    onChange([
      ...drafts,
      {
        key,
        label: '',
        amountText: '1',
        unit: 'piece',
        weightText: '',
        ownNutrition: false,
        reweighed: false,
      },
    ]);
    setSelectedKey(key);
  };

  const removeServing = (key: string) => {
    onChange(drafts.filter((draft) => draft.key !== key));
    if (selectedKey === key) setSelectedKey(null);
    if (previewKey === key) setPreviewKey('basis');
  };

  const titleOf = (draft: ServingDraft) => {
    const amount = parseDecimalInput(draft.amountText);
    const label = draft.label.trim();
    if (label) return label;
    return amount > 0
      ? amountLabel(amount, draft.unit, t)
      : t('foodForm.servings.untitled', { defaultValue: 'New serving' });
  };

  const subtitleOf = (draft: ServingDraft) => {
    const parts: string[] = [];
    const amount = parseDecimalInput(draft.amountText);
    if (draft.label.trim() && amount > 0) {
      parts.push(amountLabel(amount, draft.unit, t));
    }
    const weight = draftWeight(draft, basis);
    if (weight && !isMetricInputUnit(draft.unit)) {
      parts.push(amountLabel(weight.metric_amount, weight.metric_unit, t));
    }
    const nutrition = draftPreviewNutrition(
      draft,
      basis,
      storedVariants?.find((variant) => variant.id === draft.id)
    );
    if (nutrition) {
      parts.push(
        t('foodForm.servings.kcal', {
          defaultValue: '{{value}} kcal',
          value: formatLocalizedNumber(nutrition.calories, {
            maximumFractionDigits: 0,
          }),
        })
      );
    }
    if (!draftDerives(draft)) {
      parts.push(
        t('foodForm.servings.ownNutrition', { defaultValue: 'Own nutrition' })
      );
    }
    return parts.join(' · ');
  };

  const errorText = (error: ServingDraftError | undefined) => {
    switch (error) {
      case 'amount':
        return t('foodForm.servings.errors.amount', {
          defaultValue: 'Enter an amount greater than zero.',
        });
      case 'unit':
        return t('foodForm.servings.errors.unit', {
          defaultValue: 'Choose a unit.',
        });
      case 'duplicate':
        return t('foodForm.servings.errors.duplicate', {
          defaultValue: 'Another serving has the same amount, unit and name.',
        });
      case 'weight':
        return weightOfBasis
          ? t('foodForm.servings.errors.weight', {
              defaultValue: 'Enter what this serving weighs.',
            })
          : t('foodForm.servings.errors.basisWeight', {
              defaultValue:
                'Enter the weight of the food’s nutrition serving first, or use its own unit.',
            });
      default:
        return null;
    }
  };

  const basisLabel = basis
    ? amountLabel(basis.serving_size, basis.serving_unit, t)
    : '';
  const previewDraft = drafts.find((draft) => draft.key === previewKey);
  const previewValues = previewDraft
    ? draftPreviewNutrition(
        previewDraft,
        basis,
        storedVariants?.find((variant) => variant.id === previewDraft.id)
      )
    : basis
      ? {
          calories: Number(basis.calories) || 0,
          protein: Number(basis.protein) || 0,
          carbs: Number(basis.carbs) || 0,
          fat: Number(basis.fat) || 0,
        }
      : null;
  const weightUnitLabel = localizeFoodUnit(
    weightOfBasis?.metric_unit ?? basisWeightUnit,
    t
  );

  return (
    <View
      className="gap-3 rounded-xl bg-surface p-4"
      testID="serving-sizes-editor"
      pointerEvents={disabled ? 'none' : 'auto'}
      style={disabled ? { opacity: 0.6 } : undefined}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-text-primary">
          {t('foodForm.servings.title', { defaultValue: 'Serving sizes' })}
        </Text>
        <TouchableOpacity
          testID="serving-add"
          onPress={addServing}
          className="min-h-11 flex-row items-center gap-1 px-1"
          accessibilityRole="button"
        >
          <Icon name="add" size={18} color={accentColor} />
          <Text
            className="text-sm font-semibold"
            style={{ color: accentColor }}
          >
            {t('foodForm.servings.add', { defaultValue: 'Add serving size' })}
          </Text>
        </TouchableOpacity>
      </View>

      {basis && !basisIsMetric ? (
        <View className="gap-1">
          <Text className="text-sm font-medium text-text-secondary">
            {t('foodForm.servings.basisWeight', {
              defaultValue: 'Weight of {{serving}}',
              serving: basisLabel,
            })}
          </Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <FormInput
                testID="serving-basis-weight"
                placeholder={t('foodForm.servings.weightUnknown', {
                  defaultValue: 'Unknown',
                })}
                value={basisWeightText}
                onChangeText={(text) => {
                  if (DECIMAL_INPUT_REGEX.test(text)) onBasisWeightChange(text);
                }}
                keyboardType="decimal-pad"
                returnKeyType="done"
                accessibilityLabel={t('foodForm.servings.basisWeight', {
                  defaultValue: 'Weight of {{serving}}',
                  serving: basisLabel,
                })}
              />
            </View>
            <Text className="text-base text-text-secondary">
              {weightUnitLabel}
            </Text>
          </View>
          <Text className="text-xs text-text-muted">
            {t('foodForm.servings.basisWeightHint', {
              defaultValue:
                'With a weight, you can log this food in grams and add portions by weight.',
            })}
          </Text>
        </View>
      ) : null}

      {drafts.length === 0 ? (
        <Text className="text-sm text-text-secondary" testID="serving-empty">
          {t('foodForm.servings.empty', {
            defaultValue: 'No saved portions. Add one to log it with one tap.',
          })}
        </Text>
      ) : (
        <View>
          {drafts.map((draft, index) => (
            <ServingRow
              key={draft.key}
              index={index}
              lastIndex={drafts.length - 1}
              selected={draft.key === selectedKey}
              title={titleOf(draft)}
              subtitle={subtitleOf(draft)}
              hasError={!!errors[draft.key]}
              onSelect={() =>
                setSelectedKey((current) =>
                  current === draft.key ? null : draft.key
                )
              }
              onDelete={() => removeServing(draft.key)}
              onMove={handleMove}
              disabled={disabled}
              textMuted={textMuted}
              dangerColor={dangerColor}
              accentColor={accentColor}
              activeDragIndex={activeDragIndex}
              panY={panY}
              committingTranslate={committingTranslate}
              targetIndex={targetIndex}
              strides={strides}
            />
          ))}
          <Text className="text-xs text-text-muted">
            {t('foodForm.servings.orderHint', {
              defaultValue:
                'Drag to reorder. Portions appear in this order when you log the food.',
            })}
          </Text>
        </View>
      )}

      {selected ? (
        <View
          className="gap-3 rounded-xl border border-border-subtle p-3"
          testID="serving-edit-panel"
        >
          <LabeledInput
            testID="serving-edit-label"
            label={t('foodForm.servings.label', { defaultValue: 'Label' })}
            placeholder={t('foodForm.servings.labelPlaceholder', {
              defaultValue: 'e.g. Medium',
            })}
            value={selected.label}
            maxLength={40}
            onChangeText={(text) => update(selected.key, { label: text })}
            returnKeyType="done"
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <LabeledInput
                testID="serving-edit-amount"
                label={t('foodForm.servings.amount', {
                  defaultValue: 'Amount',
                })}
                value={selected.amountText}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onChangeText={(text) => {
                  if (DECIMAL_INPUT_REGEX.test(text)) {
                    update(selected.key, { amountText: text });
                  }
                }}
              />
            </View>
            <View className="flex-1 gap-1.5">
              <Text className="text-sm font-medium text-text-secondary">
                {t('foodForm.servings.unit', { defaultValue: 'Unit' })}
              </Text>
              <BottomSheetPicker
                value={selected.unit}
                sections={makeServingUnitSections(t)}
                onSelect={(value) => update(selected.key, { unit: value })}
                title={t('foodForm.selectUnit', {
                  defaultValue: 'Select Unit',
                })}
                renderTrigger={({ onPress, selectedOption }) => (
                  <TouchableOpacity
                    testID="serving-edit-unit"
                    onPress={onPress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('foodForm.servings.unitA11y', {
                      defaultValue: 'Unit, {{unit}}',
                      unit:
                        selectedOption?.label ??
                        localizeFoodUnit(selected.unit, t),
                    })}
                    className="flex-row items-center justify-between rounded-lg border border-border-subtle bg-raised px-3"
                    style={{ height: 44 }}
                  >
                    <Text
                      className="flex-1 text-base text-text-primary"
                      numberOfLines={1}
                    >
                      {selectedOption?.label ??
                        localizeFoodUnit(selected.unit, t)}
                    </Text>
                    <Icon name="chevron-down" size={12} color={textMuted} />
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
          {isMetricInputUnit(selected.unit) ? null : (
            <View className="flex-row items-end gap-2">
              <View className="flex-1">
                <LabeledInput
                  testID="serving-edit-weight"
                  label={t('foodForm.servings.weight', {
                    defaultValue: 'Weight ({{unit}})',
                    unit: weightUnitLabel,
                  })}
                  placeholder={t('foodForm.servings.weightUnknown', {
                    defaultValue: 'Unknown',
                  })}
                  value={selected.weightText}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onChangeText={(text) => {
                    if (DECIMAL_INPUT_REGEX.test(text)) {
                      update(selected.key, { weightText: text });
                    }
                  }}
                />
              </View>
            </View>
          )}
          {selected.ownNutrition && selected.reweighed ? (
            <Text className="text-xs text-text-secondary">
              {t('foodForm.servings.recalculated', {
                defaultValue:
                  'This serving had its own nutrition. Saving recalculates it from {{basis}}.',
                basis: basisLabel,
              })}
            </Text>
          ) : null}
          {errors[selected.key] ? (
            <Text className="text-sm" style={{ color: dangerColor }}>
              {errorText(errors[selected.key])}
            </Text>
          ) : null}
        </View>
      ) : null}

      {Object.keys(errors).length > 0 && !(selected && errors[selected.key]) ? (
        <Text
          className="text-sm"
          style={{ color: dangerColor }}
          testID="serving-errors"
        >
          {t('foodForm.servings.errors.fixRows', {
            defaultValue: 'Check the highlighted servings.',
          })}
        </Text>
      ) : null}

      {basis ? (
        <View className="gap-2 border-t border-border-subtle pt-3">
          <Text className="text-sm font-semibold text-text-primary">
            {t('foodForm.servings.preview', {
              defaultValue: 'Serving preview',
            })}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {[
              { key: 'basis', label: basisLabel },
              ...drafts.map((draft) => ({
                key: draft.key,
                label: titleOf(draft),
              })),
            ].map((chip) => {
              const active = chip.key === (previewDraft ? previewKey : 'basis');
              return (
                <TouchableOpacity
                  key={chip.key}
                  testID={`serving-preview-chip-${chip.key}`}
                  onPress={() => setPreviewKey(chip.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className="min-h-9 justify-center rounded-full border px-3"
                  style={{
                    borderColor: active ? accentColor : 'transparent',
                  }}
                >
                  <Text className="text-sm text-text-primary">
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {previewValues ? (
            <View className="flex-row gap-2" testID="serving-preview-values">
              {(
                [
                  [
                    'calories',
                    t('foodForm.servings.calories', {
                      defaultValue: 'Calories',
                    }),
                    0,
                    '',
                  ],
                  [
                    'protein',
                    t('foodForm.servings.protein', { defaultValue: 'Protein' }),
                    1,
                    ' g',
                  ],
                  [
                    'carbs',
                    t('foodForm.servings.carbs', { defaultValue: 'Carbs' }),
                    1,
                    ' g',
                  ],
                  [
                    'fat',
                    t('foodForm.servings.fat', { defaultValue: 'Fat' }),
                    1,
                    ' g',
                  ],
                ] as const
              ).map(([key, label, digits, suffix]) => (
                <View
                  key={key}
                  className="flex-1 items-center rounded-lg bg-raised px-1 py-2"
                  accessible
                  accessibilityLabel={`${label}: ${formatLocalizedNumber(previewValues[key], { maximumFractionDigits: digits })}${suffix}`}
                >
                  <Text
                    className="text-xs text-text-secondary"
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                  <Text
                    className="text-base font-semibold text-text-primary"
                    numberOfLines={1}
                  >
                    {formatLocalizedNumber(previewValues[key], {
                      maximumFractionDigits: digits,
                    })}
                    {suffix}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-text-secondary">
              {t('foodForm.servings.previewUnknown', {
                defaultValue: 'Add a weight to see this serving’s nutrition.',
              })}
            </Text>
          )}
          <Text className="text-xs text-text-muted">
            {t('foodForm.servings.basisNote', {
              defaultValue:
                'Nutrition values are per {{basis}}. Portions are calculated from them.',
              basis: basisLabel,
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default ServingSizesEditor;
