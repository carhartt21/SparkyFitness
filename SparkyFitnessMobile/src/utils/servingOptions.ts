import {
  isDerivedFromBasis,
  isMetricInputUnit,
  servingWeightOf,
  type FoodLastServing,
  type MetricUnit,
  type ServingWeight,
} from '@workspace/shared';
import type { FoodVariantDetail } from '../types/foods';
import i18n from '../localization/i18n';
import {
  formatServingSizeForDisplay,
  formatVariantServingLabel,
  type FoodVariantOptionData,
} from './foodDetails';
import { formatLocalizedUnitQuantity } from './foodUnitLocalization';

/** Prefix of the grams/ml option synthesized from a weighed basis. */
export const METRIC_OPTION_PREFIX = 'metric:';

export interface ServingOption extends FoodVariantOptionData {
  kind: 'metric' | 'portion';
  /** The food_variants row an entry is logged against. */
  variantId: string;
  /** Weight of one `servingSize` of this option, when known. */
  weight: ServingWeight | null;
  servingLabel: string | null;
  /**
   * Set on the grams/ml option of a food whose nutrition is stored for a
   * weighed serving ("1 bar = 45 g"): the entry is logged against that row
   * with these serving values, so its stored nutrition covers the weight.
   */
  servingOverride?: { serving_size: number; serving_unit: MetricUnit };
}

function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** The row whose nutrition the user edits: the internal default, else first. */
export function findNutritionBasis(
  variants: FoodVariantDetail[] | undefined
): FoodVariantDetail | undefined {
  if (!variants?.length) return undefined;
  return variants.find((variant) => variant.is_default) ?? variants[0];
}

function sortedVariants(variants: FoodVariantDetail[]): FoodVariantDetail[] {
  return variants
    .map((variant, index) => ({ variant, index }))
    .sort(
      (a, b) =>
        (a.variant.sort_order ?? 0) - (b.variant.sort_order ?? 0) ||
        a.index - b.index
    )
    .map(({ variant }) => variant);
}

function weightOf(variant: FoodVariantDetail): ServingWeight | null {
  return servingWeightOf({
    serving_size: variant.serving_size,
    serving_unit: variant.serving_unit,
    metric_amount: variant.metric_amount,
    metric_unit: variant.metric_unit,
  });
}

function formatWeight(weight: ServingWeight, servings = 1): string {
  return formatLocalizedUnitQuantity(
    weight.metric_amount * servings,
    weight.metric_unit,
    i18n.t
  );
}

/** "Grams" / "Milliliters" for the unit dropdown. */
export function metricUnitName(unit: MetricUnit): string {
  return unit === 'ml'
    ? i18n.t('foodEntryAdd.servings.milliliters', {
        defaultValue: 'Milliliters',
      })
    : i18n.t('foodEntryAdd.servings.grams', { defaultValue: 'Grams' });
}

/**
 * Name of a saved portion: "Medium (130 g)", "1 cup (245 g)", "1 bar".
 * A label with a non-single amount keeps the amount ("Slices (2 slices)").
 */
export function formatPortionName(
  variant: Pick<
    FoodVariantDetail,
    'serving_size' | 'serving_unit' | 'serving_label' | 'calories'
  >,
  weight: ServingWeight | null
): string {
  const label = variant.serving_label?.trim();
  if (label) {
    if (weight) return `${label} (${formatWeight(weight)})`;
    return toNumber(variant.serving_size) === 1
      ? label
      : `${label} (${formatLocalizedUnitQuantity(
          toNumber(variant.serving_size),
          variant.serving_unit,
          i18n.t
        )})`;
  }
  return formatVariantServingLabel(
    {
      servingSize: toNumber(variant.serving_size),
      servingUnit: variant.serving_unit,
      calories: toNumber(variant.calories),
    },
    weight && !isMetricInputUnit(variant.serving_unit)
      ? [
          {
            serving_size: weight.metric_amount,
            serving_unit: weight.metric_unit,
          },
        ]
      : undefined
  );
}

function toOption(
  variant: FoodVariantDetail,
  kind: ServingOption['kind'],
  weight: ServingWeight | null
): ServingOption {
  const name =
    kind === 'metric' && weight
      ? metricUnitName(weight.metric_unit)
      : formatPortionName(variant, weight);
  return {
    kind,
    id: variant.id,
    variantId: variant.id,
    weight,
    servingLabel: variant.serving_label ?? null,
    label: name,
    quantityUnitLabel: name,
    perServingLabel: name,
    servingSize: toNumber(variant.serving_size),
    servingUnit: variant.serving_unit,
    calories: toNumber(variant.calories),
    protein: toNumber(variant.protein),
    carbs: toNumber(variant.carbs),
    fat: toNumber(variant.fat),
    fiber: variant.dietary_fiber,
    saturatedFat: variant.saturated_fat,
    sodium: variant.sodium,
    sugars: variant.sugars,
    transFat: variant.trans_fat,
    potassium: variant.potassium,
    calcium: variant.calcium,
    iron: variant.iron,
    caffeineMg: variant.caffeine_mg,
    waterMl: variant.water_ml,
    alcoholG: variant.alcohol_g,
    cholesterol: variant.cholesterol,
    vitaminA: variant.vitamin_a,
    vitaminC: variant.vitamin_c,
  };
}

/**
 * The unit dropdown of a saved food: grams (or ml) first, then the saved
 * portions in the user's order.
 *
 * Grams come from the nutrition basis: the basis itself when it is measured
 * in g/ml, another g/ml row, or — when `allowSynthesizedMetric` — a grams
 * option derived from a weighed basis ("1 bar = 45 g"). Unlabelled g/ml rows
 * that only restate the basis are folded into the grams option.
 */
export function buildServingOptions(
  variants: FoodVariantDetail[] | undefined,
  { allowSynthesizedMetric = true }: { allowSynthesizedMetric?: boolean } = {}
): ServingOption[] {
  const rows = sortedVariants(variants ?? []);
  const basis = findNutritionBasis(rows);
  if (!basis) return [];
  const basisWeight = weightOf(basis);

  let metric: ServingOption | null = null;
  if (isMetricInputUnit(basis.serving_unit) && basisWeight) {
    metric = toOption(basis, 'metric', basisWeight);
  } else if (basisWeight) {
    const metricRow = rows.find(
      (row) =>
        row.serving_unit.trim().toLowerCase() === basisWeight.metric_unit &&
        !row.serving_label?.trim()
    );
    if (metricRow) {
      metric = toOption(metricRow, 'metric', weightOf(metricRow));
    } else if (allowSynthesizedMetric) {
      const synthesized = toOption(basis, 'metric', basisWeight);
      metric = {
        ...synthesized,
        id: `${METRIC_OPTION_PREFIX}${basis.id}`,
        servingSize: basisWeight.metric_amount,
        servingUnit: basisWeight.metric_unit,
        servingOverride: {
          serving_size: basisWeight.metric_amount,
          serving_unit: basisWeight.metric_unit,
        },
      };
    }
  }

  const metricRowId = metric?.servingOverride ? null : metric?.variantId;
  const portions = rows
    .filter((row) => row.id !== metricRowId)
    .filter((row) => {
      if (!metric || row.serving_label?.trim()) return true;
      if (row.serving_unit.trim().toLowerCase() !== metric.servingUnit) {
        return true;
      }
      // A plain "50 g" row is just an amount in grams, unless it carries
      // nutrition of its own.
      return !isDerivedFromBasis(
        row as unknown as Parameters<typeof isDerivedFromBasis>[0],
        basis as unknown as Parameters<typeof isDerivedFromBasis>[1]
      );
    })
    .map((row) => toOption(row, 'portion', weightOf(row)));

  return metric ? [metric, ...portions] : portions;
}

/**
 * Converts an amount between two options through their weights, e.g.
 * 130 g → 1 Medium. Undefined when either weight is unknown.
 */
export function convertServingQuantity(
  quantity: number,
  from: Pick<ServingOption, 'servingSize' | 'weight'>,
  to: Pick<ServingOption, 'servingSize' | 'weight'>
): number | undefined {
  if (
    !(quantity > 0) ||
    !from.weight ||
    !to.weight ||
    from.weight.metric_unit !== to.weight.metric_unit ||
    !(from.servingSize > 0) ||
    !(to.weight.metric_amount > 0)
  ) {
    return undefined;
  }
  const amount = (quantity / from.servingSize) * from.weight.metric_amount;
  return (amount / to.weight.metric_amount) * to.servingSize;
}

export interface QuickAddServing {
  key: string;
  kind: 'last' | 'portion';
  option: ServingOption;
  /** Amount in the option's unit, as sent with the entry. */
  quantity: number;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function amountFor(option: ServingOption, quantity: number) {
  const servings = option.servingSize > 0 ? quantity / option.servingSize : 0;
  return {
    calories: option.calories * servings,
    protein: option.protein * servings,
    carbs: option.carbs * servings,
    fat: option.fat * servings,
  };
}

function lastServingTitle(option: ServingOption, quantity: number): string {
  if (option.kind === 'metric') {
    return formatLocalizedUnitQuantity(quantity, option.servingUnit, i18n.t);
  }
  const servings = option.servingSize > 0 ? quantity / option.servingSize : 1;
  if (Math.abs(servings - 1) < 1e-6) return option.label;
  return i18n.t('foodEntryAdd.quickAdd.multiplePortions', {
    defaultValue: '{{amount}} × {{portion}}',
    amount: formatServingSizeForDisplay(servings),
    portion: option.label,
  });
}

/**
 * Resolves the stored last serving against today's options. A deleted
 * portion with a known weight is offered in grams; anything that can no
 * longer be expressed is dropped rather than guessed.
 */
function resolveLastServing(
  lastServing: FoodLastServing,
  options: ServingOption[]
): { option: ServingOption; quantity: number } | null {
  const quantity = toNumber(lastServing.quantity);
  if (!(quantity > 0)) return null;
  const metric = options.find((option) => option.kind === 'metric');
  const unit = lastServing.unit.trim().toLowerCase();
  if (metric && unit === metric.servingUnit) {
    return { option: metric, quantity };
  }
  const byVariant = options.find(
    (option) =>
      option.kind === 'portion' && option.variantId === lastServing.variant_id
  );
  if (byVariant && unit === byVariant.servingUnit.trim().toLowerCase()) {
    return { option: byVariant, quantity };
  }
  const servingSize = toNumber(lastServing.serving_size);
  const weight = toNumber(lastServing.metric_amount);
  if (
    metric?.weight &&
    servingSize > 0 &&
    weight > 0 &&
    lastServing.metric_unit === metric.weight.metric_unit
  ) {
    const grams = (quantity / servingSize) * weight;
    return {
      option: metric,
      quantity: (grams / metric.weight.metric_amount) * metric.servingSize,
    };
  }
  return null;
}

/**
 * Quick-add rows below the amount fields: the last serving first, then one
 * of each saved portion in the user's order. A portion equal to the last
 * serving appears once, as the last serving.
 */
export function buildQuickAddServings(
  options: ServingOption[],
  lastServing: FoodLastServing | null | undefined
): QuickAddServing[] {
  const rows: QuickAddServing[] = [];
  const last = lastServing ? resolveLastServing(lastServing, options) : null;
  if (last) {
    rows.push({
      key: 'last',
      kind: 'last',
      option: last.option,
      quantity: last.quantity,
      title: lastServingTitle(last.option, last.quantity),
      ...amountFor(last.option, last.quantity),
    });
  }
  for (const option of options) {
    if (option.kind !== 'portion') continue;
    if (
      last &&
      last.option.id === option.id &&
      Math.abs(last.quantity - option.servingSize) < 1e-6
    ) {
      continue;
    }
    rows.push({
      key: option.id,
      kind: 'portion',
      option,
      quantity: option.servingSize,
      title: option.label,
      ...amountFor(option, option.servingSize),
    });
  }
  return rows;
}
