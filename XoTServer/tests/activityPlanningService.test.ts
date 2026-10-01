import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { activityData, activityEntry } from './fixtures/activityPlanning.js';
import {
  resolveActivityPlanning,
  ActivityPlanningConflictError,
  ActivityPlanningValidationError,
} from '../services/activityPlanningService.js';
import { getClient } from '../db/poolManager.js';
import { readActivityPlanningData } from '../models/activityPlanningRepository.js';
vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
vi.mock('../models/activityPlanningRepository.js', () => ({
  readActivityPlanningData: vi.fn(),
}));
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: vi.fn().mockResolvedValue('Europe/Berlin'),
}));
const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
const release = vi.fn();
const id = 'workout:1:1:2026-10-01';
const owner = randomUUID();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getClient).mockResolvedValue({ query, release });
  vi.mocked(readActivityPlanningData).mockResolvedValue(activityData());
});
describe('revision checked owner activity decisions', () => {
  it('takes an owner transaction lock and writes no exercise/calorie rows', async () => {
    await resolveActivityPlanning(owner, {
      occurrence_id: id,
      expected_revision: 0,
      action: 'skip',
    });
    expect(getClient).toHaveBeenCalledWith(owner, owner);
    expect(query.mock.calls[1][0]).toContain('pg_advisory_xact_lock');
    const writes = query.mock.calls.filter(([sql]) =>
      String(sql).startsWith('INSERT')
    );
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toContain('activity_plan_resolutions');
    expect(release).toHaveBeenCalled();
  });
  it('rejects a stale decision and rolls back', async () => {
    await expect(
      resolveActivityPlanning(owner, {
        occurrence_id: id,
        expected_revision: 9,
        action: 'skip',
      })
    ).rejects.toBeInstanceOf(ActivityPlanningConflictError);
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
  it('replays an identical decision without changing its revision', async () => {
    const rows = activityData();
    rows.resolutions = [
      {
        user_id: owner,
        occurrence_id: id,
        local_day: '2026-10-01',
        revision: 1,
        action: 'skip',
        record_id: null,
        entry_id: null,
        updated_at: '2026-10-01T10:00:00Z',
      },
    ];
    vi.mocked(readActivityPlanningData).mockResolvedValue(rows);
    expect(
      (
        await resolveActivityPlanning(owner, {
          occurrence_id: id,
          expected_revision: 0,
          action: 'skip',
        })
      ).occurrences[0].revision
    ).toBe(1);
    expect(
      query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT'))
    ).toBe(false);
  });
  it('rejects wrong-date, unconfirmed, other plan-linked and already-linked records', async () => {
    for (const actual of [
      activityEntry({ entry_date: '2026-10-02', origin_id: null }),
      activityEntry(),
      activityEntry({ completed_count: 2 }),
    ]) {
      const rows = activityData();
      rows.entries = [actual];
      vi.mocked(readActivityPlanningData).mockResolvedValue(rows);
      await expect(
        resolveActivityPlanning(owner, {
          occurrence_id: id,
          expected_revision: 0,
          action: 'link',
          record_id: actual.record_id,
        })
      ).rejects.toBeInstanceOf(ActivityPlanningValidationError);
    }
    const actual = activityEntry({ origin_id: null });
    const rows = activityData();
    rows.entries = [actual];
    rows.resolutions = [
      {
        user_id: owner,
        occurrence_id: 'workout:2:2:2026-10-01',
        local_day: '2026-10-01',
        revision: 1,
        action: 'link',
        record_id: actual.record_id,
        entry_id: actual.id,
        updated_at: '2026-10-01T10:00:00Z',
      },
    ];
    vi.mocked(readActivityPlanningData).mockResolvedValue(rows);
    await expect(
      resolveActivityPlanning(owner, {
        occurrence_id: id,
        expected_revision: 0,
        action: 'link',
        record_id: actual.record_id,
      })
    ).rejects.toBeInstanceOf(ActivityPlanningConflictError);
  });
});
