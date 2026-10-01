import type { TFunction } from 'i18next';
import type { Medication, MedicationEntry } from '@/types/medications';

/** Labels follow explicit saved classification; names and prescriptions are not evidence. */
export function medicationKindLabel(
  medication: Pick<Medication, 'is_supplement'> | undefined,
  t: TFunction
): string {
  if (!medication) {
    return t('medications.kind.unknown', 'Category unavailable');
  }
  return medication.is_supplement === true
    ? t('medications.kind.supplement', 'Supplement')
    : t('medications.kind.medication', 'Medication');
}

/** Retained supplement snapshots still identify intake after deletion/reclassification. */
export function medicationEntryKindLabel(
  entry: Pick<MedicationEntry, 'nutrients_snapshot'>,
  medication: Pick<Medication, 'is_supplement'> | undefined,
  t: TFunction
): string {
  return medicationKindLabel(
    entry.nutrients_snapshot != null ? { is_supplement: true } : medication,
    t
  );
}
