import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import { recordedCustomMeasurementsInRange } from '../models/dailyTrackingRepository.js';
import { createMockDbClient } from './helpers/mockDbClient.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));

describe('recordedCustomMeasurementsInRange', () => {
  const categoryId = '00000000-0000-0000-0000-000000000001';
  const client = createMockDbClient([]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClient).mockResolvedValue(
      client as unknown as Awaited<ReturnType<typeof getClient>>
    );
  });

  it('does not query when the calendar has no custom reminders', async () => {
    expect(
      await recordedCustomMeasurementsInRange(
        'user-1',
        '2026-09-01',
        '2026-09-30',
        ['weight']
      )
    ).toEqual({});
    expect(getClient).not.toHaveBeenCalled();
  });

  it('reads each saved custom category by date with scoped parameters', async () => {
    client.query.mockResolvedValue({
      rows: [
        {
          entry_date: '2026-09-28',
          category_id: categoryId,
          at: new Date('2026-09-28T10:00:00Z'),
        },
      ],
    });
    const result = await recordedCustomMeasurementsInRange(
      'user-1',
      '2026-09-01',
      '2026-09-30',
      [`custom:${categoryId}`, `custom:${categoryId}`]
    );
    expect(result).toEqual({
      '2026-09-28': {
        [`custom:${categoryId}`]: '2026-09-28T10:00:00.000Z',
      },
    });
    expect(getClient).toHaveBeenCalledWith('user-1', null);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('category_id = ANY($4::uuid[])'),
      ['user-1', '2026-09-01', '2026-09-30', [categoryId]]
    );
    expect(client.release).toHaveBeenCalledOnce();
  });
});
