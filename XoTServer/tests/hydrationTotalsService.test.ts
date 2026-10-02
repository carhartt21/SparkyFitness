import { vi, beforeEach, describe, expect, it } from 'vitest';
import hydrationTotalsService, {
  getHydrationDayDetails,
} from '../services/hydrationTotalsService.js';
import {
  getHydrationSourceEntries,
  getHydrationSourceTotals,
} from '../models/hydrationSourceRepository.js';
vi.mock('../models/hydrationSourceRepository.js');
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: async () => 'Europe/Berlin',
}));
const totals = {
  water_ml: 1250,
  manual_ml: 250,
  ledger_ml: 250,
  food_ml: 1000,
  drink_ml: 500,
  supplement_ml: 500,
  solid_food_ml: 160,
  unknown_count: 1,
};
describe('hydration totals', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses the unified drink total independently of the obsolete food-water preference', async () => {
    vi.mocked(getHydrationSourceTotals).mockResolvedValue([
      { entry_date: '2026-10-02', ...totals },
    ]);
    expect(
      await hydrationTotalsService.resolveWaterTotalsForDate(
        'u',
        'u',
        '2026-10-02'
      )
    ).toMatchObject(totals);
  });
  it('preserves the acting identity for delegated RLS reads', async () => {
    vi.mocked(getHydrationSourceTotals).mockResolvedValue([]);
    await hydrationTotalsService.resolveWaterTotalsForDate(
      'owner',
      'delegate',
      '2026-10-02'
    );
    expect(getHydrationSourceTotals).toHaveBeenCalledWith(
      'owner',
      '2026-10-02',
      '2026-10-02',
      'delegate'
    );
  });
  it('returns zero recorded intake for an empty day', async () => {
    vi.mocked(getHydrationSourceTotals).mockResolvedValue([]);
    expect(
      await hydrationTotalsService.resolveWaterTotalsForDate(
        'u',
        'u',
        '2026-10-02'
      )
    ).toMatchObject({ water_ml: 0 });
  });
  it('does not turn a failed source query into zero intake', async () => {
    vi.mocked(getHydrationSourceTotals).mockRejectedValue(
      new Error('unavailable')
    );
    await expect(
      hydrationTotalsService.resolveWaterTotalsForDate('u', 'u', '2026-10-02')
    ).rejects.toThrow('unavailable');
  });
  it('builds details and totals from the same read, keeping unknown content unknown', async () => {
    vi.mocked(getHydrationSourceEntries).mockResolvedValue([
      {
        id: 'f',
        entry_date: '2026-10-02',
        kind: 'food',
        name: 'Unknown',
        water_ml: null,
        logged_at: null,
        source: 'manual',
        water_entry_id: null,
        food_entry_id: 'f',
        medication_id: null,
        amount_basis: 'unknown',
        counts_toward_goal: false,
      },
    ]);
    const result = await getHydrationDayDetails('u', '2026-10-02');
    expect(result.totals).toMatchObject({ water_ml: 0, unknown_count: 1 });
    expect(result.entries[0]?.water_ml).toBeNull();
    expect(getHydrationSourceTotals).not.toHaveBeenCalled();
  });
});
