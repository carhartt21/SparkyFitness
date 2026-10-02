import { MICRONUTRIENT_SYNC_ENABLED } from './micronutrientFeature';
import {
  convertCatalogNutrientAmount,
  getMicronutrientById,
  NATIVE_MICRONUTRIENT_MAPPINGS,
} from '@workspace/shared';
import type { UserCustomNutrient } from '../api/customNutrientsApi';
import type { FoodEntry } from '../../types/foodEntries';

/** Convert a consumed snapshot using its bound definition's actual storage unit. */
export function micronutrientWriteback(
  entry: FoodEntry,
  definitions: readonly UserCustomNutrient[]
) {
  if (!MICRONUTRIENT_SYNC_ENABLED || !(entry.serving_size > 0)) return [];
  return definitions.flatMap((definition) => {
    if (!definition.catalog_id) return [];
    const catalog = getMicronutrientById(definition.catalog_id);
    const mapping = NATIVE_MICRONUTRIENT_MAPPINGS.find(
      (item) => item.catalogId === definition.catalog_id
    );
    if (!catalog || catalog.fixedField || !mapping) return [];
    const raw = entry.custom_nutrients?.[definition.name];
    if (raw === undefined || raw === '' || raw === null) return [];
    const amount = convertCatalogNutrientAmount(
      catalog.id,
      Number(raw),
      definition.unit,
      'g'
    );
    const consumed =
      amount === null ? null : (amount * entry.quantity) / entry.serving_size;
    if (consumed === null || !Number.isFinite(consumed) || consumed < 0)
      return [];
    return [{ ...mapping, amount: consumed }];
  });
}
