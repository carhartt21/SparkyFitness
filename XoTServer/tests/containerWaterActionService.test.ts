import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import foodRepository from '../models/foodRepository.js';
import measurementRepository from '../models/measurementRepository.js';
import hydrationTotalsService from '../services/hydrationTotalsService.js';
import {
  ContainerWaterActionError,
  createContainerWaterAction,
} from '../services/containerWaterActionService.js';
import { createMockDbClient } from './helpers/mockDbClient.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
vi.mock('../models/foodRepository.js', () => ({
  default: { createFoodEntry: vi.fn() },
}));
vi.mock('../models/measurementRepository.js', () => ({
  default: {
    insertWaterIntakeLog: vi.fn(),
    recomputeWaterAggregate: vi.fn(),
  },
}));
vi.mock('../services/hydrationTotalsService.js', () => ({
  default: { resolveWaterTotalsForDate: vi.fn() },
}));
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: vi.fn().mockResolvedValue('Europe/Berlin'),
}));

const userId = '550e8400-e29b-41d4-a716-446655440000';
const operationId = '550e8400-e29b-41d4-a716-446655440001';
const foodId = '550e8400-e29b-41d4-a716-446655440002';
const variantId = '550e8400-e29b-41d4-a716-446655440003';
const foodEntryId = '550e8400-e29b-41d4-a716-446655440004';
const waterLogId = '550e8400-e29b-41d4-a716-446655440005';
const action = {
  client_operation_id: operationId,
  entry_date: '2026-09-24',
  container_id: 7,
  logged_at: '2026-09-24T08:30:00.000Z',
};
const totals = { water_ml: 250, manual_ml: 250, ledger_ml: 250, food_ml: 0 };

describe('container water action transaction', () => {
  const client = createMockDbClient();

  beforeEach(() => {
    vi.clearAllMocks();
    client.query.mockReset();
    vi.mocked(getClient).mockResolvedValue(client);
    vi.mocked(
      hydrationTotalsService.resolveWaterTotalsForDate
    ).mockResolvedValue(totals);
    vi.mocked(measurementRepository.insertWaterIntakeLog).mockResolvedValue({
      id: waterLogId,
    });
  });

  it('commits an unlinked water row, aggregate, and immutable receipt together', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // operation lock
      .mockResolvedValueOnce({ rows: [] }) // no previous receipt
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            user_id: userId,
            name: 'Glass',
            volume: 250,
            servings_per_container: 1,
            hydration_factor: 1,
            linked_food_id: null,
            linked_variant_id: null,
            linked_meal_type_id: null,
            linked_quantity: 1,
          },
        ],
      }) // container
      .mockResolvedValueOnce({ rows: [] }) // day lock
      .mockResolvedValueOnce({ rows: [] }) // receipt
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await createContainerWaterAction(userId, userId, action);

    expect(result).toEqual({
      waterLogId,
      foodEntryId: null,
      waterMl: 250,
      alreadyApplied: false,
      totals,
    });
    expect(measurementRepository.insertWaterIntakeLog).toHaveBeenCalledWith(
      userId,
      userId,
      action.entry_date,
      250,
      7,
      'Glass',
      'manual',
      action.logged_at,
      null,
      1,
      client,
      action.client_operation_id
    );
    expect(measurementRepository.recomputeWaterAggregate).toHaveBeenCalledWith(
      client,
      userId,
      userId,
      action.entry_date,
      'manual'
    );
    expect(
      client.query.mock.calls.find(([sql]) =>
        String(sql).includes('INSERT INTO water_container_actions')
      )
    ).toBeDefined();
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('logs linked food in the same transaction and uses the capture time for its meal', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            user_id: userId,
            name: 'Coffee',
            volume: 0,
            servings_per_container: 1,
            hydration_factor: 0.8,
            linked_food_id: foodId,
            linked_variant_id: variantId,
            linked_meal_type_id: null,
            linked_quantity: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: variantId,
            food_id: foodId,
            food_name: 'Coffee',
            brand_name: null,
            serving_size: 100,
            serving_unit: 'ml',
            water_ml: 90,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 'breakfast-id', name: 'Breakfast', default_time: '08:00' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    vi.mocked(foodRepository.createFoodEntry).mockResolvedValue({
      id: foodEntryId,
    });

    const result = await createContainerWaterAction(userId, userId, action);

    expect(result.foodEntryId).toBe(foodEntryId);
    expect(result.waterMl).toBeCloseTo(1.44); // 90 ml per 100 ml x 2 ml x 0.8
    expect(foodRepository.createFoodEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        food_id: foodId,
        variant_id: variantId,
        quantity: 2,
        meal_type_id: 'breakfast-id',
      }),
      userId,
      client
    );
    expect(measurementRepository.insertWaterIntakeLog).toHaveBeenCalledWith(
      userId,
      userId,
      action.entry_date,
      expect.closeTo(1.44),
      7,
      'Coffee',
      'manual',
      action.logged_at,
      foodEntryId,
      0.8,
      client,
      action.client_operation_id
    );
  });

  it('replays a committed receipt without recreating deleted side effects', async () => {
    const crypto = await import('node:crypto');
    const fingerprint = crypto
      .createHash('sha256')
      .update(
        JSON.stringify([
          action.entry_date,
          action.container_id,
          action.logged_at,
        ])
      )
      .digest('hex');
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            request_fingerprint: fingerprint,
            water_log_id: null,
            food_entry_id: null,
            water_ml: '250',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await createContainerWaterAction(userId, userId, action);

    expect(result).toMatchObject({ alreadyApplied: true, waterMl: 250 });
    expect(measurementRepository.insertWaterIntakeLog).not.toHaveBeenCalled();
    expect(foodRepository.createFoodEntry).not.toHaveBeenCalled();
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('rolls back if linked food fails before the water row is inserted', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 7,
            user_id: userId,
            name: 'Coffee',
            volume: 250,
            servings_per_container: 1,
            hydration_factor: 1,
            linked_food_id: foodId,
            linked_variant_id: variantId,
            linked_meal_type_id: 'meal-id',
            linked_quantity: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: variantId,
            food_id: foodId,
            food_name: 'Coffee',
            serving_size: 1,
            serving_unit: 'ml',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    vi.mocked(foodRepository.createFoodEntry).mockRejectedValue(
      new Error('diary write denied')
    );

    await expect(
      createContainerWaterAction(userId, userId, action)
    ).rejects.toThrow('diary write denied');
    expect(measurementRepository.insertWaterIntakeLog).not.toHaveBeenCalled();
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });

  it('rejects a changed payload for the same operation ID', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            request_fingerprint: '0'.repeat(64),
            water_log_id: waterLogId,
            food_entry_id: null,
            water_ml: '250',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      createContainerWaterAction(userId, userId, action)
    ).rejects.toBeInstanceOf(ContainerWaterActionError);
    expect(client.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
});
