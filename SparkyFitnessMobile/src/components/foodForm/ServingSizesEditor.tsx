import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TextInput,
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
import Icon, { type IconName } from '../Icon';
import { withAlpha } from '../ui/glow';
import {
  computeReorderTargetIndex,
  createReorderRowPanGesture,
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

type TFn = ReturnType<typeof useTranslation>['t'];

/** Every row has the same height so the shared drag geometry stays exact. */
const ROW_HEIGHT = 96;
const ROW_GAP = 10;

function amountLabel(size: number, unit: string, t: TFn) {
  return formatLocalizedUnitQuantity(size, unit, t);
}

/** Compact inline field of a serving row (Label / Amount / Grams). */
const CellInput: React.FC<{
  testID: string;
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel: string;
  numeric?: boolean;
  placeholder?: string;
  suffix?: string;
  invalid?: boolean;
  dangerColor: string;
  placeholderColor: string;
}> = ({
  testID,
  value,
  onChangeText,
  accessibilityLabel,
  numeric = false,
  placeholder,
  suffix,
  invalid = false,
  dangerColor,
  placeholderColor,
}) => (
  <View
    className="h-11 flex-row items-center rounded-lg border border-border-subtle bg-background px-1.5"
    style={invalid ? { borderColor: dangerColor } : undefined}
  >
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor}
      accessibilityLabel={accessibilityLabel}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      returnKeyType="done"
      maxLength={numeric ? 10 : 40}
      className="min-w-0 flex-1 text-base text-text-primary"
    />
    {suffix ? (
      <Text className="ml-0.5 text-sm text-text-secondary">{suffix}</Text>
    ) : null}
  </View>
);

const ServingRow: React.FC<{
  draft: ServingDraft;
  index: number;
  lastIndex: number;
  title: string;
  summary: string;
  weightSuffix: string;
  error: ServingDraftError | undefined;
  onUpdate: (patch: Partial<ServingDraft>) => void;
  onDelete: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  disabled: boolean;
  textMuted: string;
  dangerColor: string;
  activeDragIndex: SharedValue<number>;
  panY: SharedValue<number>;
  committingTranslate: SharedValue<number>;
  targetIndex: SharedValue<number>;
  strides: number[];
}> = ({
  draft,
  index,
  lastIndex,
  title,
  summary,
  weightSuffix,
  error,
  onUpdate,
  onDelete,
  onMove,
  disabled,
  textMuted,
  dangerColor,
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
  const metricUnit = isMetricInputUnit(draft.unit);
  const amount = parseDecimalInput(draft.amountText);
  const headers = [
    ['label', t('foodForm.servings.label', { defaultValue: 'Label' }), 1.45],
    ['amount', t('foodForm.servings.amount', { defaultValue: 'Amount' }), 0.75],
    ['unit', t('foodForm.servings.unit', { defaultValue: 'Unit' }), 1.25],
    ['grams', t('foodForm.servings.grams', { defaultValue: 'Grams' }), 1.25],
  ] as const;

  return (
    <Animated.View
      testID={`serving-row-${index}`}
      className="flex-row items-center rounded-2xl border bg-raised pr-1"
      style={[
        previewStyle,
        {
          height: ROW_HEIGHT,
          marginBottom: ROW_GAP,
          borderColor: error ? dangerColor : withAlpha(textMuted, 0.3),
        },
      ]}
    >
      <GestureDetector gesture={dragGesture}>
        <View
          testID={`serving-drag-handle-${index}`}
          className="h-full w-8 items-center justify-center"
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
      <View
        testID={`serving-row-select-${index}`}
        accessibilityLabel={`${title}, ${summary}`}
        className="min-w-0 flex-1 gap-1.5 py-2"
      >
        <View className="flex-row gap-2">
          {headers.map(([key, label, flex]) => (
            <Text
              key={key}
              className="text-xs text-text-secondary"
              style={{ flex }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {label}
            </Text>
          ))}
        </View>
        <View className="flex-row items-center gap-2">
          <View style={{ flex: 1.45 }}>
            <CellInput
              testID={`serving-edit-label-${index}`}
              value={draft.label}
              onChangeText={(text) => onUpdate({ label: text })}
              placeholder={
                amount > 0 ? amountLabel(amount, draft.unit, t) : undefined
              }
              accessibilityLabel={t('foodForm.servings.labelA11y', {
                defaultValue: 'Label of {{name}}',
                name: title,
              })}
              dangerColor={dangerColor}
              placeholderColor={textMuted}
              invalid={error === 'duplicate'}
            />
          </View>
          <View style={{ flex: 0.75 }}>
            <CellInput
              testID={`serving-edit-amount-${index}`}
              value={draft.amountText}
              numeric
              onChangeText={(text) => {
                if (DECIMAL_INPUT_REGEX.test(text))
                  onUpdate({ amountText: text });
              }}
              accessibilityLabel={t('foodForm.servings.amountA11y', {
                defaultValue: 'Amount of {{name}}',
                name: title,
              })}
              dangerColor={dangerColor}
              placeholderColor={textMuted}
              invalid={error === 'amount'}
            />
          </View>
          <View style={{ flex: 1.25 }}>
            <BottomSheetPicker
              value={draft.unit}
              sections={makeServingUnitSections(t)}
              onSelect={(value) => onUpdate({ unit: value })}
              title={t('foodForm.selectUnit', { defaultValue: 'Select Unit' })}
              renderTrigger={({ onPress, selectedOption }) => (
                <TouchableOpacity
                  testID={`serving-edit-unit-${index}`}
                  onPress={onPress}
                  disabled={disabled}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('foodForm.servings.unitA11y', {
                    defaultValue: 'Unit, {{unit}}',
                    unit:
                      selectedOption?.label ?? localizeFoodUnit(draft.unit, t),
                  })}
                  className="h-11 flex-row items-center justify-between rounded-lg border border-border-subtle bg-background px-1.5"
                  style={
                    error === 'unit' ? { borderColor: dangerColor } : undefined
                  }
                >
                  <Text
                    className="min-w-0 flex-1 text-base text-text-primary"
                    numberOfLines={1}
                  >
                    {selectedOption?.label ?? localizeFoodUnit(draft.unit, t)}
                  </Text>
                  <Icon name="chevron-down" size={12} color={textMuted} />
                </TouchableOpacity>
              )}
            />
          </View>
          <View style={{ flex: 1.25 }}>
            {metricUnit ? (
              <View className="h-11 justify-center px-1">
                <Text
                  className="text-base text-text-primary"
                  numberOfLines={1}
                  testID={`serving-grams-${index}`}
                >
                  {amount > 0 ? amountLabel(amount, draft.unit, t) : '—'}
                </Text>
              </View>
            ) : (
              <CellInput
                testID={`serving-edit-weight-${index}`}
                value={draft.weightText}
                numeric
                suffix={weightSuffix}
                placeholder="?"
                onChangeText={(text) => {
                  if (DECIMAL_INPUT_REGEX.test(text))
                    onUpdate({ weightText: text });
                }}
                accessibilityLabel={t('foodForm.servings.weightA11y', {
                  defaultValue: 'Weight of {{name}} in {{unit}}',
                  name: title,
                  unit: weightSuffix,
                })}
                dangerColor={dangerColor}
                placeholderColor={textMuted}
                invalid={error === 'weight'}
              />
            )}
          </View>
        </View>
      </View>
      <TouchableOpacity
        testID={`serving-delete-${index}`}
        onPress={onDelete}
        disabled={disabled}
        className="h-11 w-10 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={t('foodForm.servings.delete', {
          defaultValue: 'Delete {{name}}',
          name: title,
        })}
      >
        <Icon name="trash" size={20} color={dangerColor} />
      </TouchableOpacity>
    </Animated.View>
  );
};

type PreviewKey = 'calories' | 'protein' | 'carbs' | 'fat';

const PREVIEW_TILES: {
  key: PreviewKey;
  icon: IconName;
  digits: number;
  suffix: string;
}[] = [
  { key: 'calories', icon: 'flame', digits: 0, suffix: '' },
  { key: 'protein', icon: 'fork-knife', digits: 1, suffix: ' g' },
  { key: 'carbs', icon: 'wellness', digits: 1, suffix: ' g' },
  { key: 'fat', icon: 'water', digits: 1, suffix: ' g' },
];

/**
 * The Edit Food "Serving sizes" and "Serving preview" cards: saved portions
 * edited inline (label, amount, unit, weight), reordered by drag or VoiceOver,
 * and the nutrition one serving holds. Grams/ml are always available when
 * logging and are never rows; the nutrition values are edited separately.
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
  const [
    textMuted,
    accentColor,
    dangerColor,
    caloriesColor,
    proteinColor,
    carbsColor,
    fatColor,
  ] = useCSSVariable([
    '--color-text-muted',
    '--color-accent-primary',
    '--color-text-danger',
    '--color-calories',
    '--color-macro-protein',
    '--color-macro-carbs',
    '--color-macro-fat',
  ]) as string[];
  const tileColors: Record<PreviewKey, string> = {
    calories: caloriesColor,
    protein: proteinColor,
    carbs: carbsColor,
    fat: fatColor,
  };
  const [previewKey, setPreviewKey] = useState<string>('basis');
  const weightOfBasis = basisWeight(basis);
  const basisIsMetric = !!basis && isMetricInputUnit(basis.serving_unit);

  const { strides, offsets } = useReorderRowGeometry(
    drafts.length,
    ROW_HEIGHT + ROW_GAP
  );
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
    onChange([
      ...drafts,
      {
        key: newDraftKey(),
        label: '',
        amountText: '1',
        unit: 'piece',
        weightText: '',
        ownNutrition: false,
        reweighed: false,
      },
    ]);
  };

  const removeServing = (key: string) => {
    onChange(drafts.filter((draft) => draft.key !== key));
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

  const summaryOf = (draft: ServingDraft) => {
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

  const errorText = (error: ServingDraftError) => {
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
    }
  };

  const basisLabel = basis
    ? amountLabel(basis.serving_size, basis.serving_unit, t)
    : '';
  const weightSuffix = localizeFoodUnit(
    weightOfBasis?.metric_unit ?? basisWeightUnit,
    t
  );
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
  const previewOptions = [
    { value: 'basis', label: basisLabel },
    ...drafts.map((draft) => ({ value: draft.key, label: titleOf(draft) })),
  ];
  const previewLabel =
    previewOptions.find(
      (option) => option.value === (previewDraft ? previewKey : 'basis')
    )?.label ?? basisLabel;
  const rowErrors = drafts.flatMap((draft) => {
    const error = errors[draft.key];
    return error ? [{ draft, error }] : [];
  });
  const cardStyle = { borderColor: withAlpha(accentColor, 0.3) };
  const tileLabel = (key: PreviewKey) =>
    key === 'calories'
      ? t('foodForm.servings.calories', { defaultValue: 'Calories' })
      : key === 'protein'
        ? t('foodForm.servings.protein', { defaultValue: 'Protein' })
        : key === 'carbs'
          ? t('foodForm.servings.carbs', { defaultValue: 'Carbs' })
          : t('foodForm.servings.fat', { defaultValue: 'Fat' });

  return (
    <View className="gap-4" pointerEvents={disabled ? 'none' : 'auto'}>
      <View
        className="gap-3 rounded-2xl border bg-surface p-4"
        testID="serving-sizes-editor"
        style={[cardStyle, disabled ? { opacity: 0.6 } : null]}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-semibold text-text-primary">
              {t('foodForm.servings.title', { defaultValue: 'Serving sizes' })}
            </Text>
            <Text className="mt-0.5 text-sm text-text-secondary">
              {t('foodForm.servings.subtitle', {
                defaultValue: 'Define the serving sizes for this food.',
              })}
            </Text>
          </View>
          <TouchableOpacity
            testID="serving-add"
            onPress={addServing}
            className="min-h-11 flex-row items-center gap-1.5 rounded-xl border px-3"
            style={{
              borderColor: accentColor,
              backgroundColor: withAlpha(accentColor, 0.1),
            }}
            accessibilityRole="button"
          >
            <Icon name="add" size={18} color={accentColor} />
            <Text
              className="text-sm font-semibold"
              style={{ color: accentColor }}
            >
              {t('foodForm.servings.add', {
                defaultValue: 'Add serving size',
              })}
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
                    if (DECIMAL_INPUT_REGEX.test(text))
                      onBasisWeightChange(text);
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
                {weightSuffix}
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
              defaultValue:
                'No saved portions. Add one to log it with one tap.',
            })}
          </Text>
        ) : (
          <View>
            {drafts.map((draft, index) => (
              <ServingRow
                key={draft.key}
                draft={draft}
                index={index}
                lastIndex={drafts.length - 1}
                title={titleOf(draft)}
                summary={summaryOf(draft)}
                weightSuffix={weightSuffix}
                error={errors[draft.key]}
                onUpdate={(patch) => update(draft.key, patch)}
                onDelete={() => removeServing(draft.key)}
                onMove={handleMove}
                disabled={disabled}
                textMuted={textMuted}
                dangerColor={dangerColor}
                activeDragIndex={activeDragIndex}
                panY={panY}
                committingTranslate={committingTranslate}
                targetIndex={targetIndex}
                strides={strides}
              />
            ))}
            {rowErrors.length > 0 ? (
              <View className="mb-2 gap-1" testID="serving-errors">
                {rowErrors.map(({ draft, error }) => (
                  <View key={draft.key} className="flex-row flex-wrap gap-1">
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: dangerColor }}
                    >
                      {`${titleOf(draft)}:`}
                    </Text>
                    <Text className="text-sm" style={{ color: dangerColor }}>
                      {errorText(error)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text className="text-xs text-text-muted">
              {t('foodForm.servings.orderHint', {
                defaultValue:
                  'Drag to reorder. Portions appear in this order when you log the food.',
              })}
            </Text>
          </View>
        )}
      </View>

      {basis ? (
        <View
          className="gap-3 rounded-2xl border bg-surface p-4"
          style={cardStyle}
          testID="serving-preview"
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-xl font-semibold text-text-primary">
                {t('foodForm.servings.preview', {
                  defaultValue: 'Serving preview',
                })}
              </Text>
              <Text className="mt-0.5 text-sm text-text-secondary">
                {t('foodForm.servings.previewSubtitle', {
                  defaultValue: 'Nutrition for the selected serving size.',
                })}
              </Text>
            </View>
            <BottomSheetPicker
              value={previewDraft ? previewKey : 'basis'}
              options={previewOptions}
              onSelect={setPreviewKey}
              title={t('foodForm.servings.preview', {
                defaultValue: 'Serving preview',
              })}
              renderTrigger={({ onPress }) => (
                <TouchableOpacity
                  testID="serving-preview-picker"
                  onPress={onPress}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('foodForm.servings.previewPick', {
                    defaultValue: 'Preview serving, {{serving}}',
                    serving: previewLabel,
                  })}
                  className="max-w-[45%] flex-row items-center gap-1 rounded-xl border border-border-subtle bg-raised px-3 py-2"
                >
                  <Text
                    className="text-base font-medium text-text-primary"
                    numberOfLines={1}
                  >
                    {previewLabel}
                  </Text>
                  <Icon name="chevron-down" size={12} color={textMuted} />
                </TouchableOpacity>
              )}
            />
          </View>
          {previewValues ? (
            <View className="flex-row gap-2" testID="serving-preview-values">
              {PREVIEW_TILES.map((tile) => {
                const color = tileColors[tile.key];
                const label = tileLabel(tile.key);
                const value = `${formatLocalizedNumber(
                  previewValues[tile.key],
                  { maximumFractionDigits: tile.digits }
                )}${tile.suffix}`;
                return (
                  <View
                    key={tile.key}
                    className="min-w-0 flex-1 gap-1 rounded-xl border px-2 py-2.5"
                    style={{
                      borderColor: withAlpha(color, 0.6),
                      backgroundColor: withAlpha(color, 0.18),
                    }}
                    accessible
                    accessibilityLabel={`${label}: ${value}`}
                  >
                    <Icon name={tile.icon} size={18} color={color} />
                    <Text
                      className="text-lg font-bold text-text-primary"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {value}
                    </Text>
                    <Text
                      className="text-xs text-text-secondary"
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
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
