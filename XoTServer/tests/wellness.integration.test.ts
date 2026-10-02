/** Run only against a migrated disposable *_test database with RUN_WELLNESS_INTEGRATION_TEST=1. */
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { wellnessActivityRequest } from '@workspace/shared';
import { createHabit, logHabit } from '../models/dailyTrackingRepository.js';
import { endPool, getClient, getSystemClient } from '../db/poolManager.js';
import measurementRepository from '../models/measurementRepository.js';

const run = process.env.RUN_WELLNESS_INTEGRATION_TEST === '1';
const owner = randomUUID();
const reader = randomUUID();
const writer = randomUUID();
const stranger = randomUUID();
const users = [owner, reader, writer, stranger];
let activityId = '';
describe.runIf(run)('wellness with PostgreSQL and real RLS', () => {
  beforeAll(async () => {
    if (!process.env.SPARKY_FITNESS_DB_NAME?.endsWith('_test'))
      throw new Error(
        'Wellness integration requires a disposable *_test database'
      );
    const client = await getSystemClient();
    try {
      for (const id of users)
        await client.query(
          'INSERT INTO public."user" (id, email, email_verified) VALUES ($1, $2, true)',
          [id, `wellness-${id}@example.test`]
        );
      for (const [id, permissions] of [
        [reader, { can_view_reports: true }],
        [writer, { can_manage_checkin: true }],
      ] as const)
        await client.query(
          `INSERT INTO family_access (owner_user_id, family_user_id, family_email, access_permissions, is_active, status)
          VALUES ($1, $2, $3, $4::jsonb, true, 'active')`,
          [
            owner,
            id,
            `wellness-${id}@example.test`,
            JSON.stringify(permissions),
          ]
        );
    } finally {
      client.release();
    }
    const results = await Promise.all([
      createHabit(owner, owner, wellnessActivityRequest('Synthetic Sauna')),
      createHabit(owner, owner, wellnessActivityRequest('Synthetic Sauna')),
    ]);
    expect(results[0].id).toBe(results[1].id);
    activityId = results[0].id;
  });
  afterAll(async () => {
    const client = await getSystemClient();
    try {
      await client.query(
        'DELETE FROM public."user" WHERE id = ANY($1::uuid[])',
        [users]
      );
    } finally {
      client.release();
      await endPool();
    }
  });
  it('allows a check-in delegate to log and serializes simultaneous daily saves', async () => {
    await Promise.all([
      logHabit(owner, writer, activityId, '2026-10-01', true),
      logHabit(owner, owner, activityId, '2026-10-01', true),
    ]);
    const client: PoolClient = await getClient(owner, owner);
    try {
      const result = await client.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM custom_measurements WHERE category_id = $1 AND entry_date = $2',
        [activityId, '2026-10-01']
      );
      expect(result.rows[0].count).toBe(1);
    } finally {
      client.release();
    }
  });
  it('lets report delegates read and prevents them from writing', async () => {
    const client: PoolClient = await getClient(owner, reader);
    try {
      const result = await client.query(
        'SELECT id FROM custom_categories WHERE id = $1',
        [activityId]
      );
      expect(result.rows).toHaveLength(1);
      const changed = await client.query(
        'UPDATE custom_categories SET display_name = $2 WHERE id = $1 RETURNING id',
        [activityId, 'Forbidden rename']
      );
      expect(changed.rows).toEqual([]);
    } finally {
      client.release();
    }
    await expect(
      logHabit(owner, reader, activityId, '2026-10-02', true)
    ).rejects.toThrow();
  });
  it('keeps wellness out of measurement editors, history and carry-forward hints', async () => {
    const ordinary = await measurementRepository.createCustomCategory({
      user_id: owner,
      created_by_user_id: owner,
      name: 'Synthetic body measurement',
      display_name: null,
      measurement_type: 'cm',
      frequency: 'Daily',
      data_type: 'numeric',
    });
    await measurementRepository.upsertCustomMeasurement(
      owner,
      owner,
      ordinary.id,
      80,
      '2026-10-01'
    );
    const categories = await measurementRepository.getCustomCategories(owner);
    expect(categories).toHaveLength(1);
    expect(categories[0].id).toBe(ordinary.id);
    expect(
      await measurementRepository.getCustomMeasurementEntries(
        owner,
        null,
        null,
        null
      )
    ).toEqual([expect.objectContaining({ category_id: ordinary.id })]);
    expect(
      await measurementRepository.getCustomMeasurementEntriesByDate(
        owner,
        '2026-10-01'
      )
    ).toEqual([expect.objectContaining({ category_id: ordinary.id })]);
    expect(
      await measurementRepository.getCustomMeasurementEntriesByDateRange(
        owner,
        '2026-10-01',
        '2026-10-02'
      )
    ).toEqual([expect.objectContaining({ category_id: ordinary.id })]);
    expect(
      await measurementRepository.getLatestManualCustomEntriesOnOrBeforeDate(
        owner,
        '2026-10-02'
      )
    ).toEqual([expect.objectContaining({ category_id: ordinary.id })]);
    expect(
      await measurementRepository.getCustomMeasurementsByDateRange(
        owner,
        activityId,
        '2026-10-01',
        '2026-10-02'
      )
    ).toEqual([]);
  });
  it('hides wellness definitions and logs from an unrelated authenticated user', async () => {
    const client: PoolClient = await getClient(owner, stranger);
    try {
      const security = await client.query<{
        categories: boolean;
        logs: boolean;
      }>(
        "SELECT row_security_active('public.custom_categories') AS categories, row_security_active('public.custom_measurements') AS logs"
      );
      expect(security.rows[0]).toEqual({ categories: true, logs: true });
      expect(
        (
          await client.query('SELECT id FROM custom_categories WHERE id = $1', [
            activityId,
          ])
        ).rows
      ).toEqual([]);
      expect(
        (
          await client.query(
            'SELECT id FROM custom_measurements WHERE category_id = $1',
            [activityId]
          )
        ).rows
      ).toEqual([]);
    } finally {
      client.release();
    }
  });
  it('undo preserves a completion on another calendar day', async () => {
    await logHabit(owner, owner, activityId, '2026-10-02', true);
    await logHabit(owner, writer, activityId, '2026-10-02', null);
    const client: PoolClient = await getClient(owner, owner);
    try {
      expect(
        (
          await client.query<{ entry_date: Date }>(
            'SELECT entry_date FROM custom_measurements WHERE category_id = $1',
            [activityId]
          )
        ).rows
      ).toHaveLength(1);
    } finally {
      client.release();
    }
  });
});
