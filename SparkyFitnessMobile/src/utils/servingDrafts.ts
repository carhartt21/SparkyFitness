import {
  isDerivedFromBasis,
  isMetricInputUnit,
  metricWeightOf,
  portionFactor,
  scaleServingNutrition,
  servingWeightOf,
  type MetricUnit,
  type PortionNutrition,
  type SaveFoodServingsBody,
  type ServingWeight,
  type WeightedRow,
} from '@workspace/shared';
import type { FoodVariantDetail } from '../types/foods';
import { parseDecimalInput } from './numericInput';
import { formatServingSizeDisplay } from './foodDetails';

/** One editable row of the Edit Food "Serving sizes" list. */
export interface ServingDraft {
  /** Stable React/drag key; the variant id for saved rows. */
  key: string;
  id?: string;
  label: string;
  amountText: string;
  unit: string;
  /** Weight of one serving in the basis's metric unit, as typed. */
  weightText: string;
  /** Loaded with nutrition of its own (never recalculated unless re-weighed). */
  ownNutrition: boolean;
  /** The user changed amount, unit or weight of an own-nutrition row. */
  reweighed: boolean;
}

export type ServingDraftError = 'amount' | 'unit' | 'weight' | 'duplicate';

/** The food's nutrition basis as the editor sees it (possibly unsaved). */
export interface ServingBasis extends PortionNutrition {
  serving_size: number;
  serving_unit: string;
  metric_amount?: number | null;
  metric_unit?: MetricUnit | null;
}

let draftCounter = 0;
export function newDraftKey(): string {
  draftCounter += 1;
  return `new-serving-${draftCounter}`;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return n === null ? '' : formatServingSizeDisplay(n);
}

/** The basis's weight in g/ml, or null when unknown. */
export function basisWeight(basis: WeightedRow | null | undefined) {
  return basis ? servingWeightOf(basis) : null;
}

/** Editable rows for every saved portion, in the user's order. */
export function draftsFromVariants(
  variants: FoodVariantDetail[] | undefined,
  basisId: string | undefined
): ServingDraft[] {
  const basis = variants?.find((variant) => variant.id === basisId);
  return (variants ?? [])
    .map((variant, index) => ({ variant, index }))
    .filter(({ variant }) => variant.id !== basisId)
    .sort(
      (a, b) =>
        (a.variant.sort_order ?? 0) - (b.variant.sort_order ?? 0) ||
        a.index - b.index
    )
    .map(({ variant }) => {
      const weight = servingWeightOf(variant);
      const own = basis
        ? !isDerivedFromBasis(
            variant as unknown as PortionNutrition & WeightedRow,
            basis as unknown as PortionNutrition & WeightedRow
          )
        : true;
      return {
        key: variant.id,
        id: variant.id,
        label: variant.serving_label ?? '',
        amountText: formatNumber(variant.serving_size),
        unit: variant.serving_unit,
        weightText:
          weight && !isMetricInputUnit(variant.serving_unit)
            ? formatNumber(weight.metric_amount)
            : '',
        ownNutrition: own,
        reweighed: false,
      };
    });
}

/** A typed number, or null for blank/invalid text (so blanks compare equal). */
function typedNumber(text: string): number | null {
  const n = parseDecimalInput(text);
  return Number.isFinite(n) ? n : null;
}

function sameDraft(a: ServingDraft, b: ServingDraft): boolean {
  return (
    a.key === b.key &&
    a.label.trim() === b.label.trim() &&
    typedNumber(a.amountText) === typedNumber(b.amountText) &&
    a.unit.trim() === b.unit.trim() &&
    typedNumber(a.weightText) === typedNumber(b.weightText)
  );
}

/** True when the list differs in content or order from what was saved. */
export function draftsDiffer(
  current: ServingDraft[],
  baseline: ServingDraft[]
): boolean {
  if (current.length !== baseline.length) return true;
  return current.some((draft, index) => !sameDraft(draft, baseline[index]));
}

/** The weight a draft states or implies ("50 g" weighs 50 g). */
export function draftWeight(
  draft: ServingDraft,
  basis: ServingBasis | null
): ServingWeight | null {
  const amount = parseDecimalInput(draft.amountText);
  const fromUnit = metricWeightOf(amount, draft.unit);
  if (fromUnit) return fromUnit;
  const stated = parseDecimalInput(draft.weightText);
  if (!(stated > 0)) return null;
  return {
    metric_amount: stated,
    metric_unit: basisWeight(basis)?.metric_unit ?? 'g',
  };
}

function draftAsRow(draft: ServingDraft, basis: ServingBasis | null) {
  const weight = draftWeight(draft, basis);
  return {
    serving_size: parseDecimalInput(draft.amountText),
    serving_unit: draft.unit,
    metric_amount: weight?.metric_amount ?? null,
    metric_unit: weight?.metric_unit ?? null,
  };
}

/** Whether saving will (re)calculate this row's nutrition from the basis. */
export function draftDerives(draft: ServingDraft): boolean {
  return !draft.ownNutrition || draft.reweighed;
}

/**
 * Per-row problems, keyed by draft key. A row whose nutrition is to be
 * calculated needs a weight, unless it uses the basis's own unit.
 */
export function validateServingDrafts(
  drafts: ServingDraft[],
  basis: ServingBasis | null
): Record<string, ServingDraftError> {
  const errors: Record<string, ServingDraftError> = {};
  const seen = new Set<string>();
  if (basis) {
    seen.add(
      `${Number(basis.serving_size)}|${basis.serving_unit.trim().toLowerCase()}|`
    );
  }
  for (const draft of drafts) {
    const amount = parseDecimalInput(draft.amountText);
    if (!(amount > 0)) {
      errors[draft.key] = 'amount';
      continue;
    }
    if (!draft.unit.trim()) {
      errors[draft.key] = 'unit';
      continue;
    }
    const key = `${amount}|${draft.unit.trim().toLowerCase()}|${draft.label
      .trim()
      .toLowerCase()}`;
    if (seen.has(key)) {
      errors[draft.key] = 'duplicate';
      continue;
    }
    seen.add(key);
    if (
      draftDerives(draft) &&
      (!basis || portionFactor(draftAsRow(draft, basis), basis) === null)
    ) {
      errors[draft.key] = 'weight';
    }
  }
  return errors;
}

/** Nutrition one serving of a draft will have after saving, when knowable. */
export function draftPreviewNutrition(
  draft: ServingDraft,
  basis: ServingBasis | null,
  stored: FoodVariantDetail | undefined
): Record<'calories' | 'protein' | 'carbs' | 'fat', number> | null {
  if (!draftDerives(draft) && stored) {
    const amount = parseDecimalInput(draft.amountText);
    const oldAmount = Number(stored.serving_size);
    const factor = oldAmount > 0 && amount > 0 ? amount / oldAmount : 1;
    return {
      calories: Number(stored.calories) * factor,
      protein: Number(stored.protein) * factor,
      carbs: Number(stored.carbs) * factor,
      fat: Number(stored.fat) * factor,
    };
  }
  if (!basis) return null;
  const factor = portionFactor(draftAsRow(draft, basis), basis);
  if (factor === null || !(factor > 0)) return null;
  const scaled = scaleServingNutrition(basis, factor);
  return {
    calories: scaled.calories ?? 0,
    protein: scaled.protein ?? 0,
    carbs: scaled.carbs ?? 0,
    fat: scaled.fat ?? 0,
  };
}

/** Request body for PUT /api/foods/:foodId/servings. */
export function buildSaveServingsBody({
  drafts,
  baseline,
  basis,
  basisWeightText,
  basisWeightUnit,
  basisWeightChanged,
  confirmCascade,
}: {
  drafts: ServingDraft[];
  baseline: ServingDraft[];
  basis: ServingBasis | null;
  basisWeightText: string;
  basisWeightUnit: MetricUnit;
  basisWeightChanged: boolean;
  confirmCascade?: boolean;
}): SaveFoodServingsBody {
  const keptIds = new Set(drafts.map((draft) => draft.id).filter(Boolean));
  const body: SaveFoodServingsBody = {
    servings: drafts.map((draft, index) => {
      const weight = draftWeight(draft, basis);
      return {
        ...(draft.id ? { id: draft.id } : {}),
        serving_label: draft.label.trim() || null,
        serving_size: parseDecimalInput(draft.amountText),
        serving_unit: draft.unit.trim(),
        metric_amount:
          weight &&
          !metricWeightOf(parseDecimalInput(draft.amountText), draft.unit)
            ? weight.metric_amount
            : null,
        sort_order: index,
        derive: draftDerives(draft),
      };
    }),
    deleted_ids: baseline
      .map((draft) => draft.id)
      .filter((id): id is string => !!id && !keptIds.has(id)),
  };
  if (basisWeightChanged) {
    const amount = parseDecimalInput(basisWeightText);
    body.basis_metric_amount = amount > 0 ? amount : null;
    body.basis_metric_unit = basisWeightUnit;
  }
  if (confirmCascade) body.confirm_cascade = true;
  return body;
}
