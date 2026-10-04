import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { createFoodWithClient } from '../models/food.js';

vi.mock('../db/poolManager.js', () => ({
  getClient: vi.fn(),
  getSystemClient: vi.fn(),
}));

describe('food creation serving metadata', () => {
  it('writes a primary named portion with a weight, label and order', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'food-1', user_id: 'owner-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'portion-1' }] });
    const client = { query } as unknown as PoolClient;
    const result = await createFoodWithClient(client, {
      name: 'Public fixture',
      user_id: 'owner-1',
      serving_size: 1,
      serving_unit: 'serving',
      metric_amount: 21.5,
      metric_unit: 'g',
      serving_label: 'Bar',
      sort_order: 1,
      calories: 123,
    });
    const [sql, parameters] = query.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain(
      'serving_label, metric_amount, metric_unit, sort_order'
    );
    expect(parameters.slice(-4)).toEqual(['Bar', 21.5, 'g', 1]);
    expect(result.default_variant).toMatchObject({
      serving_size: 1,
      serving_unit: 'serving',
      serving_label: 'Bar',
      metric_amount: 21.5,
      metric_unit: 'g',
      sort_order: 1,
    });
  });
});
