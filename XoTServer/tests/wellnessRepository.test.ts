import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import {
  createHabit,
  logHabit,
  updateHabit,
} from '../models/dailyTrackingRepository.js';
import { createMockDbClient } from './helpers/mockDbClient.js';
import { wellnessActivityRequest } from '@workspace/shared';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
const row = {
  id: 'activity',
  name: 'Sauna',
  display_name: 'Sauna',
  measurement_type: 'habit',
  habit_type: 'completion',
  habit_category: 'wellness',
  habit_description: null,
  habit_target: null,
  habit_step: null,
  habit_days: [],
  habit_reminder_time: null,
  habit_active: true,
  habit_sort_order: 0,
  habit_icon: null,
};

describe('wellness persistence', () => {
  const client = createMockDbClient([]);
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getClient).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof getClient>>
    );
    client.query.mockResolvedValue({ rows: [] });
  });
  it('reuses the same definition under an account-scoped transaction lock', async () => {
    client.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT id, name') ? [row] : [],
    }));
    expect(
      await createHabit('owner', 'delegate', wellnessActivityRequest('Sauna'))
    ).toMatchObject({ id: 'activity', category: 'wellness', days: [] });
    expect(getClient).toHaveBeenCalledWith('owner', 'delegate');
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      ['wellness:owner:sauna']
    );
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO')
      )
    ).toBe(false);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('leaves a borrowed coaching transaction under its caller control', async () => {
    client.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT id, name') ? [row] : [],
    }));
    await createHabit(
      'owner',
      'owner',
      wellnessActivityRequest('Sauna'),
      client as unknown as Awaited<ReturnType<typeof getClient>>
    );
    expect(getClient).not.toHaveBeenCalled();
    for (const command of ['BEGIN', 'COMMIT', 'ROLLBACK']) {
      expect(client.query).not.toHaveBeenCalledWith(command);
    }
    expect(client.release).not.toHaveBeenCalled();
  });
  it('propagates failures without rolling back a borrowed transaction', async () => {
    client.query.mockRejectedValue(new Error('database unavailable'));
    await expect(
      createHabit(
        'owner',
        'owner',
        wellnessActivityRequest('Sauna'),
        client as unknown as Awaited<ReturnType<typeof getClient>>
      )
    ).rejects.toThrow('database unavailable');
    expect(client.query).not.toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).not.toHaveBeenCalled();
  });
  it('rolls back creation failures and releases the scoped client', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO')) throw new Error('database unavailable');
      return { rows: [] };
    });
    await expect(
      createHabit('owner', 'owner', wellnessActivityRequest('Sauna'))
    ).rejects.toThrow('database unavailable');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('rejects attempts to schedule a wellness definition through the existing editor', async () => {
    client.query.mockResolvedValue({ rows: [row] });
    await expect(
      updateHabit('owner', 'owner', 'activity', { days: [1] })
    ).rejects.toThrow('unscheduled');
  });
  it('serializes dated writes and clears just the selected day without deleting history', async () => {
    client.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('SELECT id, name') ? [row] : [],
    }));
    await expect(
      logHabit('owner', 'owner', 'activity', '2026-10-02', null)
    ).resolves.toBeNull();
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      ['wellness-log:activity:2026-10-02']
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('entry_date = $3'),
      ['owner', 'activity', '2026-10-02']
    );
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('DELETE FROM custom_categories')
      )
    ).toBe(false);
  });
});
