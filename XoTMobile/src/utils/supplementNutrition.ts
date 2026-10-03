import {
  MACRO_PICKER_FIELDS,
  MICRONUTRIENT_CATALOG,
  NATIVE_MICRONUTRIENT_MAPPINGS,
  convertCatalogNutrientAmount,
} from '@workspace/shared';
import type { UserCustomNutrient } from '../services/api/customNutrientsApi';

export type SupplementNutrition = Record<
  string,
  number | Record<string, number>
>;
export interface SupplementNutrientField {
  key: string;
  unit: string;
  defaultLabel: string;
  catalogId?: string;
}

export const SUPPLEMENT_FIXED_FIELDS: SupplementNutrientField[] = [
  ...MACRO_PICKER_FIELDS.map((field) => ({
    key: field.fieldKey,
    unit: field.unit,
    defaultLabel: field.shortLabel,
  })),
  ...MICRONUTRIENT_CATALOG.filter((entry) => entry.fixedField).map((entry) => ({
    key: entry.fixedField!,
    unit: entry.id === 'water' ? 'ml' : entry.unit,
    defaultLabel: entry.displayName,
  })),
  { key: 'saturated_fat', unit: 'g', defaultLabel: 'Saturated fat' },
  {
    key: 'polyunsaturated_fat',
    unit: 'g',
    defaultLabel: 'Polyunsaturated fat',
  },
  {
    key: 'monounsaturated_fat',
    unit: 'g',
    defaultLabel: 'Monounsaturated fat',
  },
  { key: 'trans_fat', unit: 'g', defaultLabel: 'Trans fat' },
  { key: 'cholesterol', unit: 'mg', defaultLabel: 'Cholesterol' },
  { key: 'sugars', unit: 'g', defaultLabel: 'Sugars' },
  { key: 'water_ml', unit: 'ml', defaultLabel: 'Water' },
].filter(
  (field, index, all) =>
    all.findIndex((other) => other.key === field.key) === index
);

export const SUPPLEMENT_NATIVE_FIELDS: (SupplementNutrientField & {
  catalogId: string;
})[] = NATIVE_MICRONUTRIENT_MAPPINGS.flatMap((mapping) => {
  const catalog = MICRONUTRIENT_CATALOG.find(
    (entry) => entry.id === mapping.catalogId
  );
  return catalog && !catalog.fixedField
    ? [
        {
          key: `catalog:${catalog.id}`,
          catalogId: catalog.id,
          unit: catalog.unit,
          defaultLabel: catalog.displayName,
        },
      ]
    : [];
});

/** Only a retained identity or exact canonical name selects an editable native row. */
export function supplementDefinition(
  catalogId: string,
  definitions: readonly UserCustomNutrient[]
) {
  const catalog = MICRONUTRIENT_CATALOG.find(
    (entry) => entry.id === catalogId
  )!;
  return (
    definitions.find((entry) => entry.catalog_id === catalogId) ??
    definitions.find(
      (entry) => !entry.catalog_id && entry.name === catalog.displayName
    )
  );
}

export function supplementNutritionDraft(
  nutrition: SupplementNutrition | null | undefined,
  definitions: readonly UserCustomNutrient[]
) {
  const draft: Record<string, string> = {};
  for (const field of SUPPLEMENT_FIXED_FIELDS) {
    const value = nutrition?.[field.key];
    if (typeof value === 'number') draft[field.key] = String(value);
  }
  const custom = nutrition?.custom_nutrients;
  if (custom && typeof custom === 'object') {
    for (const field of SUPPLEMENT_NATIVE_FIELDS) {
      const name =
        supplementDefinition(field.catalogId, definitions)?.name ??
        field.defaultLabel;
      const value = custom[name];
      if (typeof value === 'number') draft[field.key] = String(value);
    }
  }
  return draft;
}

/** Validate before provisioning; omitted/blank amounts remain unknown. */
export function parseSupplementNutritionDraft(draft: Record<string, string>) {
  const values: Record<string, number> = {};
  for (const field of [
    ...SUPPLEMENT_FIXED_FIELDS,
    ...SUPPLEMENT_NATIVE_FIELDS,
  ]) {
    const raw = draft[field.key]?.trim();
    if (!raw) continue;
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0)
      throw new Error('Invalid nutrient amount');
    values[field.key] = value;
  }
  return values;
}

export function applySupplementNutritionDraft(
  values: Record<string, number>,
  previous: SupplementNutrition | null | undefined,
  definitions: readonly UserCustomNutrient[],
  resolved: readonly { catalogId: string; name: string; fixedField?: string }[],
  currentDefinitions: readonly UserCustomNutrient[] = definitions
): SupplementNutrition {
  const nutrition: SupplementNutrition = { ...previous };
  const custom = {
    ...(typeof previous?.custom_nutrients === 'object'
      ? previous.custom_nutrients
      : {}),
  };
  for (const field of SUPPLEMENT_FIXED_FIELDS) {
    delete nutrition[field.key];
    if (values[field.key] !== undefined)
      nutrition[field.key] = values[field.key];
  }
  for (const field of SUPPLEMENT_NATIVE_FIELDS) {
    const oldDefinition = supplementDefinition(field.catalogId, definitions);
    const oldName = oldDefinition?.name ?? field.defaultLabel;
    delete custom[oldName];
    const value = values[field.key];
    if (value === undefined) continue;
    const target = resolved.find(
      (entry) => entry.catalogId === field.catalogId
    );
    const targetDefinition = currentDefinitions.find(
      (entry) => entry.name === target?.name
    );
    if (
      !target ||
      !targetDefinition ||
      targetDefinition.catalog_id !== field.catalogId
    )
      throw new Error('Unresolved nutrient definition');
    const converted = convertCatalogNutrientAmount(
      field.catalogId,
      value,
      oldDefinition?.unit ?? field.unit,
      targetDefinition.unit
    );
    if (converted === null) throw new Error('Incompatible nutrient unit');
    custom[target.name] = converted;
  }
  if (Object.keys(custom).length) nutrition.custom_nutrients = custom;
  else delete nutrition.custom_nutrients;
  return nutrition;
}
