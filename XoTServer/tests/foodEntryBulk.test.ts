import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import { applyFoodEntryBulkAction } from '../models/foodEntryBulk.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));

const userId = 'f45609ab-570d-4070-9c96-0fd7954dc47d';
const entryId = '4b5084a0-c739-447a-bfdf-f5717f64ee4f';
const mealId = '6c7ffec8-2be7-4f1b-802f-e0ceff778516';

describe('food entry bulk actions', () => {
  const client = { query: vi.fn(), release: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClient).mockResolvedValue(client as never);
    client.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id, food_entry_meal_id'))
        return Promise.resolve({
          rows: [
            {
              id: entryId,
              food_entry_meal_id: null,
              meal_plan_template_id: null,
              source: null,
              nutrition_capture_id: null,
            },
          ],
        });
      if (sql.includes('SELECT id FROM meal_types'))
        return Promise.resolve({ rows: [{ id: mealId }] });
      if (sql.includes('RETURNING id'))
        return Promise.resolve({ rows: [{ id: entryId }] });
      return Promise.resolve({ rows: [] });
    });
  });

  it('moves a reviewed selection in one transaction and scopes both sides to the owner', async () => {
    const result = await applyFoodEntryBulkAction(userId, {
      ids: [entryId],
      action: 'move',
      sourceDate: '2026-09-26',
      targetDate: '2026-09-27',
      targetMealTypeId: mealId,
      actorId: userId,
    });
    expect(result.count).toBe(1);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(
      client.query.mock.calls.find(([sql]) =>
        sql.includes('UPDATE food_entries')
      )?.[1]
    ).toEqual([userId, mealId, '2026-09-27', userId, [entryId]]);
  });

  it('copies the snapshot without carrying a provider identity or nutrition capture link', async () => {
    await applyFoodEntryBulkAction(userId, {
      ids: [entryId],
      action: 'copy',
      sourceDate: '2026-09-26',
      targetDate: '2026-09-26',
      targetMealTypeId: mealId,
      actorId: userId,
    });
    const copySql = client.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO food_entries')
    )?.[0];
    expect(copySql).toContain('food_name, brand_name, serving_size');
    expect(copySql).not.toContain('source_id');
    expect(copySql).not.toContain('nutrition_capture_id');
  });

  it('rolls back if a selected row has changed or belongs to a composite meal', async () => {
    client.query.mockImplementation((sql: string) =>
      Promise.resolve({
        rows: sql.includes('SELECT id, food_entry_meal_id')
          ? [
              {
                id: entryId,
                food_entry_meal_id: mealId,
                meal_plan_template_id: null,
              },
            ]
          : [],
      })
    );
    await expect(
      applyFoodEntryBulkAction(userId, {
        ids: [entryId],
        action: 'delete',
        sourceDate: '2026-09-26',
        actorId: userId,
      })
    ).rejects.toThrow('individually');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(
      client.query.mock.calls.some(([sql]) => sql.startsWith('DELETE FROM'))
    ).toBe(false);
  });
});
