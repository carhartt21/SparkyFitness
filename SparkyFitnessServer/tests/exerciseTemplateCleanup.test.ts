import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import { deleteExerciseEntriesByTemplateId } from '../models/exerciseTemplate.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

const query = vi.fn();
const release = vi.fn();

describe('workout plan generated-entry cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClient).mockResolvedValue({ query, release } as never);
  });

  it('keeps entries with completed sets and only removes empty plan preset parents', async () => {
    query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 'untouched-entry', exercise_preset_entry_id: 'preset-1' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rowCount: 0 }) // Completed sibling keeps parent.
      .mockResolvedValueOnce({}); // COMMIT

    await expect(
      deleteExerciseEntriesByTemplateId(12, 'user-1', '2026-09-25')
    ).resolves.toBe(1);

    const deleteEntriesSql = query.mock.calls[1][0] as string;
    expect(deleteEntriesSql).toContain('s.completed_at IS NOT NULL');
    expect(deleteEntriesSql).toContain('AND NOT EXISTS');
    expect(query.mock.calls[1][1]).toEqual(['user-1', 12, '2026-09-25']);

    const deletePresetSql = query.mock.calls[2][0] as string;
    expect(deletePresetSql).toContain("p.source = 'Workout Plan'");
    expect(deletePresetSql).toContain('NOT EXISTS');
    expect(query.mock.calls[2][1]).toEqual(['user-1', ['preset-1']]);
    expect(query.mock.calls[3][0]).toBe('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('does not remove preset parents when no generated entries were deleted', async () => {
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({});

    await expect(
      deleteExerciseEntriesByTemplateId(12, 'user-1', '2026-09-25')
    ).resolves.toBe(0);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      expect.stringContaining('DELETE FROM exercise_entries'),
      'COMMIT',
    ]);
    expect(release).toHaveBeenCalledOnce();
  });
});
