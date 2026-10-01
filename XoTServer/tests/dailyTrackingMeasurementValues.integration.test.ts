/** Run against a migrated disposable *_test database with RUN_MCP_MEASUREMENT_VALUES_INTEGRATION_TEST=1. */
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { measurementReminderMcpStatusResponseSchema } from '@workspace/shared';
import { endPool, getClient, getSystemClient } from '../db/poolManager.js';
import {
  recordedMeasurementsOn,
  recordedMeasurementValuesOn,
} from '../models/dailyTrackingRepository.js';
import { buildDailyTrackingTools } from '../ai/tools/dailyTrackingTools.js';

const RUN = process.env.RUN_MCP_MEASUREMENT_VALUES_INTEGRATION_TEST === '1';
const ownerId = randomUUID();
const otherId = randomUUID();
const categoryId = randomUUID();
const otherCategoryId = randomUUID();
const weightId = randomUUID();
const customId = randomUUID();
const key = `custom:${categoryId}`;
const otherKey = `custom:${otherCategoryId}`;
const date = '2026-10-01';

describe.runIf(RUN)('MCP saved measurement values with real RLS', () => {
  beforeAll(async () => {
    if (!process.env.SPARKY_FITNESS_DB_NAME?.endsWith('_test')) {
      throw new Error(
        'Measurement integration tests require a disposable *_test database.'
      );
    }
    const client = await getSystemClient();
    try {
      for (const id of [ownerId, otherId]) {
        await client.query(
          'INSERT INTO public."user" (id, email, email_verified) VALUES ($1, $2, true)',
          [id, `mcp-measurement-${id}@example.test`]
        );
      }
      for (const [id, userId] of [
        [categoryId, ownerId],
        [otherCategoryId, otherId],
      ]) {
        await client.query(
          `INSERT INTO custom_categories (id, user_id, name, measurement_type, frequency)
           VALUES ($1, $2, 'Synthetic count', 'count', 'Daily')`,
          [id, userId]
        );
      }
      await client.query(
        `INSERT INTO check_in_measurements (id, user_id, entry_date, weight, updated_at)
         VALUES ($1, $2, $3, 78.3, '2026-10-01T07:05:00Z'),
           ($4, $2, '2026-09-30', 79.1, '2026-09-30T07:05:00Z'),
           ($5, $6, $3, 100.1, '2026-10-01T09:05:00Z')`,
        [weightId, ownerId, date, randomUUID(), randomUUID(), otherId]
      );
      await client.query(
        `INSERT INTO custom_measurements
           (id, user_id, category_id, entry_date, value, entry_timestamp, updated_at, source)
         VALUES ($1, $2, $3, $4, '9', '2026-10-01T07:00:00Z', '2026-10-01T08:00:00Z', 'older'),
           ($5, $2, $3, $4, '0', '2026-10-01T07:30:00Z', '2026-10-01T08:00:00Z', 'manual'),
           ($6, $7, $8, $4, '88', '2026-10-01T09:00:00Z', '2026-10-01T09:00:00Z', 'other')`,
        [
          randomUUID(),
          ownerId,
          categoryId,
          date,
          customId,
          randomUUID(),
          otherId,
          otherCategoryId,
        ]
      );
      await client.query(
        `INSERT INTO measurement_reminders (user_id, measurement_key, enabled, include_in_daily_progress)
         VALUES ($1, 'weight', true, true), ($1, $2, true, true)`,
        [ownerId, key]
      );
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    const client = await getSystemClient();
    try {
      await client.query(
        'DELETE FROM public."user" WHERE id = ANY($1::uuid[])',
        [[ownerId, otherId]]
      );
    } finally {
      client.release();
      await endPool();
    }
  });

  it('returns the saved numeric kg and matching row timestamp', async () => {
    const result = await recordedMeasurementValuesOn(ownerId, date, ['weight']);
    expect(result.weight).toEqual({
      measurement_id: weightId,
      value: 78.3,
      unit: 'kg',
      recorded_at: '2026-10-01T07:05:00.000Z',
      source: null,
    });
  });

  it('preserves custom zero and selects value/source/time from the same latest row', async () => {
    const result = await recordedMeasurementValuesOn(ownerId, date, [key]);
    expect(result[key]).toEqual({
      measurement_id: customId,
      value: '0',
      unit: 'count',
      recorded_at: '2026-10-01T08:00:00.000Z',
      source: 'manual',
    });
  });

  it('does not prefill the next day or read a different account category', async () => {
    expect(
      await recordedMeasurementValuesOn(ownerId, '2026-10-02', ['weight', key])
    ).toEqual({});
    expect(
      await recordedMeasurementValuesOn(ownerId, date, [otherKey])
    ).toEqual({});
  });

  it('keeps RLS active and rejects a forged target-owner context', async () => {
    const client: PoolClient = await getClient(otherId, ownerId);
    try {
      const security = await client.query<{ active: boolean }>(
        "SELECT row_security_active('public.check_in_measurements') AS active"
      );
      expect(security.rows[0]?.active).toBe(true);
      const result = await client.query(
        'SELECT id FROM check_in_measurements WHERE user_id = $1',
        [otherId]
      );
      expect(result.rows).toEqual([]);
    } finally {
      client.release();
    }
  });

  it('returns real MCP values while preserving the Daily Progress timestamp projection', async () => {
    const tool = buildDailyTrackingTools(
      ownerId,
      'Europe/Berlin'
    ).sparky_get_measurement_reminder_status;
    const text = await tool.execute!(
      { date },
      { toolCallId: 'measurement-values', messages: [], context: {} }
    );
    const payload: unknown = JSON.parse(String(text));
    const result = measurementReminderMcpStatusResponseSchema.parse(payload);
    expect(result.reminders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          measurement_key: 'weight',
          measurement_recorded: true,
          value: 78.3,
          unit: 'kg',
        }),
        expect.objectContaining({
          measurement_key: key,
          measurement_recorded: true,
          value: '0',
          unit: 'count',
        }),
      ])
    );
    expect(
      await recordedMeasurementsOn(ownerId, date, ['weight', key])
    ).toEqual({
      weight: '2026-10-01T07:05:00.000Z',
      [key]: '2026-10-01T08:00:00.000Z',
    });
  });
});
