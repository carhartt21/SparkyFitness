import {
  summarizeDailyProgressItems,
  type DailyProgress,
} from '@workspace/shared';

/** A supplement response saved on this device but not yet confirmed. */
export interface LocalSupplementResponse {
  scheduleId: string;
  status: 'taken' | 'skipped';
  occurredAt: string;
}

/**
 * Applies local, not-yet-synced supplement responses to the server's Daily
 * Progress so a dose answered offline (e.g. from a reminder) counts at once.
 * Only explicit local records are applied; nothing is inferred.
 */
export function overlayLocalSupplementResponses(
  progress: DailyProgress,
  responses: readonly LocalSupplementResponse[]
): DailyProgress {
  if (responses.length === 0) return progress;
  const bySchedule = new Map(
    responses.map((response) => [response.scheduleId, response])
  );
  const items = progress.items.map((item) => {
    const response =
      item.domain === 'supplement' && item.reference_id
        ? bySchedule.get(item.reference_id)
        : undefined;
    if (!response) return item;
    const taken = response.status === 'taken';
    return {
      ...item,
      state: taken ? ('complete' as const) : ('excluded' as const),
      applicable: taken,
      recorded_at: response.occurredAt,
      reason: taken ? 'dose_taken_pending_sync' : 'dose_skipped_pending_sync',
    };
  });
  return summarizeDailyProgressItems(progress.date, items, progress.version);
}
