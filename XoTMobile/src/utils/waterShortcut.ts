import type { TFunction } from 'i18next';
import type { WaterContainer } from '../types/measurements';
import { formatLocalizedUnitQuantity } from './foodUnitLocalization';
import {
  formatVolumeForUnit,
  getServingVolume,
  volumeFromMl,
  WATER_UNIT_LABELS,
} from './unitConversions';

/** Presentation comes from the exact active container used by the logging hook. */
export function waterShortcut(
  container: WaterContainer | undefined,
  unit: string,
  t: TFunction
) {
  if (!container) return undefined;
  const volume = getServingVolume(container);
  const quantity = Number(container.linked_quantity ?? 1);
  const servingUnit = container.linked_variant_serving_unit;
  const amount =
    volume !== null && Number.isFinite(volume) && volume > 0
      ? `${formatVolumeForUnit(volumeFromMl(volume, unit), unit)} ${WATER_UNIT_LABELS[unit] ?? 'ml'}`
      : container.linked_food_id &&
          servingUnit &&
          Number.isFinite(quantity) &&
          quantity > 0
        ? formatLocalizedUnitQuantity(quantity, servingUnit, t)
        : t('dashboard.waterShortcutLinkedDrink', {
            defaultValue: 'Linked drink',
          });
  return {
    label: container.name,
    sublabel: amount,
    accessibilityLabel: t('dashboard.waterShortcutAdd', {
      defaultValue: 'Log water: {{container}}, {{amount}} per tap',
      container: container.name,
      amount,
    }),
  };
}
