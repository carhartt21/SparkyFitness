import { vi, afterEach, beforeEach, describe, expect, it } from 'vitest';
import mealTypeRepository from '../models/mealType.js';
import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../db/poolManager.js';

vi.mock('../db/poolManager', () => ({
  getClient: vi.fn(),
}));

describe('mealTypeRepository default_time tests', () => {
  let mockClient: any;
  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    vi.mocked(getClient).mockResolvedValue(mockClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateMealType default_time', () => {
    it('reorders system and custom meals in one transaction', async () => {
      const userId = uuidv4();
      const systemId = uuidv4();
      const customId = uuidv4();
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.startsWith('SELECT id, user_id FROM meal_types'))
          return Promise.resolve({
            rows: [
              { id: systemId, user_id: null },
              { id: customId, user_id: userId },
            ],
          });
        return Promise.resolve({ rows: [] });
      });

      await mealTypeRepository.reorderMealTypes(userId, [customId, systemId]);
      expect(
        mockClient.query.mock.calls.map((call: any[]) => call[0])
      ).toContain('COMMIT');
      expect(
        mockClient.query.mock.calls.find((call: any[]) =>
          call[0].includes('sort_order_override = EXCLUDED.sort_order_override')
        )?.[1]
      ).toEqual([userId, systemId, 20]);
      expect(
        mockClient.query.mock.calls.find((call: any[]) =>
          call[0].startsWith('UPDATE meal_types SET sort_order')
        )?.[1]
      ).toEqual([10, customId, userId]);
    });

    it('rolls back an incomplete or duplicate order', async () => {
      const userId = uuidv4();
      const systemId = uuidv4();
      mockClient.query.mockImplementation((sql: string) =>
        Promise.resolve({
          rows: sql.startsWith('SELECT id, user_id FROM meal_types')
            ? [{ id: systemId, user_id: null }]
            : [],
        })
      );
      await expect(
        mealTypeRepository.reorderMealTypes(userId, [systemId, systemId])
      ).rejects.toThrow('exactly once');
      expect(
        mockClient.query.mock.calls.map((call: any[]) => call[0])
      ).toContain('ROLLBACK');
    });

    it('stores system meal names and order per user without changing the shared type', async () => {
      const mealTypeId = uuidv4();
      const userId = uuidv4();
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.startsWith('SELECT user_id FROM meal_types'))
          return Promise.resolve({ rows: [{ user_id: null }] });
        return Promise.resolve({ rows: [{ id: mealTypeId }] });
      });

      await mealTypeRepository.updateMealType(
        mealTypeId,
        { name: 'Second breakfast', sort_order: 3 },
        userId
      );

      const override = mockClient.query.mock.calls.find((call: any[]) =>
        call[0].includes('name_override, sort_order_override')
      );
      expect(override?.[1]).toEqual([
        userId,
        mealTypeId,
        'Second breakfast',
        3,
        true,
        true,
      ]);
      expect(
        mockClient.query.mock.calls.some((call: any[]) =>
          call[0].startsWith('UPDATE meal_types')
        )
      ).toBe(false);
    });

    it('should upsert default_time in user_meal_visibilities when provided', async () => {
      const mealTypeId = uuidv4();
      const userId = uuidv4();
      const data = { default_time: '11:30' };

      mockClient.query.mockImplementation((sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return Promise.resolve();
        return Promise.resolve({
          rows: [{ id: mealTypeId, default_time: '11:30' }],
        });
      });

      await mealTypeRepository.updateMealType(mealTypeId, data, userId);

      const visibilityUpsertCall = mockClient.query.mock.calls.find(
        (call: any[]) => call[0].includes('INSERT INTO user_meal_visibilities')
      );
      expect(visibilityUpsertCall).toBeDefined();
      expect(visibilityUpsertCall![1][4]).toBe(true); // $5 boolean flag (default_time !== undefined)
      expect(visibilityUpsertCall![1][5]).toBe('11:30'); // $6 default_time
    });

    it('should support clearing default_time by passing null', async () => {
      const mealTypeId = uuidv4();
      const userId = uuidv4();
      const data = { default_time: null };

      mockClient.query.mockImplementation((sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return Promise.resolve();
        return Promise.resolve({
          rows: [{ id: mealTypeId, default_time: null }],
        });
      });

      await mealTypeRepository.updateMealType(mealTypeId, data, userId);

      const visibilityUpsertCall = mockClient.query.mock.calls.find(
        (call: any[]) => call[0].includes('INSERT INTO user_meal_visibilities')
      );
      expect(visibilityUpsertCall).toBeDefined();
      expect(visibilityUpsertCall![1][4]).toBe(true); // $5 flag is true
      expect(visibilityUpsertCall![1][5]).toBeNull(); // $6 default_time is null
    });
  });
});
