/**
 * Explicit synthetic route/database check. Run only against a disposable,
 * migrated test/stage database with RUN_CONTAINER_WATER_DB_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
// @ts-expect-error supertest has no bundled types in this project
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { endPool, getClient, getSystemClient } from '../db/poolManager.js';
import waterIntakeRoutes from '../routes/v2/waterIntakeRoutes.js';
import { deleteFoodEntry } from '../services/foodEntryService.js';

vi.mock('../middleware/checkPermissionMiddleware.js', () => ({
  default:
    () =>
    (
      _req: express.Request,
      _res: express.Response,
      next: express.NextFunction
    ) =>
      next(),
}));
vi.mock('../middleware/onBehalfOfMiddleware.js', () => ({
  default: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => next(),
}));
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: async () => 'Europe/Berlin',
}));

const dbName = process.env.SPARKY_FITNESS_DB_NAME ?? '';
const RUN =
  process.env.RUN_CONTAINER_WATER_DB_INTEGRATION === '1' &&
  /(?:_test|_stage)$/.test(dbName);
const userId = randomUUID();
const foodId = randomUUID();
const variantId = randomUUID();
const operationId = randomUUID();
const entryDate = '2026-09-24';
let containerId: number;
const path = '/api/v2/measurements/water-intake/container-actions';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.userId = userId;
  next();
});
app.use('/api/v2/measurements', waterIntakeRoutes);

describe.runIf(RUN)('container water action database integration', () => {
  beforeAll(async () => {
    const client = await getSystemClient();
    try {
      await client.query(
        'INSERT INTO public."user" (id, email, email_verified) VALUES ($1, $2, true)',
        [userId, `container-water-integration-${userId}@example.test`]
      );
      await client.query(
        `INSERT INTO public.foods (id, user_id, name, is_custom)
         VALUES ($1, $2, 'Synthetic drink', true)`,
        [foodId, userId]
      );
      await client.query(
        `INSERT INTO public.food_variants
          (id, food_id, serving_size, serving_unit, calories, water_ml, is_default)
         VALUES ($1, $2, 300, 'ml', 20, 280, true)`,
        [variantId, foodId]
      );
      const inserted = await client.query(
        `INSERT INTO public.user_water_containers
          (user_id, name, volume, unit, hydration_factor,
           linked_food_id, linked_variant_id, linked_quantity)
         VALUES ($1, 'Synthetic bottle', 300, 'ml', 0.8, $2, $3, 1)
         RETURNING id`,
        [userId, foodId, variantId]
      );
      containerId = Number(inserted.rows[0].id);
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    const client = await getSystemClient();
    try {
      await client.query('DELETE FROM public."user" WHERE id = $1', [userId]);
    } finally {
      client.release();
      await endPool();
    }
  });

  it('commits linked food and water once, then preserves the receipt after deletion', async () => {
    const scoped = await getClient(userId);
    try {
      const context = await scoped.query(
        "SELECT row_security_active('public.water_container_actions') AS rls_active"
      );
      expect(context.rows[0]?.rls_active).toBe(true);
    } finally {
      scoped.release();
    }

    const body = {
      client_operation_id: operationId,
      entry_date: entryDate,
      container_id: containerId,
      logged_at: '2026-09-24T08:30:00.000Z',
    };
    const first = await request(app).post(path).send(body);
    expect(first.statusCode).toBe(200);
    expect(first.body).toMatchObject({
      waterMl: 240,
      alreadyApplied: false,
      totals: { water_ml: 240, ledger_ml: 240 },
    });
    expect(first.body.foodEntryId).toEqual(expect.any(String));
    expect(first.body.waterLogId).toEqual(expect.any(String));

    const replay = await request(app).post(path).send(body);
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toMatchObject({
      waterLogId: first.body.waterLogId,
      foodEntryId: first.body.foodEntryId,
      waterMl: 240,
      alreadyApplied: true,
    });

    const client = await getSystemClient();
    try {
      const effects = await client.query(
        `SELECT
          (SELECT count(*)::int FROM public.food_entries WHERE user_id = $1) AS foods,
          (SELECT count(*)::int FROM public.water_intake_entries WHERE user_id = $1) AS waters,
          (SELECT source_id FROM public.water_intake_entries WHERE user_id = $1) AS source_id`,
        [userId]
      );
      expect(effects.rows[0]).toEqual({
        foods: 1,
        waters: 1,
        source_id: operationId,
      });
    } finally {
      client.release();
    }

    expect(await deleteFoodEntry(userId, first.body.foodEntryId)).toBe(true);

    const replayAfterDelete = await request(app).post(path).send(body);
    expect(replayAfterDelete.statusCode).toBe(200);
    expect(replayAfterDelete.body).toMatchObject({
      waterLogId: null,
      foodEntryId: null,
      waterMl: 240,
      alreadyApplied: true,
      totals: { water_ml: 0, ledger_ml: 0 },
    });

    const changed = await request(app)
      .post(path)
      .send({ ...body, logged_at: '2026-09-24T08:31:00.000Z' });
    expect(changed.statusCode).toBe(409);

    const verify = await getSystemClient();
    try {
      const rows = await verify.query(
        `SELECT
          (SELECT count(*)::int FROM public.water_container_actions WHERE user_id = $1) AS operations,
          (SELECT count(*)::int FROM public.food_entries WHERE user_id = $1) AS foods,
          (SELECT count(*)::int FROM public.water_intake_entries WHERE user_id = $1) AS waters`,
        [userId]
      );
      expect(rows.rows[0]).toEqual({ operations: 1, foods: 0, waters: 0 });
    } finally {
      verify.release();
    }
  });
});
