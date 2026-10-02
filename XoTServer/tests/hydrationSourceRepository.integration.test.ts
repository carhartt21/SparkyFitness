import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import {
  getHydrationSourceEntries,
  getHydrationSourceTotals,
} from '../models/hydrationSourceRepository.js';
import { summarizeHydrationEntries } from '../services/hydrationTotalsService.js';

// Explicitly opt into a disposable local database, never the application's DB.
const url = process.env.XOT_HYDRATION_TEST_DATABASE_URL;
const state = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock('../db/poolManager.js', () => ({
  getClient: async () => state.client,
}));
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: async () => 'Europe/Berlin',
}));

describe.skipIf(!url)('hydration SQL projection (isolated PostgreSQL)', () => {
  let pool: Pool;
  let release: (() => void) | undefined;
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      target.pathname !== '/xot_hydration_test'
    )
      throw new Error('Requires disposable local xot_hydration_test database');
    pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    release = () => client.release();
    state.client = {
      query: client.query.bind(client),
      release: () => undefined,
    };
    await client.query(`CREATE TEMP TABLE water_intake_entries(id text,user_id text,entry_date date,water_ml numeric,source text,container_name text,food_entry_id text,logged_at timestamptz);
      CREATE TEMP TABLE water_intake(user_id text,entry_date date,water_ml numeric,source text);
      CREATE TEMP TABLE user_preferences(user_id text,timezone text);
      CREATE TEMP TABLE food_entries(id text,user_id text,entry_date date,entry_time time,water_ml numeric,quantity numeric,serving_size numeric,unit text,food_name text,source text);
      CREATE TEMP TABLE medication_entries(id text,user_id text,entry_date date,status text,nutrients_snapshot jsonb,dose_amount_snapshot numeric,med_name_snapshot text,taken_at timestamptz,source text,medication_id text);
      CREATE OR REPLACE FUNCTION public.sf_try_numeric(value text) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RETURN value::numeric; EXCEPTION WHEN OTHERS THEN RETURN NULL; END $$;`);
    const migration = readFileSync(
      new URL(
        '../db/migrations/20260905150000_add_caffeine_alcohol_water_and_container_links.sql',
        import.meta.url
      ),
      'utf8'
    );
    const start = migration.indexOf(
      'CREATE OR REPLACE FUNCTION public.sf_volume_unit_to_ml'
    );
    await client.query(
      migration.slice(start, migration.indexOf('$$;', start) + 3)
    );
    await client.query(`INSERT INTO user_preferences VALUES ('u','Europe/Berlin');
      INSERT INTO water_intake VALUES ('u','2026-10-02',750,'manual'),('u','2026-10-02',100,'healthkit');
      INSERT INTO water_intake_entries VALUES ('w','u','2026-10-02',250,'manual','Glass',NULL,'2026-10-02T07:00Z'),('linked','u','2026-10-02',400,'manual',NULL,'linked-food','2026-10-02T08:00Z');
      INSERT INTO food_entries VALUES
      ('linked-food','u','2026-10-02','10:00',80,500,100,'ml','Linked drink','manual'),
      ('drink','u','2026-10-02','11:30',90,500,100,'ml','Energy drink','manual'),
      ('estimate','u','2026-10-02','12:00',NULL,0.25,100,'l','Tea','manual'),
      ('solid','u','2026-10-02','13:00',80,200,100,'g','Apple','manual'),
      ('unknown','u','2026-10-02',NULL,NULL,100,100,'g','Unknown food','manual'),
      ('old','u','2026-10-01','13:00',100,100,100,'ml','Old drink','manual'),
      ('other','other','2026-10-02','13:00',100,999,100,'ml','Private drink','manual');
      INSERT INTO medication_entries VALUES
      ('taken','u','2026-10-02','taken','{"water_ml":250}',2,'Electrolytes','2026-10-02T12:00Z','manual','m'),
      ('skipped','u','2026-10-02','skipped','{"water_ml":500}',1,'Skipped','2026-10-02T13:00Z','manual','m'),
      ('invalid','u','2026-10-02','taken','{"water_ml":"unknown"}',1,'Unknown','2026-10-02T13:00Z','manual','m');`);
    await client.query(
      "ALTER TABLE food_entries ADD COLUMN serving_unit text; UPDATE food_entries SET serving_unit='ml',unit='g' WHERE id='drink'; INSERT INTO food_entries(id,user_id,entry_date,water_ml,quantity,serving_size,unit,source) VALUES ('imported-drink','u','2026-10-03',100,300,100,'ml','health_connect')"
    );
    // Keep one checked-out connection for its temporary tables.
    await client.query('SELECT 1');
  });
  afterAll(async () => {
    release?.();
    await pool?.end();
  });
  it('counts drinks and taken supplement water once, keeps solids separate, and reconciles daily/range totals', async () => {
    const entries = await getHydrationSourceEntries('u', '2026-10-02');
    const totals = await getHydrationSourceTotals(
      'u',
      '2026-10-02',
      '2026-10-02'
    );
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({
      water_ml: 2050,
      ledger_ml: 850,
      manual_ml: 750,
      food_ml: 1200,
      drink_ml: 1100,
      supplement_ml: 500,
      solid_food_ml: 160,
      unknown_count: 1,
    });
    const { entry_date: _day, ...expected } = totals[0]!;
    expect(summarizeHydrationEntries(entries)).toEqual(expected);
    expect(_day).toBe('2026-10-02');
  });
  it('includes imported drink water without exporting it back', async () => {
    const [total] = await getHydrationSourceTotals(
      'u',
      '2026-10-03',
      '2026-10-03'
    );
    expect(total).toMatchObject({
      water_ml: 300,
      food_ml: 300,
      exportable_food_ml: 0,
    });
    expect(
      summarizeHydrationEntries(
        await getHydrationSourceEntries('u', '2026-10-03')
      )
    ).toMatchObject({ water_ml: 300, exportable_food_ml: 0 });
  });
  it('preserves unknowns, local times and source identities without creating records', async () => {
    const entries = await getHydrationSourceEntries('u', '2026-10-02');
    expect(entries.find((e) => e.id === 'food:drink')).toMatchObject({
      water_ml: 450,
      logged_at: '2026-10-02T09:30:00.000Z',
    });
    expect(entries.find((e) => e.id === 'food:unknown')).toMatchObject({
      water_ml: null,
      counts_toward_goal: false,
      amount_basis: 'unknown',
    });
    expect(
      entries.some(
        (e) =>
          e.id === 'food:linked-food' ||
          e.id === 'food:other' ||
          e.id === 'supplement:skipped'
      )
    ).toBe(false);
    expect(await getHydrationSourceEntries('u', '2026-10-04')).toEqual([]);
    expect(
      (await getHydrationSourceTotals('u', '2026-10-01', '2026-10-02')).map(
        (e) => e.water_ml
      )
    ).toEqual([100, 2050]);
  });
});
