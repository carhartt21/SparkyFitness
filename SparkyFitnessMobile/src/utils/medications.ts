import type {
  MedicationDetail,
  MedicationEntry,
  SharedScheduleRule,
} from '@workspace/shared';
import type { PendingPlannedSupplementAction } from '../services/nutritionActionOutbox';

/** A scheduled dose slot on a given day, as produced by getDueDosesForDate. */
export interface DueDose {
  medication: MedicationDetail;
  schedule: SharedScheduleRule & { id: string };
}

/**
 * True when a logged entry belongs to the given dose slot.
 *
 * Entries logged without schedule attribution (e.g. from the web app) count
 * for any of the medication's scheduled doses, except PRN logs, which never
 * cover a scheduled slot. A null scheduleId matches only the medication's
 * schedule-less entries.
 */
export function entryMatchesDose(
  entry: MedicationEntry,
  medicationId: string,
  scheduleId: string | null
): boolean {
  if (scheduleId) {
    if (entry.schedule_id === scheduleId) return true;
    return (
      entry.medication_id === medicationId &&
      !entry.schedule_id &&
      entry.status !== 'prn_taken'
    );
  }
  return entry.medication_id === medicationId && !entry.schedule_id;
}

export type DoseSlotStatus = 'pending' | 'taken' | 'skipped';

/** Maps a slot's matched entry (if any) to its display status. */
export function doseSlotStatus(
  entry: MedicationEntry | undefined
): DoseSlotStatus {
  if (entry?.status === 'taken' || entry?.status === 'prn_taken')
    return 'taken';
  if (entry?.status === 'skipped') return 'skipped';
  return 'pending';
}

/** True when the dose slot already has a terminal (taken or skipped) entry. */
export function isDoseLogged(
  entries: MedicationEntry[],
  medicationId: string,
  scheduleId: string | null
): boolean {
  return entries.some(
    (e) =>
      entryMatchesDose(e, medicationId, scheduleId) &&
      (e.status === 'taken' || e.status === 'skipped')
  );
}

/**
 * Status of a queued planned-supplement response that should still be shown
 * over the server's entries: pending or synced-but-not-yet-visible actions
 * count; ones needing attention, or removed on the server, do not.
 */
export function activeLocalSupplementStatus(
  local: PendingPlannedSupplementAction | undefined
): 'taken' | 'skipped' | null {
  if (!local || local.syncState === 'attentionRequired') return null;
  const removedOnServer =
    local.syncState === 'synced' &&
    local.serverIdentity === local.clientOperationId;
  return removedOnServer ? null : local.payload.status;
}
