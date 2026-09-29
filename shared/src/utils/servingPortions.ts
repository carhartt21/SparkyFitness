import { FOOD_VARIANT_NUTRIENT_FIELDS } from "../constants/foodVariantNutrients.ts";

/**
 * Saved serving portions ("Medium (130 g)", "1 cup (245 g)") and the
 * nutrition basis they are derived from.
 *
 * Nutrition stays stored per food_variants row. A portion with a known weight
 * gets its values derived from the basis row on save, so every reader keeps
 * reading one row's stored values. Nothing here is ever applied to a row the
 * user has not asked to recalculate.
 */

export type MetricUnit = "g" | "ml";

export interface ServingWeight {
  metric_amount: number;
  metric_unit: MetricUnit;
}

// Only units with an exact metric factor. Household measures (cup, tbsp) and
// fluid ounces are volumes whose weight depends on the food, so a portion in
// those units needs the user to state its weight.
const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  mg: 0.001,
  oz: 28.3495,
  lb: 453.592,
  lbs: 453.592,
};
const ML_PER_UNIT: Record<string, number> = {
  ml: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
};

/** Nutrients scaled with the amount. Concentrations (abv, GI) are not. */
export const PORTION_SCALED_FIELDS = [
  ...FOOD_VARIANT_NUTRIENT_FIELDS,
  "water_ml",
] as const;

export type PortionScaledField = (typeof PORTION_SCALED_FIELDS)[number];

type NumericLike = number | string | null | undefined;

export type PortionNutrition = Partial<
  Record<PortionScaledField, NumericLike>
> & {
  custom_nutrients?: Record<string, NumericLike> | null | unknown;
};

function toNumber(value: NumericLike): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundNutrient(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** The g/ml weight of `size unit` when the unit has an exact metric factor. */
export function metricWeightOf(
  servingSize: NumericLike,
  servingUnit: string | null | undefined,
): ServingWeight | null {
  const size = toNumber(servingSize);
  const unit = servingUnit?.trim().toLowerCase() ?? "";
  if (size === null || size <= 0) return null;
  const grams = GRAMS_PER_UNIT[unit];
  if (grams !== undefined) {
    return { metric_amount: roundNutrient(size * grams), metric_unit: "g" };
  }
  const ml = ML_PER_UNIT[unit];
  if (ml !== undefined) {
    return { metric_amount: roundNutrient(size * ml), metric_unit: "ml" };
  }
  return null;
}

/** True when the unit itself is grams or millilitres (the metric input unit). */
export function isMetricInputUnit(unit: string | null | undefined): boolean {
  const normalized = unit?.trim().toLowerCase();
  return normalized === "g" || normalized === "ml";
}

export interface WeightedRow {
  serving_size: NumericLike;
  serving_unit: string;
  metric_amount?: NumericLike;
  metric_unit?: string | null;
}

/** A row's stated weight, falling back to its unit when that is metric. */
export function servingWeightOf(row: WeightedRow): ServingWeight | null {
  const amount = toNumber(row.metric_amount);
  const unit = row.metric_unit?.trim().toLowerCase();
  if (amount !== null && amount > 0 && (unit === "g" || unit === "ml")) {
    return { metric_amount: amount, metric_unit: unit };
  }
  return metricWeightOf(row.serving_size, row.serving_unit);
}

export type ScaledPortionNutrition = Record<
  PortionScaledField,
  number | null
> & {
  custom_nutrients: Record<string, number>;
};

/** Every amount-dependent nutrient of `basis` multiplied by `factor`. */
export function scaleServingNutrition(
  basis: PortionNutrition,
  factor: number,
): ScaledPortionNutrition {
  if (!(factor > 0) || !Number.isFinite(factor)) {
    throw new Error("A serving can only be scaled by a positive factor.");
  }
  const derived = {} as Record<PortionScaledField, number | null>;
  for (const field of PORTION_SCALED_FIELDS) {
    const value = toNumber(basis[field]);
    derived[field] = value === null ? null : roundNutrient(value * factor);
  }
  const custom: Record<string, number> = {};
  const basisCustom =
    basis.custom_nutrients && typeof basis.custom_nutrients === "object"
      ? (basis.custom_nutrients as Record<string, NumericLike>)
      : {};
  for (const [key, raw] of Object.entries(basisCustom)) {
    const value = toNumber(raw);
    if (value !== null) custom[key] = roundNutrient(value * factor);
  }
  return { ...derived, custom_nutrients: custom };
}

/**
 * Nutrition for a portion weighing `portionAmount` of the basis's metric
 * unit. Missing basis values stay missing (null), never zero.
 */
export function deriveServingNutrition(
  basis: PortionNutrition & WeightedRow,
  portionAmount: number,
): ScaledPortionNutrition {
  const basisWeight = servingWeightOf(basis);
  if (!basisWeight || !(portionAmount > 0)) {
    throw new Error("A portion can only be derived from a weighed basis.");
  }
  return scaleServingNutrition(
    basis,
    portionAmount / basisWeight.metric_amount,
  );
}

/**
 * How many basis servings one `size unit` portion holds, or null when that
 * cannot be known: either both are weighed in the same metric unit, or the
 * portion uses the basis's own unit ("½ serving" of "1 serving").
 */
export function portionFactor(
  portion: WeightedRow,
  basis: WeightedRow,
): number | null {
  const portionWeight = servingWeightOf(portion);
  const basisWeight = servingWeightOf(basis);
  if (
    portionWeight &&
    basisWeight &&
    portionWeight.metric_unit === basisWeight.metric_unit
  ) {
    return portionWeight.metric_amount / basisWeight.metric_amount;
  }
  const portionSize = toNumber(portion.serving_size);
  const basisSize = toNumber(basis.serving_size);
  if (
    portionSize !== null &&
    basisSize !== null &&
    basisSize > 0 &&
    portion.serving_unit.trim().toLowerCase() ===
      basis.serving_unit.trim().toLowerCase()
  ) {
    return portionSize / basisSize;
  }
  return null;
}

/**
 * Whether a row's stored nutrition equals what the basis would give it, so
 * recalculating it changes nothing. Rows that fail this carry their own
 * nutrition (older imports) and are never recalculated silently.
 */
export function isDerivedFromBasis(
  row: PortionNutrition & WeightedRow,
  basis: PortionNutrition & WeightedRow,
  tolerance = 0.02,
): boolean {
  const factor = portionFactor(row, basis);
  if (factor === null || !(factor > 0)) return false;
  const expected = scaleServingNutrition(basis, factor);
  for (const field of ["calories", "protein", "carbs", "fat"] as const) {
    const actual = toNumber(row[field]) ?? 0;
    const want = expected[field] ?? 0;
    const scale = Math.max(Math.abs(want), 1);
    if (Math.abs(actual - want) / scale > tolerance) return false;
  }
  return true;
}
