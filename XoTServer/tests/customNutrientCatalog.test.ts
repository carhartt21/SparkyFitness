import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MICRONUTRIENT_CATALOG,
  MULTIVITAMIN_PANEL_IDS,
  FOOD_VARIANT_NUTRIENT_FIELDS,
  getMicronutrientById,
  normalizeNutrientName,
} from '@workspace/shared';

vi.mock('../db/poolManager', () => ({
  getClient: vi.fn(),
  getSystemClient: vi.fn(),
}));
vi.mock('../config/logging', () => ({
  log: vi.fn(),
}));
vi.mock('../utils/timezoneLoader', () => ({
  loadUserTimezone: vi.fn().mockResolvedValue('UTC'),
}));

const { getClient } = await import('../db/poolManager.js');
const { default: customNutrientService } =
  await import('../services/customNutrientService.js');

const USER = 'user-1';

describe('MICRONUTRIENT_CATALOG', () => {
  it('has unique ids and unique canonical names', () => {
    const ids = MICRONUTRIENT_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);

    const names = MICRONUTRIENT_CATALOG.map((entry) =>
      normalizeNutrientName(entry.displayName)
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it('never lets two entries claim the same alias', () => {
    const seen = new Map<string, string>();
    for (const entry of MICRONUTRIENT_CATALOG) {
      for (const alias of entry.aliases) {
        const key = normalizeNutrientName(alias);
        const owner = seen.get(key);
        expect(
          owner === undefined || owner === entry.id,
          `alias "${alias}" claimed by both ${owner} and ${entry.id}`
        ).toBe(true);
        seen.set(key, entry.id);
      }
    }
  });

  it('only points fixedField at real food_variant nutrient columns', () => {
    for (const entry of MICRONUTRIENT_CATALOG) {
      if (!entry.fixedField) continue;
      expect(FOOD_VARIANT_NUTRIENT_FIELDS).toContain(entry.fixedField);
    }
  });

  it('includes the micronutrients the fixed food fields do not cover', () => {
    // The whole point of the catalog: the 17 fixed fields have no vitamin D, K,
    // magnesium, zinc or B12, which is most of what people actually supplement.
    for (const id of [
      'vitamin_d',
      'vitamin_k',
      'magnesium',
      'zinc',
      'vitamin_b12',
    ]) {
      const entry = getMicronutrientById(id);
      expect(entry, `${id} missing from catalog`).toBeDefined();
      expect(entry?.fixedField).toBeUndefined();
    }
  });

  it('exposes a multivitamin panel drawn from the catalog', () => {
    expect(MULTIVITAMIN_PANEL_IDS.length).toBeGreaterThan(10);
    for (const id of MULTIVITAMIN_PANEL_IDS) {
      expect(getMicronutrientById(id)).toBeDefined();
    }
  });
});

interface Definition {
  id: string;
  name: string;
  unit: string;
  catalog_id: string | null;
  archived: boolean;
}
function catalogClient(initial: Definition[] = [], reserved: string[] = []) {
  const rows = initial.map((row) => ({ ...row }));
  const queries: string[] = [];
  const release = vi.fn();
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    queries.push(sql);
    if (
      ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) ||
      sql.includes('pg_advisory_xact_lock')
    )
      return { rows: [] };
    if (sql.startsWith('SELECT')) {
      if (sql.includes('nutrient_key_is_reserved'))
        return { rows: [{ exists: reserved.includes(String(params[1])) }] };
      return { rows: rows.map((row) => ({ ...row })) };
    }
    if (sql.startsWith('UPDATE')) {
      const row = rows.find(
        (row) => row.id === (sql.includes('catalog_id') ? params[1] : params[0])
      );
      if (row) {
        if (sql.includes('catalog_id')) row.catalog_id = String(params[0]);
        else row.archived = false;
      }
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO user_custom_nutrients')) {
      const row = {
        id: `new-${rows.length}`,
        name: String(params[1]),
        unit: String(params[2]),
        catalog_id: String(params[4]),
        archived: false,
      };
      rows.push(row);
      return { rows: [{ ...row }] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  vi.mocked(getClient).mockResolvedValue({ query, release } as never);
  return { rows, queries, release };
}

describe('native supplement catalog identity', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('provisions native definitions and their units without inventing goals or recorded amounts', async () => {
    const db = catalogClient();
    const result = await customNutrientService.ensureCatalogNutrients(USER, [
      'magnesium',
      'vitamin_d',
      'vitamin_c',
    ]);
    expect(result.resolved).toEqual([
      { catalogId: 'magnesium', name: 'Magnesium' },
      { catalogId: 'vitamin_d', name: 'Vitamin D' },
      { catalogId: 'vitamin_c', name: 'Vitamin C', fixedField: 'vitamin_c' },
    ]);
    expect(result.created).toHaveLength(2);
    expect(db.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Magnesium',
          unit: 'mg',
          catalog_id: 'magnesium',
        }),
      ])
    );
    expect(
      db.queries.some((sql) =>
        /goal|preference|food_entries|medication_entries/.test(sql)
      )
    ).toBe(false);
    expect(db.release).toHaveBeenCalledOnce();
  });
  it('reuses identity and preserves existing storage units and preferences on replay', async () => {
    const db = catalogClient([
      {
        id: 'mg',
        name: 'Magnesium',
        unit: 'g',
        catalog_id: null,
        archived: false,
      },
    ]);
    const first = await customNutrientService.ensureCatalogNutrients(USER, [
      'magnesium',
      'magnesium',
    ]);
    expect(first.created).toEqual([]);
    expect(first.resolved).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ unit: 'g', catalog_id: 'magnesium' });
    expect(
      (await customNutrientService.ensureCatalogNutrients(USER, ['magnesium']))
        .created
    ).toEqual([]);
  });
  it('does not bind loose aliases or collapse chemically different nutrients', async () => {
    catalogClient([
      {
        id: 'mixed',
        name: 'Fat-solubles',
        unit: 'µg',
        catalog_id: null,
        archived: false,
      },
    ]);
    const result = await customNutrientService.ensureCatalogNutrients(USER, [
      'vitamin_d',
      'vitamin_k',
    ]);
    expect(result.resolved.map((row) => row.name)).toEqual([
      'Vitamin D',
      'Vitamin K',
    ]);
  });
  it.each([
    [
      {
        id: 'mg',
        name: 'Magnesium',
        unit: 'IU',
        catalog_id: null,
        archived: false,
      },
    ],
    [
      {
        id: 'mg',
        name: 'Magnesium',
        unit: 'mg',
        catalog_id: 'zinc',
        archived: false,
      },
    ],
  ])('rejects an incompatible definition and rolls back', async (initial) => {
    const db = catalogClient([initial]);
    await expect(
      customNutrientService.ensureCatalogNutrients(USER, ['magnesium'])
    ).rejects.toMatchObject({ status: 409 });
    expect(db.queries).toContain('ROLLBACK');
    expect(db.queries).not.toContain('COMMIT');
  });
  it('rejects historical orphan keys instead of assigning a guessed unit', async () => {
    const db = catalogClient([], ['Magnesium']);
    await expect(
      customNutrientService.ensureCatalogNutrients(USER, ['magnesium'])
    ).rejects.toMatchObject({ status: 409 });
    expect(db.queries).toContain('ROLLBACK');
  });
  it('resolves the entire native multivitamin panel and keeps fixed fields distinct', async () => {
    catalogClient();
    const result = await customNutrientService.ensureCatalogNutrients(
      USER,
      MULTIVITAMIN_PANEL_IDS
    );
    expect(result.resolved).toHaveLength(MULTIVITAMIN_PANEL_IDS.length);
    expect(
      result.resolved.find((row) => row.catalogId === 'vitamin_a')?.fixedField
    ).toBe('vitamin_a');
  });
  it('preserves the legacy non-native picker and skips unknown catalog IDs', async () => {
    vi.spyOn(customNutrientService, 'getCustomNutrients').mockResolvedValue([]);
    const create = vi
      .spyOn(customNutrientService, 'createCustomNutrient')
      .mockImplementation(
        async (_userId, payload) => ({ ...payload }) as never
      );
    const result = await customNutrientService.ensureCatalogNutrients(USER, [
      'not_a_nutrient',
      'caffeine',
    ]);
    expect(create).not.toHaveBeenCalled();
    expect(result.resolved).toEqual([
      { catalogId: 'caffeine', name: 'Caffeine', fixedField: 'caffeine_mg' },
    ]);
  });
  it('returns the refreshed native definitions for a mixed catalog request', async () => {
    const db = catalogClient();
    vi.spyOn(customNutrientService, 'getCustomNutrients').mockResolvedValue([]);
    const result = await customNutrientService.ensureCatalogNutrients(USER, [
      'caffeine',
      'magnesium',
    ]);
    expect(result.resolved).toEqual([
      { catalogId: 'magnesium', name: 'Magnesium' },
      { catalogId: 'caffeine', name: 'Caffeine', fixedField: 'caffeine_mg' },
    ]);
    expect(result.nutrients).toEqual(db.rows);
    expect(result.nutrients).toEqual([
      expect.objectContaining({ catalog_id: 'magnesium', unit: 'mg' }),
    ]);
  });
});
