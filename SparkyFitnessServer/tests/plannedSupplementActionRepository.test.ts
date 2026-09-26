import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import { createPlannedSupplementAction } from '../models/plannedSupplementActionRepository.js';
import {
  createMockDbClient,
  type MockDbClient,
} from './helpers/mockDbClient.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));

const userId = '550e8400-e29b-41d4-a716-446655440000';
const medicationId = '550e8400-e29b-41d4-a716-446655440001';
const scheduleId = '550e8400-e29b-41d4-a716-446655440002';
const operationId = '550e8400-e29b-41d4-a716-446655440003';
const entryId = '550e8400-e29b-41d4-a716-446655440004';
const body = {
  client_operation_id: operationId,
  medication_id: medicationId,
  schedule_id: scheduleId,
  entry_date: '2026-09-24',
  status: 'taken' as const,
  occurred_at: '2026-09-24T08:00:00.000Z',
};
const requestFingerprint = createHash('sha256')
  .update(
    JSON.stringify([
      medicationId,
      scheduleId,
      body.entry_date,
      body.status,
      body.occurred_at,
    ])
  )
  .digest('hex');

describe('planned supplement action persistence', () => {
  let client: MockDbClient;

  beforeEach(() => {
    client = createMockDbClient();
    vi.mocked(getClient).mockResolvedValue(client);
    client.query.mockReset();
  });

  it('creates one dose and its replay ledger in one transaction using server dose/nutrients', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // operation lock
      .mockResolvedValueOnce({ rows: [] }) // no prior operation
      .mockResolvedValueOnce({
        rows: [
          {
            id: scheduleId,
            medication_id: medicationId,
            schedule_type_id: 'daily',
            active: true,
            created_at: '2026-09-01T08:00:00Z',
            medication_active: true,
            is_supplement: true,
            name: 'Vitamin D',
            display_name: null,
            dose_amount: 2,
            medication_dose_amount: 1,
            dose_unit: 'tablet',
            nutrients: { vitamin_d: 10 },
          },
        ],
      }) // locked schedule
      .mockResolvedValueOnce({ rows: [] }) // no prior occurrence
      .mockResolvedValueOnce({ rows: [] }) // no manual entry
      .mockResolvedValueOnce({ rows: [{ id: entryId, ...body }] }) // entry
      .mockResolvedValueOnce({ rows: [] }) // ledger
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await createPlannedSupplementAction(
      userId,
      body,
      'Europe/Berlin'
    );

    expect(result).toMatchObject({ replayed: false, entry: { id: entryId } });
    const insertEntry = client.query.mock.calls.find((call: unknown[]) =>
      String(call[0]).includes('INSERT INTO medication_entries')
    );
    expect(insertEntry?.[1]).toEqual([
      medicationId,
      scheduleId,
      userId,
      'taken',
      body.occurred_at,
      body.entry_date,
      'Vitamin D',
      2,
      'tablet',
      JSON.stringify({ vitamin_d: 10 }),
    ]);
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('returns an identical replay without inserting, even after the entry is deleted', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ request_fingerprint: requestFingerprint, entry: null }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await createPlannedSupplementAction(
      userId,
      body,
      'Europe/Berlin'
    );

    expect(result).toEqual({ entry: null, replayed: true });
    expect(
      client.query.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes('INSERT INTO medication_entries')
      )
    ).toBe(false);
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('rejects operation-ID reuse with a changed payload', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ request_fingerprint: requestFingerprint, entry: null }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      createPlannedSupplementAction(
        userId,
        { ...body, status: 'skipped' },
        'Europe/Berlin'
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });

  it('rejects a schedule that is not due on the occurrence date', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: scheduleId,
            medication_id: medicationId,
            schedule_type_id: 'daily',
            active: false,
            created_at: '2026-09-01T08:00:00Z',
            medication_active: true,
            is_supplement: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      createPlannedSupplementAction(userId, body, 'Europe/Berlin')
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
});
