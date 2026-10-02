import { useMemo } from 'react';
import { useDailyProgress } from './useDailyTracking';
import { useMedicationEntries } from './useMedications';
import { usePlannedSupplementActions } from './usePlannedSupplementActions';
import { activeLocalSupplementStatus } from '../utils/medications';
import {
  overlayLocalSupplementResponses,
  type LocalSupplementResponse,
} from '../utils/dailyProgressOverlay';

/** Dashboard and breakdown share the same unresolved local intake overlay. */
export function useProjectedDailyProgress(date: string, enabled: boolean) {
  const query = useDailyProgress(date, { enabled });
  const entries = useMedicationEntries({
    fromDate: date,
    toDate: date,
    enabled,
  });
  const { bySchedule } = usePlannedSupplementActions(date, entries.data);
  const progress = useMemo(() => {
    if (!query.data) return null;
    const responses: LocalSupplementResponse[] = [];
    for (const [scheduleId, action] of bySchedule) {
      const status = activeLocalSupplementStatus(action);
      if (status && action.syncState !== 'synced')
        responses.push({ scheduleId, status, occurredAt: action.occurredAt });
    }
    return overlayLocalSupplementResponses(query.data, responses);
  }, [query.data, bySchedule]);
  return { ...query, progress };
}
