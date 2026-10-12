import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { OfflineMealActionBody } from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import { createFoodEntryMealWithClient } from '../models/foodEntryMealRepository.js';
import foodRepository from '../models/foodRepository.js';
import { canonicalJson } from '../utils/canonicalJson.js';
import { createOfflineMealAction } from '../services/offlineMealActionService.js';
import { createMockDbClient } from './helpers/mockDbClient.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
vi.mock('../models/foodEntryMealRepository.js', () => ({
  createFoodEntryMealWithClient: vi.fn(),
}));
vi.mock('../models/foodRepository.js', () => ({
  default: { createFoodEntry: vi.fn() },
}));
const owner = '11111111-1111-4111-8111-111111111111';
const parent = '44444444-4444-4444-8444-444444444444';
const action: OfflineMealActionBody = {
  client_operation_id: '22222222-2222-4222-8222-222222222222',
  entry_date: '2026-10-12',
  entry_time: '23:15:00',
  meal_type_id: '33333333-3333-4333-8333-333333333333',
  quantity: 2,
  meal: {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Test recipe',
    serving_size: 1,
    serving_unit: 'serving',
    total_servings: 4,
    foods: [
      {
        food_name: 'Test oats',
        quantity: 200,
        unit: 'g',
        serving_size: 100,
        serving_unit: 'g',
        calories: 350,
        protein: 12,
        carbs: 60,
        fat: 6,
        water_ml: 8,
      },
    ],
  },
};
const db = createMockDbClient();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getClient).mockResolvedValue(db);
  vi.mocked(createFoodEntryMealWithClient).mockResolvedValue({ id: parent });
  db.query.mockImplementation(async (sql: string) => ({
    rows: sql.startsWith('SELECT id FROM meal_types')
      ? [{ id: action.meal_type_id }]
      : [],
  }));
});
describe('offline grouped meal transactions', () => {
  it('creates parent, scaled ingredients and replay receipt in one owner-scoped transaction', async () => {
    expect(await createOfflineMealAction(owner, action)).toEqual({
      mealEntryId: parent,
      alreadyApplied: false,
    });
    expect(getClient).toHaveBeenCalledWith(owner, owner);
    expect(createFoodEntryMealWithClient).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        meal_template_id: null,
        quantity: 2,
        entry_total_servings: 4,
      }),
      owner
    );
    expect(foodRepository.createFoodEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        food_id: null,
        variant_id: null,
        food_entry_meal_id: parent,
        quantity: 100,
        calories: 350,
        water_ml: 8,
      }),
      owner,
      db
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO offline_meal_actions'),
      expect.arrayContaining([owner, action.client_operation_id, parent])
    );
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(db.release).toHaveBeenCalledTimes(1);
  });
  it('acknowledges a replay after deliberate diary deletion without restoring the group', async () => {
    db.query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith('SELECT request_fingerprint')
        ? [
            {
              request_fingerprint: createHash('sha256')
                .update(canonicalJson(action))
                .digest('hex'),
              meal_entry_id: null,
            },
          ]
        : [],
    }));
    expect(await createOfflineMealAction(owner, action)).toEqual({
      mealEntryId: null,
      alreadyApplied: true,
    });
    expect(createFoodEntryMealWithClient).not.toHaveBeenCalled();
    expect(foodRepository.createFoodEntry).not.toHaveBeenCalled();
  });
  it('rolls back reused IDs with different snapshots and failed ingredient writes', async () => {
    db.query
      .mockImplementationOnce(async () => ({ rows: [] }))
      .mockImplementationOnce(async () => ({ rows: [] }))
      .mockImplementationOnce(async () => ({
        rows: [{ request_fingerprint: 'different', meal_entry_id: parent }],
      }));
    await expect(createOfflineMealAction(owner, action)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.query).toHaveBeenCalledWith('ROLLBACK');
    db.query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith('SELECT id FROM meal_types')
        ? [{ id: action.meal_type_id }]
        : [],
    }));
    vi.mocked(foodRepository.createFoodEntry).mockRejectedValueOnce(
      new Error('write failed')
    );
    await expect(createOfflineMealAction(owner, action)).rejects.toThrow(
      'write failed'
    );
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
});
