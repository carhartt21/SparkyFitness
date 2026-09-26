import { foodVolumeToMl } from '@workspace/shared';
import type { VariantNutritionSource } from './foodEntrySnapshot.js';

interface ContainerWaterSource {
  volume: number | string;
  servings_per_container: number | string;
  hydration_factor: number | string | null;
  linked_food_id: string | null;
  linked_quantity: number | string | null;
}

/** One press, using the same volume precedence for legacy and retried actions. */
export function containerPressWaterMl(
  container: ContainerWaterSource,
  linkedVariant: VariantNutritionSource | null
): number {
  const servings = Math.max(1, Number(container.servings_per_container) || 1);
  const amountPerDrink = Number(container.volume) / servings;
  if (!linkedVariant) return amountPerDrink;

  const hydrationFactor =
    container.hydration_factor === null
      ? 1
      : Number(container.hydration_factor);
  if (Number(container.volume) > 0 && container.linked_food_id) {
    return amountPerDrink * hydrationFactor;
  }

  const linkedQuantity =
    Number(container.linked_quantity) > 0
      ? Number(container.linked_quantity)
      : 1;
  const explicitWater = Number(linkedVariant.water_ml);
  if (Number.isFinite(explicitWater) && explicitWater > 0) {
    const servingSize = Number(linkedVariant.serving_size) || 0;
    const consumedWater =
      servingSize > 0
        ? (explicitWater * linkedQuantity) / servingSize
        : explicitWater;
    return consumedWater * hydrationFactor;
  }

  const volume = foodVolumeToMl(
    linkedQuantity,
    linkedVariant.serving_unit || ''
  );
  return (volume ?? amountPerDrink) * hydrationFactor;
}
