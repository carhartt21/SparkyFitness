import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { getClient } from '../db/poolManager.js';
import foodEntryRepository from '../models/foodEntry.js';
import type { FoodEntryInput } from '../types/nutrition.js';

vi.mock('../db/poolManager.js', () => ({ getClient: vi.fn() }));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

const owner = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
const operation = '33333333-3333-4333-8333-333333333333';

function entry(user_id: string, client_operation_id?: string): FoodEntryInput {
  return {
    user_id,
    client_operation_id,
    food_id: '44444444-4444-4444-8444-444444444444',
    variant_id: '55555555-5555-4555-8555-555555555555',
    meal_type_id: '66666666-6666-4666-8666-666666666666',
    quantity: 1,
    unit: 'g',
    entry_date: '2026-09-23',
  };
}

function mockDatabase() {
  const rows = new Map<
    string,
    { id: string; user_id: string; client_operation_id: string | null }
  >();
  let inserts = 0;
  let raceOnNextInsert = false;
  const clients: { release: ReturnType<typeof vi.fn> }[] = [];
  vi.mocked(getClient).mockImplementation(async () => {
    const client = {
      release: vi.fn(),
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        if (
          sql.includes('FROM food_entries') &&
          sql.includes('client_operation_id')
        ) {
          const key = `${params?.[0]}:${params?.[1]}`;
          return { rows: rows.has(key) ? [rows.get(key)] : [] };
        }
        if (sql.includes('FROM foods f')) {
          return {
            rows: [
              {
                name: 'Test food',
                brand: 'Synthetic',
                serving_size: 100,
                serving_unit: 'g',
                calories: 42,
                protein: 1,
                carbs: 2,
                fat: 3,
              },
            ],
          };
        }
        if (sql.includes('INSERT INTO food_entries')) {
          inserts += 1;
          expect(sql).toContain('client_operation_id');
          const user_id = String(params?.[0]);
          const client_operation_id = (params?.[45] as string | null) ?? null;
          const key = `${user_id}:${client_operation_id}`;
          if (raceOnNextInsert) {
            raceOnNextInsert = false;
            rows.set(key, {
              id: 'concurrent-id',
              user_id,
              client_operation_id,
            });
            throw Object.assign(new Error('unique violation'), {
              code: '23505',
              constraint: 'idx_food_entries_user_client_operation_id',
            });
          }
          const row = { id: `entry-${inserts}`, user_id, client_operation_id };
          if (client_operation_id) rows.set(key, row);
          return { rows: [row] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
    };
    clients.push(client);
    return client;
  });
  return {
    rows,
    clients,
    get inserts() {
      return inserts;
    },
    simulateConcurrentFirstAttempt() {
      raceOnNextInsert = true;
    },
  };
}

describe('food-entry client operation idempotency', () => {
  it('creates once, returns the same snapshot on retry and after lost response', async () => {
    const db = mockDatabase();
    const first = await foodEntryRepository.createFoodEntry(
      entry(owner, operation),
      owner
    );
    const retry = await foodEntryRepository.createFoodEntry(
      entry(owner, operation),
      owner
    );
    expect(retry).toEqual(first);
    expect(db.inserts).toBe(1);
    expect(
      db.clients.every((client) => client.release.mock.calls.length === 1)
    ).toBe(true);
  });

  it('creates another entry for a new operation ID', async () => {
    const db = mockDatabase();
    await foodEntryRepository.createFoodEntry(entry(owner, operation), owner);
    await foodEntryRepository.createFoodEntry(
      entry(owner, '77777777-7777-4777-8777-777777777777'),
      owner
    );
    expect(db.inserts).toBe(2);
  });

  it('scopes the same operation ID to each diary owner', async () => {
    const db = mockDatabase();
    await foodEntryRepository.createFoodEntry(entry(owner, operation), owner);
    await foodEntryRepository.createFoodEntry(
      entry(otherOwner, operation),
      otherOwner
    );
    expect(db.inserts).toBe(2);
    expect(db.rows.size).toBe(2);
  });

  it('preserves legacy callers without an operation ID', async () => {
    const db = mockDatabase();
    await foodEntryRepository.createFoodEntry(entry(owner), owner);
    await foodEntryRepository.createFoodEntry(entry(owner), owner);
    expect(db.inserts).toBe(2);
  });

  it('returns a concurrently committed row after unique-index rejection', async () => {
    const db = mockDatabase();
    db.simulateConcurrentFirstAttempt();
    const result = await foodEntryRepository.createFoodEntry(
      entry(owner, operation),
      owner
    );
    expect(result.id).toBe('concurrent-id');
    expect(db.inserts).toBe(1);
    expect(db.clients[0].release).toHaveBeenCalledOnce();
  });

  it('has a nullable owner-scoped unique index in the migration', () => {
    const sql = readFileSync(
      new URL(
        '../db/migrations/20260923000000_add_food_entry_client_operation_id.sql',
        import.meta.url
      ),
      'utf8'
    );
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS client_operation_id uuid');
    expect(sql).toMatch(
      /UNIQUE INDEX IF NOT EXISTS idx_food_entries_user_client_operation_id[\s\S]*\(user_id, client_operation_id\)/
    );
    expect(sql).toContain('WHERE client_operation_id IS NOT NULL');
  });

  it('permits only owner-written standalone snapshots through the operation contract', () => {
    const sql = readFileSync(
      new URL(
        '../db/migrations/20260923010000_allow_offline_food_snapshots.sql',
        import.meta.url
      ),
      'utf8'
    );
    expect(sql).toContain('user_id = public.authenticated_user_id()');
    expect(sql).toContain('client_operation_id IS NOT NULL');
    expect(sql).toContain('food_id IS NULL');
    expect(sql).toContain('meal_id IS NULL');
    expect(sql).toContain('serving_size > 0');
    expect(sql).toContain('calories >= 0');
  });
});
