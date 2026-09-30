import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  getClient: vi.fn(),
}));

vi.mock('../db/poolManager.js', () => ({ getClient: db.getClient }));

import {
  fddbSourceId,
  importFddbDiaryBatch,
  importFddbWeight,
} from '../models/fddbImportRepository.js';

const row = {
  sourceKey: '2026-09-26 08:30\u0000123\u0000Example\u00000',
  date: '2026-09-26',
  time: '08:30',
  foodName: 'Example',
  quantity: 200,
  unit: 'g',
  calories: 157.5,
  protein: 6,
  carbs: 23,
  fat: 4,
};

describe('FDDB diary snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getClient.mockResolvedValue({ query: db.query, release: db.release });
    db.query.mockResolvedValue({ rowCount: 0, rows: [] });
  });

  it('writes each occurrence as its own idempotent entry with original time and fixed totals', async () => {
    db.query.mockImplementation((sql: string) =>
      Promise.resolve({
        rowCount: sql.includes('RETURNING id') ? 2 : 0,
        rows: [],
      })
    );
    const second = { ...row, sourceKey: row.sourceKey.replace(/0$/, '1') };
    const inserted = await importFddbDiaryBatch('user-1', 'user-1', 'meal-1', [
      row,
      second,
    ]);
    expect(inserted).toBe(2);
    const insert = db.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO food_entries')
    );
    expect(insert).toBeDefined();
    expect(insert?.[0]).toContain('ON CONFLICT (user_id, source, source_id)');
    expect(insert?.[0]).toContain('DO NOTHING');
    expect(insert?.[1]).toHaveLength(34);
    expect(insert?.[1].slice(0, 17)).toEqual([
      'user-1',
      'meal-1',
      200,
      'g',
      '2026-09-26',
      '08:30',
      'Example',
      200,
      'g',
      157.5,
      6,
      23,
      4,
      fddbSourceId(row.sourceKey),
      'user-1',
      'user-1',
      'fddb',
    ]);
    expect(insert?.[1][30]).not.toBe(fddbSourceId(row.sourceKey));
    expect(db.query).toHaveBeenCalledWith('COMMIT');
    expect(db.release).toHaveBeenCalledOnce();
  });

  it('reports already-imported batches as zero inserted and rolls back failures', async () => {
    expect(
      await importFddbDiaryBatch('user-1', 'user-1', 'meal-1', [row])
    ).toBe(0);
    db.query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(
      importFddbDiaryBatch('user-1', 'user-1', 'meal-1', [row])
    ).rejects.toThrow('database unavailable');
    expect(db.query).toHaveBeenCalledWith('ROLLBACK');
    expect(db.release).toHaveBeenCalledTimes(2);
  });

  it('fills an empty weight on an existing day without replacing a recorded weight', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'checkin-1' }],
    });
    expect(await importFddbWeight('user-1', 'user-1', '2026-09-25', 70.5)).toBe(
      true
    );
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('WHERE check_in_measurements.weight IS NULL');
    expect(params).toEqual(['user-1', '2026-09-25', 70.5, 'user-1']);
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    expect(await importFddbWeight('user-1', 'user-1', '2026-09-25', 70.5)).toBe(
      false
    );
  });
});
