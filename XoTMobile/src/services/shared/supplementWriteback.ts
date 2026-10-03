import type { MedicationEntry } from '@workspace/shared';
import { FOOD_VARIANT_NUTRIENT_FIELDS } from '@workspace/shared';
import type { FoodEntry } from '../../types/foodEntries';

/** An export projection, never a fabricated diary food or a combined daily total. */
export type NutritionWritebackEntry = Omit<FoodEntry, 'calories'> & {
  calories?: number;
  writebackTimestamp?: string;
};

export function supplementWritebackEntries(
  entries: readonly MedicationEntry[],
  day: string
): NutritionWritebackEntry[] {
  return entries.flatMap((entry) => {
    if (
      entry.entry_date !== day ||
      !['taken', 'prn_taken'].includes(entry.status) ||
      entry.entry_type === 'injection' ||
      !entry.nutrients_snapshot ||
      ['health_connect', 'apple_health', 'Apple Health', 'HealthKit'].includes(
        entry.source
      )
    )
      return [];
    const dose = entry.dose_amount_snapshot ?? 1;
    const takenAt = new Date(entry.taken_at);
    if (
      !Number.isFinite(dose) ||
      dose <= 0 ||
      !Number.isFinite(takenAt.getTime())
    )
      return [];
    const snapshot = entry.nutrients_snapshot;
    const fixed: Partial<
      Record<(typeof FOOD_VARIANT_NUTRIENT_FIELDS)[number], number>
    > = {};
    for (const field of FOOD_VARIANT_NUTRIENT_FIELDS) {
      const value = snapshot[field];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
        fixed[field] = value;
    }
    const custom =
      snapshot.custom_nutrients &&
      typeof snapshot.custom_nutrients === 'object' &&
      !Array.isArray(snapshot.custom_nutrients)
        ? Object.fromEntries(
            Object.entries(snapshot.custom_nutrients).filter(
              ([, value]) => Number.isFinite(value) && value >= 0
            )
          )
        : {};
    return [
      {
        ...fixed,
        id: `supplement:${entry.id}`,
        food_name: entry.med_name_snapshot ?? '',
        entry_date: entry.entry_date,
        writebackTimestamp: takenAt.toISOString(),
        meal_type: '',
        quantity: dose,
        serving_size: 1,
        unit: entry.dose_unit_snapshot ?? '',
        custom_nutrients: custom,
      },
    ];
  });
}
