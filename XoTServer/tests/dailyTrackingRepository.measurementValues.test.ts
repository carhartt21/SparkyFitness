import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import {
  recordedMeasurementValuesOn,
  recordedMeasurementsOn,
} from '../models/dailyTrackingRepository.js';
import { createMockDbClient } from './helpers/mockDbClient.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));

describe('same-day recorded measurement values', () => {
  const client = createMockDbClient([]);
  const timestamp = new Date('2026-10-01T07:05:00Z');
  const category = '33333333-3333-4333-8333-333333333333';
  const weightRow = {
    id: '22222222-2222-4222-8222-222222222222',
    weight: '78.30',
    recorded_at: timestamp,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getClient).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof getClient>>
    );
    client.query.mockResolvedValue({ rows: [] });
  });

  it('does not open a database client without requested measurements', async () => {
    expect(
      await recordedMeasurementValuesOn('owner', '2026-10-01', [])
    ).toEqual({});
    expect(getClient).not.toHaveBeenCalled();
  });

  it('returns numeric kilograms from the owner-scoped exact-day query', async () => {
    client.query.mockResolvedValue({ rows: [weightRow] });
    expect(
      await recordedMeasurementValuesOn('owner', '2026-10-01', ['weight'])
    ).toEqual({
      weight: {
        measurement_id: weightRow.id,
        value: 78.3,
        unit: 'kg',
        recorded_at: timestamp.toISOString(),
        source: null,
      },
    });
    expect(getClient).toHaveBeenCalledWith('owner', null);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('entry_date = $2 AND weight IS NOT NULL'),
      ['owner', '2026-10-01']
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('keeps a real zero rather than treating it as an absent reading', async () => {
    client.query.mockResolvedValue({ rows: [{ ...weightRow, weight: '0' }] });
    expect(
      (await recordedMeasurementValuesOn('owner', '2026-10-01', ['weight']))
        .weight.value
    ).toBe(0);
  });

  it('omits an unrecorded day and does not request a historical prefill', async () => {
    expect(
      await recordedMeasurementValuesOn('owner', '2026-10-02', ['weight'])
    ).toEqual({});
    expect(client.query).toHaveBeenCalledWith(
      expect.not.stringContaining('entry_date <='),
      ['owner', '2026-10-02']
    );
  });

  it('reads custom value, timestamp and source from the same latest row', async () => {
    client.query.mockResolvedValue({
      rows: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          category_id: category,
          value: '0',
          unit: 'count',
          recorded_at: timestamp,
          source: 'manual',
        },
      ],
    });
    const result = await recordedMeasurementValuesOn('owner', '2026-10-01', [
      `custom:${category}`,
    ]);
    expect(result[`custom:${category}`]).toMatchObject({
      value: '0',
      unit: 'count',
      recorded_at: timestamp.toISOString(),
      source: 'manual',
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT DISTINCT ON (cm.category_id)'),
      ['owner', '2026-10-01', [category]]
    );
    expect(client.query.mock.calls[0][0]).toContain('cc.user_id = cm.user_id');
    expect(client.query.mock.calls[0][0]).toContain(
      'cm.entry_timestamp DESC, cm.id DESC'
    );
  });

  it('keeps the timestamp-only Daily Progress projection compatible', async () => {
    client.query.mockResolvedValue({ rows: [weightRow] });
    expect(
      await recordedMeasurementsOn('owner', '2026-10-01', ['weight'])
    ).toEqual({ weight: timestamp.toISOString() });
  });

  it('releases the scoped client on query failure', async () => {
    client.query.mockRejectedValue(new Error('database unavailable'));
    await expect(
      recordedMeasurementValuesOn('owner', '2026-10-01', ['weight'])
    ).rejects.toThrow('database unavailable');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects a non-finite stored weight instead of emitting an invented value', async () => {
    client.query.mockResolvedValue({ rows: [{ ...weightRow, weight: 'NaN' }] });
    await expect(
      recordedMeasurementValuesOn('owner', '2026-10-01', ['weight'])
    ).rejects.toThrow('not a finite number');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
