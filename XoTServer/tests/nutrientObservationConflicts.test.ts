import { describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import type { HealthNutrientQuantity } from '@workspace/shared';
import { resolveNutrientQuantities } from '../services/nutrientObservationService.js';

interface Definition {
  id: string;
  name: string;
  unit: string;
  catalog_id: string | null;
  archived: boolean;
}

/** Just enough of a PoolClient for the resolver's queries. */
function fakeClient(definitions: Definition[], reservedKeys: string[] = []) {
  const inserted: unknown[][] = [];
  const client = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (sql.startsWith('SELECT id, name, unit, catalog_id, archived')) {
        return { rows: definitions.map((row) => ({ ...row })) };
      }
      if (sql.includes('nutrient_key_is_reserved')) {
        return { rows: [{ exists: reservedKeys.includes(String(params[1])) }] };
      }
      if (sql.includes('INSERT INTO user_custom_nutrients')) {
        inserted.push(params);
        return {
          rows: [
            {
              id: `new-${inserted.length}`,
              name: params[1],
              unit: params[2],
              catalog_id: params[4],
              archived: false,
            },
          ],
        };
      }
      if (sql.startsWith('UPDATE user_custom_nutrients')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  return { client: client as unknown as PoolClient, inserted };
}

describe('native nutrient conflicts', () => {
  const quantities: HealthNutrientQuantity[] = [
    { catalogId: 'magnesium', amount: 40, unit: 'mg' },
    { catalogId: 'zinc', amount: 2, unit: 'mg' },
    { catalogId: 'vitamin_c', amount: 12, unit: 'mg' },
  ];
  // A legacy "Magnesium" definition in a unit no mass can convert to.
  const legacy: Definition[] = [
    {
      id: 'legacy',
      name: 'Magnesium',
      unit: 'IU',
      catalog_id: null,
      archived: false,
    },
  ];

  it('fails the whole resolution by default so an interactive import surfaces it', async () => {
    const { client } = fakeClient(legacy);
    await expect(
      resolveNutrientQuantities(client, 'user', quantities)
    ).rejects.toMatchObject({ status: 409 });
  });

  it('skips only the conflicting nutrient when asked, keeping the others', async () => {
    const { client, inserted } = fakeClient(legacy);
    const result = await resolveNutrientQuantities(client, 'user', quantities, {
      onConflict: 'skip',
    });
    expect(result.skipped).toEqual(['magnesium']);
    expect(result.custom).toEqual({ Zinc: 2 });
    expect(result.fixed).toEqual({ vitamin_c: 12 });
    expect(inserted).toHaveLength(1);
  });

  it('skips an orphaned historical key instead of guessing its unit', async () => {
    const { client, inserted } = fakeClient([], ['Chromium']);
    const result = await resolveNutrientQuantities(
      client,
      'user',
      [
        { catalogId: 'chromium', amount: 5, unit: 'µg' },
        { catalogId: 'magnesium', amount: 40, unit: 'mg' },
      ] satisfies HealthNutrientQuantity[],
      { onConflict: 'skip' }
    );
    expect(result.skipped).toEqual(['chromium']);
    expect(result.custom).toEqual({ Magnesium: 40 });
    expect(inserted.map((params) => params[1])).toEqual(['Magnesium']);
  });

  it('still throws non-conflict errors in skip mode', async () => {
    const client = {
      async query(sql: string) {
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        throw new Error('connection lost');
      },
    } as unknown as PoolClient;
    await expect(
      resolveNutrientQuantities(client, 'user', quantities, {
        onConflict: 'skip',
      })
    ).rejects.toThrow('connection lost');
  });
});
