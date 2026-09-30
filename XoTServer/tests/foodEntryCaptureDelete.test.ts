import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import foodEntryRepository from '../models/foodEntry.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));

describe('deleting a completed photo diary row', () => {
  const query = vi.fn();
  const release = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClient).mockResolvedValue({ query, release } as never);
  });

  it('returns the capture to the incomplete photo queue in the same statement', async () => {
    query.mockResolvedValue({ rows: [{ id: 'entry-1' }], rowCount: 1 });
    expect(
      await foodEntryRepository.deleteFoodEntry('entry-1', 'owner-1')
    ).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SET completion_state = 'incomplete'"),
      ['entry-1', 'owner-1']
    );
    expect(query.mock.calls[0][0]).toContain('DELETE FROM food_entries');
    expect(release).toHaveBeenCalled();
  });
});
