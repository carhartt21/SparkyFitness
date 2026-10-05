import { formatLocalizedNumber } from '../localization';
import type { WaterContainer } from '../types/measurements';

/** State what one tap logs in the linked drink's own unit, without invented ml. */
export function linkedWaterPressLabel(container?: WaterContainer) {
  if (!container?.linked_food_id) return undefined;
  const quantity = Number(container.linked_quantity ?? 1);
  const unit = container.linked_variant_serving_unit || '';
  const name = container.linked_food_name || '';
  if (!unit || !Number.isFinite(quantity) || quantity <= 0) return name;
  const amount = `${formatLocalizedNumber(quantity, { maximumFractionDigits: 2 })} ${unit}`;
  return name ? `${amount} · ${name}` : amount;
}

export function waterPresetOptions(presets: WaterContainer[]) {
  return presets.map((preset) => {
    const quantity = Number(preset.linked_quantity ?? 1);
    const unit = preset.linked_variant_serving_unit || '';
    return {
      id: preset.id,
      name: preset.linked_food_name || preset.name,
      pressLabel:
        unit && Number.isFinite(quantity) && quantity > 0
          ? `${formatLocalizedNumber(quantity, { maximumFractionDigits: 2 })} ${unit}`
          : undefined,
    };
  });
}
