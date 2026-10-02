/** Explicit disposable-database verification: RUN_MICRONUTRIENT_DB_INTEGRATION=1. */
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getClient, getSystemClient, endPool } from '../db/poolManager.js';
import measurementService from '../services/measurementService.js';
import foodCoreService from '../services/foodCoreService.js';
import customNutrientService from '../services/customNutrientService.js';
import { resolveNutrientQuantities } from '../services/nutrientObservationService.js';
import { repairBlsMicronutrients } from '../services/blsMicronutrientRepairService.js';
import { getNutrientCoverage } from '../models/nutrientCoverageRepository.js';

const RUN =
  process.env.RUN_MICRONUTRIENT_DB_INTEGRATION === '1' &&
  /_test$/.test(process.env.SPARKY_FITNESS_DB_NAME ?? '');
const owner = randomUUID();
const delegate = randomUUID();
const outsider = randomUUID();
const date = '2026-10-01';
const record = (id: string, amount?: number) => ({
  type: 'Nutrition',
  source: 'HealthKit',
  source_id: id,
  timestamp: `${date}T12:00:00Z`,
  food_name: 'Synthetic same-name food',
  meal_type: 'lunch',
  calories: 10,
  ...(amount === undefined
    ? {}
    : {
        nutrient_observation: {
          mode: 'partial',
          quantities: [{ catalogId: 'magnesium', amount, unit: 'mg' }],
        },
      }),
});

async function ingest(id: string, amount?: number, actor = owner) {
  await measurementService.processHealthData(
    [record(id, amount)],
    owner,
    actor
  );
}

async function customValues() {
  const client: PoolClient = await getClient(owner, owner);
  try {
    return (
      await client.query<{
        source_id: string;
        custom_nutrients: Record<string, number>;
      }>(
        'SELECT source_id, custom_nutrients FROM food_entries WHERE user_id = $1 ORDER BY source_id',
        [owner]
      )
    ).rows;
  } finally {
    client.release();
  }
}

describe.runIf(RUN)('micronutrient persistence with real RLS', () => {
  beforeAll(async () => {
    const client: PoolClient = await getSystemClient();
    try {
      for (const id of [owner, delegate, outsider])
        await client.query(
          'INSERT INTO public."user" (id, email, email_verified) VALUES ($1, $2, true)',
          [id, `micro-${id}@example.test`]
        );
      await client.query(
        "INSERT INTO meal_types (user_id, name, sort_order) VALUES ($1, 'lunch', 1)",
        [owner]
      );
      await client.query(
        `INSERT INTO family_access (owner_user_id, family_user_id, family_email, access_permissions, is_active, status)
        VALUES ($1, $2, $3, '{"can_manage_diary":true,"can_view_reports":true}'::jsonb, true, 'active')`,
        [owner, delegate, `micro-${delegate}@example.test`]
      );
    } finally {
      client.release();
    }
  });
  afterAll(async () => {
    const client: PoolClient = await getSystemClient();
    try {
      await client.query(
        'DELETE FROM public."user" WHERE id = ANY($1::uuid[])',
        [[owner, delegate, outsider]]
      );
    } finally {
      client.release();
      await endPool();
    }
  });

  it('keeps equal-named records independent, preserves omitted values on replay, and knows zero', async () => {
    await ingest('a', 100);
    await ingest('b', 20);
    await ingest('a');
    await ingest('zero', 0);
    await ingest('missing');
    const values = await customValues();
    expect(values).toHaveLength(4);
    expect(
      values.find((row) => row.source_id === 'a')?.custom_nutrients
    ).toEqual({ Magnesium: 100 });
    expect(
      values.find((row) => row.source_id === 'b')?.custom_nutrients
    ).toEqual({ Magnesium: 20 });
    expect(
      values.find((row) => row.source_id === 'zero')?.custom_nutrients
    ).toEqual({ Magnesium: 0 });
    expect(
      values.find((row) => row.source_id === 'missing')?.custom_nutrients
    ).toEqual({});
    const coverage = await getNutrientCoverage(owner, owner, date, date);
    expect(coverage[date]?.magnesium).toEqual({
      knownEntryCount: 3,
      eligibleEntryCount: 4,
      recordedTotal: 120,
      unit: 'mg',
    });
    expect(coverage[date]?.selenium?.recordedTotal).toBeNull();
  });

  it('permits diary-delegate snapshots without creating or editing library rows', async () => {
    const before = await customValues();
    await ingest('delegate', 30, delegate);
    const client: PoolClient = await getClient(owner, owner);
    try {
      const row = await client.query<{
        food_id: string | null;
        custom_nutrients: Record<string, number>;
      }>(
        "SELECT food_id, custom_nutrients FROM food_entries WHERE user_id = $1 AND source_id = 'delegate'",
        [owner]
      );
      expect(row.rows[0]).toMatchObject({
        food_id: null,
        custom_nutrients: { Magnesium: 30 },
      });
      expect(await customValues()).toHaveLength(before.length + 1);
    } finally {
      client.release();
    }
  });

  it('denies an unrelated actor and exposes no owner coverage', async () => {
    await ingest('outsider', 40, outsider);
    expect(
      (await customValues()).some((row) => row.source_id === 'outsider')
    ).toBe(false);
    expect(await getNutrientCoverage(owner, outsider, date, date)).toEqual({});
  });

  it('serializes concurrent binding and retains one definition', async () => {
    await Promise.all(
      [1, 2].map(async (amount) => {
        const client: PoolClient = await getClient(owner, owner);
        try {
          await client.query('BEGIN');
          await resolveNutrientQuantities(client, owner, [
            { catalogId: 'zinc', amount, unit: 'mg' },
          ]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      })
    );
    const definitions = await customNutrientService.getCustomNutrients(owner);
    expect(
      definitions.filter(
        (row: { catalog_id: string }) => row.catalog_id === 'zinc'
      )
    ).toHaveLength(1);
    const magnesium = definitions.find(
      (row: { catalog_id: string }) => row.catalog_id === 'magnesium'
    );
    await expect(
      customNutrientService.updateCustomNutrient(owner, magnesium.id, {
        unit: 'g',
      })
    ).rejects.toMatchObject({ status: 409 });
  });
  it('counts meal children and taken supplements once, scales doses, and ignores malformed values', async () => {
    const client: PoolClient = await getSystemClient();
    const day = '2026-10-02';
    try {
      const meal = await client.query<{ id: string }>(
        `INSERT INTO food_entry_meals (user_id, entry_date, name, created_by_user_id, updated_by_user_id, meal_type_id)
         SELECT $1, $2, 'Synthetic meal', $1, $1, id FROM meal_types WHERE user_id = $1 LIMIT 1 RETURNING id`,
        [owner, day]
      );
      await client.query(
        `INSERT INTO food_entries (user_id, food_entry_meal_id, entry_date, food_name, quantity, unit, serving_size, custom_nutrients, created_by_user_id, updated_by_user_id, meal_type_id)
        SELECT $1, $2, $3, 'Synthetic component', 50, 'g', 100, $4::jsonb, $1, $1, id FROM meal_types WHERE user_id = $1 LIMIT 1`,
        [owner, meal.rows[0]!.id, day, JSON.stringify({ Magnesium: 40 })]
      );
      for (const [status, amount] of [
        ['taken', 10],
        ['taken', 'invalid'],
        ['skipped', 100],
      ] as const)
        await client.query(
          `INSERT INTO medication_entries (user_id, entry_date, med_name_snapshot, status, dose_amount_snapshot, nutrients_snapshot)
          VALUES ($1, $2, 'Synthetic supplement', $3, 2, $4::jsonb)`,
          [
            owner,
            day,
            status,
            JSON.stringify({ custom_nutrients: { Magnesium: amount } }),
          ]
        );
    } finally {
      client.release();
    }
    const coverage = await getNutrientCoverage(owner, owner, day, day);
    expect(coverage[day]?.magnesium).toEqual({
      knownEntryCount: 2,
      eligibleEntryCount: 3,
      recordedTotal: 40,
      unit: 'mg',
    });
    const delegated = await getNutrientCoverage(owner, delegate, day, day);
    // Report permission includes nutritional supplement snapshots through existing RLS.
    expect(delegated[day]?.magnesium).toEqual(coverage[day]?.magnesium);
  });

  it('repairs missing BLS keys only, rolls back dry runs, and is safe to replay', async () => {
    const code = `synthetic-${owner}`;
    const client: PoolClient = await getSystemClient();
    try {
      await client.query(
        `INSERT INTO bls4_foods (code, name_de, name_en, nutrients, dataset_sha256)
        VALUES ($1, 'Synthetic', 'Synthetic', $2::jsonb, $3)`,
        [
          code,
          JSON.stringify({
            ENERCC: 10,
            PROT625: 1,
            CHO: 1,
            FAT: 1,
            MG: 45,
            ZN: 20,
            CU: 500,
          }),
          '12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91',
        ]
      );
      const food = await client.query<{ id: string }>(
        "INSERT INTO foods (user_id, name, provider_type, provider_external_id, shared_with_public) VALUES ($1, 'Synthetic BLS', 'bls4', $2, false) RETURNING id",
        [owner, code]
      );
      const result = await client.query<{ id: string }>(
        "INSERT INTO food_variants (food_id, serving_size, serving_unit, source, custom_nutrients) VALUES ($1, 100, 'g', 'imported', '{\"Magnesium\":0}') RETURNING id",
        [food.rows[0]!.id]
      );
      const variant = result.rows[0]!.id;
      expect(
        await repairBlsMicronutrients(owner, { apply: false, limit: 20 })
      ).toMatchObject({ scanned: 0, changed: 0 });
      expect(
        await repairBlsMicronutrients(owner, {
          apply: false,
          limit: 20,
          includeUnversioned: true,
        })
      ).toMatchObject({ scanned: 1, changed: 1, added: 2 });
      expect(
        (
          await client.query(
            'SELECT custom_nutrients FROM food_variants WHERE id = $1',
            [variant]
          )
        ).rows[0].custom_nutrients
      ).toEqual({ Magnesium: 0 });
      expect(
        await repairBlsMicronutrients(owner, {
          apply: true,
          limit: 20,
          includeUnversioned: true,
        })
      ).toMatchObject({ scanned: 1, changed: 1, added: 2 });
      expect(
        (
          await client.query(
            'SELECT custom_nutrients FROM food_variants WHERE id = $1',
            [variant]
          )
        ).rows[0].custom_nutrients
      ).toEqual({ Magnesium: 0, Zinc: 20, Copper: 0.5 });
      expect(
        await repairBlsMicronutrients(owner, {
          apply: true,
          limit: 20,
          includeUnversioned: true,
        })
      ).toMatchObject({ changed: 0, added: 0 });
      await client.query(
        "UPDATE food_variants SET updated_at = created_at + interval '1 second' WHERE id = $1",
        [variant]
      );
      expect(
        await repairBlsMicronutrients(owner, {
          apply: false,
          limit: 20,
          includeUnversioned: true,
        })
      ).toMatchObject({ scanned: 0 });
    } finally {
      await client.query('DELETE FROM bls4_foods WHERE code = $1', [code]);
      client.release();
    }
  });

  it('loads BLS quantities from the trusted catalog and ignores client nutrient injection', async () => {
    const code = `trusted-${owner}`;
    const client: PoolClient = await getSystemClient();
    try {
      await client.query(
        "INSERT INTO bls4_foods (code, name_de, name_en, nutrients, dataset_sha256) VALUES ($1, 'Synthetic', 'Synthetic', $2::jsonb, $3)",
        [
          code,
          JSON.stringify({
            ENERCC: 10,
            PROT625: 1,
            CHO: 1,
            FAT: 1,
            MG: 45,
            VITA: 900,
          }),
          '12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91',
        ]
      );
      const imported = await foodCoreService.createFood(owner, {
        name: 'Synthetic trusted import',
        user_id: owner,
        provider_type: 'bls4',
        provider_external_id: code,
        vitamin_a: 999,
        custom_nutrients: { Magnesium: 999, Folate: 999 },
        provider_dataset_sha256: '0'.repeat(64),
      });
      const rows = await client.query<{
        vitamin_a: string | null;
        custom_nutrients: Record<string, number>;
        provider_dataset_sha256: string;
      }>(
        'SELECT vitamin_a, custom_nutrients, provider_dataset_sha256 FROM food_variants WHERE food_id = $1',
        [imported.id]
      );
      expect(rows.rows[0]).toMatchObject({
        vitamin_a: null,
        custom_nutrients: { Magnesium: 45 },
        provider_dataset_sha256:
          '12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91',
      });
      expect(rows.rows[0]!.custom_nutrients).not.toHaveProperty('Folate');
    } finally {
      await client.query('DELETE FROM bls4_foods WHERE code = $1', [code]);
      client.release();
    }
  });

  it('refuses to recreate or bind orphaned historical keys with unknown units', async () => {
    const client: PoolClient = await getSystemClient();
    try {
      await client.query(
        "UPDATE food_entries SET custom_nutrients = custom_nutrients || '{\"Chromium\":12}'::jsonb WHERE user_id = $1 AND source_id = 'a'",
        [owner]
      );
    } finally {
      client.release();
    }
    await expect(
      customNutrientService.createCustomNutrient(owner, {
        name: 'Chromium',
        unit: 'µg',
      })
    ).rejects.toMatchObject({ status: 409 });
    const scoped: PoolClient = await getClient(owner, delegate);
    try {
      await scoped.query('BEGIN');
      await expect(
        resolveNutrientQuantities(scoped, owner, [
          { catalogId: 'chromium', amount: 1, unit: 'µg' },
        ])
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      await scoped.query('ROLLBACK');
      scoped.release();
    }
    const coverage = await getNutrientCoverage(owner, owner, date, date);
    expect(coverage[date]?.chromium?.recordedTotal).toBeNull();
    const cleanup: PoolClient = await getSystemClient();
    try {
      await cleanup.query(
        "UPDATE food_entries SET custom_nutrients = custom_nutrients - 'Chromium' WHERE user_id = $1 AND source_id = 'a'",
        [owner]
      );
    } finally {
      cleanup.release();
    }
  });

  it('saves a native record without only the nutrient whose definition conflicts', async () => {
    // A legacy key with no definition on another record: its unit cannot be
    // recovered, so selenium must be refused rather than guessed.
    await ingest('orphan-holder');
    const client: PoolClient = await getSystemClient();
    try {
      await client.query(
        "UPDATE food_entries SET custom_nutrients = custom_nutrients || '{\"Selenium\":0.02}'::jsonb WHERE user_id = $1 AND source_id = 'orphan-holder'",
        [owner]
      );
    } finally {
      client.release();
    }
    await measurementService.processHealthData(
      [
        {
          ...record('conflict'),
          nutrient_observation: {
            mode: 'partial',
            quantities: [
              { catalogId: 'selenium', amount: 20, unit: 'µg' },
              { catalogId: 'magnesium', amount: 25, unit: 'mg' },
            ],
          },
        },
      ],
      owner,
      owner
    );
    const scoped: PoolClient = await getClient(owner, owner);
    try {
      const saved = await scoped.query<{
        calories: string;
        custom_nutrients: Record<string, number>;
      }>(
        "SELECT calories, custom_nutrients FROM food_entries WHERE user_id = $1 AND source_id = 'conflict'",
        [owner]
      );
      expect(saved.rows).toHaveLength(1);
      expect(Number(saved.rows[0]!.calories)).toBe(10);
      expect(saved.rows[0]!.custom_nutrients).toEqual({ Magnesium: 25 });
    } finally {
      scoped.release();
    }
  });

  it('accepts built-in meal types for diary delegates without granting library writes', async () => {
    const client: PoolClient = await getSystemClient();
    let mealType: string;
    try {
      const result = await client.query<{ name: string }>(
        'SELECT name FROM meal_types WHERE user_id IS NULL LIMIT 1'
      );
      mealType = result.rows[0]!.name;
    } finally {
      client.release();
    }
    await measurementService.processHealthData(
      [{ ...record('built-in-meal', 5), meal_type: mealType }],
      owner,
      delegate
    );
    expect(
      (await customValues()).find((row) => row.source_id === 'built-in-meal')
        ?.custom_nutrients
    ).toEqual({ Magnesium: 5 });
  });

  it('rejects native authoritative clearing without changing retained observations', async () => {
    await measurementService.processHealthData(
      [
        {
          ...record('a'),
          nutrient_observation: {
            mode: 'authoritative',
            coveredCatalogIds: ['magnesium'],
            quantities: [],
          },
        },
      ],
      owner,
      owner
    );
    expect(
      (await customValues()).find((row) => row.source_id === 'a')
        ?.custom_nutrients
    ).toEqual({ Magnesium: 100 });
  });

  it('retains the historical unit on delete and reactivates it without seeding goals', async () => {
    const definitions = await customNutrientService.getCustomNutrients(owner);
    const definition = definitions.find(
      (row: { catalog_id: string }) => row.catalog_id === 'magnesium'
    );
    expect(
      await customNutrientService.deleteCustomNutrient(
        owner,
        definition.id,
        false
      )
    ).toBe(true);
    expect(
      (await customNutrientService.getCustomNutrients(owner)).some(
        (row: { id: string }) => row.id === definition.id
      )
    ).toBe(false);
    await expect(
      customNutrientService.createCustomNutrient(owner, {
        name: 'Magnesium',
        unit: 'g',
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await customValues()).find((row) => row.source_id === 'a')
        ?.custom_nutrients
    ).toEqual({ Magnesium: 100 });
    await ingest('reactivated', 50);
    const active = (await customNutrientService.getCustomNutrients(owner)).find(
      (row: { id: string }) => row.id === definition.id
    );
    expect(active.unit).toBe('mg');
    const client: PoolClient = await getClient(owner, owner);
    try {
      expect(
        (
          await client.query(
            "SELECT 1 FROM user_goals WHERE user_id = $1 AND custom_nutrients ? 'Magnesium'",
            [owner]
          )
        ).rows
      ).toHaveLength(0);
    } finally {
      client.release();
    }
  });
});
