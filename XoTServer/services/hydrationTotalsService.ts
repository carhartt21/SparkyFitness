import type {
  HydrationDayDetails,
  HydrationSourceTotals,
  HydrationSourceEntry,
} from '@workspace/shared';
import {
  getHydrationSourceEntries,
  getHydrationSourceTotals,
} from '../models/hydrationSourceRepository.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';

const EMPTY_TOTALS: HydrationSourceTotals = {
  water_ml: 0,
  manual_ml: 0,
  ledger_ml: 0,
  food_ml: 0,
  exportable_food_ml: 0,
  drink_ml: 0,
  supplement_ml: 0,
  solid_food_ml: 0,
  unknown_count: 0,
};

/** Drinks count; solid-food water is informational. Repository failures must not become zero. */
async function resolveWaterTotalsForDate(
  targetUserId: string,
  actingUserId: string,
  date: string
): Promise<
  Pick<
    HydrationSourceTotals,
    'water_ml' | 'manual_ml' | 'ledger_ml' | 'food_ml' | 'exportable_food_ml'
  >
> {
  const rows = await getHydrationSourceTotals(
    targetUserId,
    date,
    date,
    actingUserId
  );
  return rows[0] ?? { ...EMPTY_TOTALS };
}

export function summarizeHydrationEntries(
  entries: HydrationSourceEntry[]
): HydrationSourceTotals {
  const totals = { ...EMPTY_TOTALS };
  for (const entry of entries) {
    if (entry.water_ml === null) {
      totals.unknown_count++;
      continue;
    }
    const ml = entry.water_ml;
    if (entry.counts_toward_goal) totals.water_ml += ml;
    const ledger =
      entry.kind === 'water' ||
      entry.kind === 'imported' ||
      entry.water_entry_id !== null;
    if (ledger) {
      totals.ledger_ml += ml;
      if (entry.source === 'manual') totals.manual_ml += ml;
    }
    if (
      (entry.kind === 'drink' || entry.kind === 'supplement') &&
      entry.water_entry_id === null
    ) {
      totals.food_ml += ml;
      if (entry.source === 'manual' || entry.source === null)
        totals.exportable_food_ml = (totals.exportable_food_ml ?? 0) + ml;
    }
    if (entry.kind === 'drink') totals.drink_ml += ml;
    if (entry.kind === 'supplement') totals.supplement_ml += ml;
    if (entry.kind === 'food') totals.solid_food_ml += ml;
  }
  return totals;
}
export async function getHydrationDayDetails(
  userId: string,
  date: string
): Promise<HydrationDayDetails> {
  const [entries, timezone] = await Promise.all([
    getHydrationSourceEntries(userId, date),
    loadUserTimezone(userId),
  ]);
  return {
    date,
    timezone,
    totals: summarizeHydrationEntries(entries),
    entries,
  };
}

export { resolveWaterTotalsForDate };
export default { resolveWaterTotalsForDate };
