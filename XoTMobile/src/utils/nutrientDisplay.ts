import { normalizeNutrientName } from '@workspace/shared';
import { formatLocalizedNumber } from '../localization';
import type { UserCustomNutrient } from '../services/api/customNutrientsApi';

export interface CustomNutrientDisplayRow {
  label: string;
  value: number | null;
  unit: string;
}

/** Missing/qualified/invalid amounts remain unknown; numeric zero is measured. */
function knownAmount(raw: unknown): number | null {
  if (
    typeof raw === 'string' &&
    !/^\s*[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)\s*$/.test(raw)
  )
    return null;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const value =
    typeof raw === 'number' ? raw : Number(raw.trim().replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** One row per stored identity; do not infer units or collapse nutrient snapshots. */
export function buildCustomNutrientRows(
  values: Record<string, string | number> | null | undefined,
  definitions: readonly UserCustomNutrient[]
): CustomNutrientDisplayRow[] {
  const rows: CustomNutrientDisplayRow[] = definitions.map((definition) => ({
    label: definition.name,
    value: knownAmount(values?.[definition.name]),
    unit: definition.unit,
  }));
  const knownNames = new Set(definitions.map((definition) => definition.name));
  for (const [name, raw] of Object.entries(values ?? {})) {
    if (knownNames.has(name)) continue;
    // Aliases can supply an existing definition's unit only when that alias
    // identifies one definition unambiguously. Never borrow an FDA goal/unit.
    const matches = definitions.filter(
      (definition) =>
        normalizeNutrientName(definition.name) === normalizeNutrientName(name)
    );
    rows.push({
      label: name,
      value: knownAmount(raw),
      unit: matches.length === 1 ? matches[0].unit : '',
    });
  }
  return rows;
}

export function formatNutrientAmount(
  value: number | null | undefined,
  unit: string,
  servings = 1
): string {
  if (
    value == null ||
    !Number.isFinite(value) ||
    !Number.isFinite(servings) ||
    servings < 0
  )
    return '—';
  const amount = value * servings;
  if (!Number.isFinite(amount) || amount < 0) return '—';
  const text =
    amount > 0 && amount < 0.001
      ? `<${formatLocalizedNumber(0.001, { maximumFractionDigits: 3 })}`
      : formatLocalizedNumber(amount, { maximumFractionDigits: 3 });
  return unit ? `${text} ${unit === 'mcg' ? 'µg' : unit}` : text;
}
