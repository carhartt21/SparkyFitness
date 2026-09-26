/**
 * Run explicitly against a migrated, disposable test/stage database with
 * RUN_PLANNED_SUPPLEMENT_DB_INTEGRATION=1 and the normal DB/app-role variables.
 * This exercises the route and real transaction/RLS path with synthetic rows.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
// @ts-expect-error supertest has no bundled types in this project
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { endPool, getClient, getSystemClient } from '../db/poolManager.js';
import medicationRoutes from '../routes/v2/medicationRoutes.js';

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
vi.mock('../utils/permissionUtils.js', () => ({
  canAccessUserData: async () => true,
}));
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: async () => 'Europe/Berlin',
}));

const dbName = process.env.SPARKY_FITNESS_DB_NAME ?? '';
const RUN =
  process.env.RUN_PLANNED_SUPPLEMENT_DB_INTEGRATION === '1' &&
  /(?:_test|_stage)$/.test(dbName);
const userId = randomUUID();
const medicationId = randomUUID();
const scheduleId = randomUUID();
const operationId = randomUUID();
const entryDate = '2026-09-24';
const body = {
  client_operation_id: operationId,
  medication_id: medicationId,
  schedule_id: scheduleId,
  entry_date: entryDate,
  status: 'taken',
  occurred_at: '2026-09-24T08:00:00.000Z',
};
const path = '/api/v2/medications/entries/planned-supplement-actions';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.userId = userId;
  next();
});
app.use('/api/v2/medications', medicationRoutes);

describe.runIf(RUN)('planned supplement action database integration', () => {
  beforeAll(async () => {
    const client = await getSystemClient();
    try {
      await client.query(
        'INSERT INTO public."user" (id, email, email_verified) VALUES ($1, $2, true)',
        [userId, `planned-supplement-integration-${userId}@example.test`]
      );
      await client.query(
        `INSERT INTO public.medications
          (id, user_id, name, is_supplement, dose_amount, dose_unit, nutrients)
         VALUES ($1, $2, 'Synthetic supplement', true, 2, 'tablet', $3::jsonb)`,
        [medicationId, userId, JSON.stringify({ vitamin_d: 10 })]
      );
      await client.query(
        `INSERT INTO public.medication_schedules
          (id, medication_id, user_id, schedule_type_id, time_of_day, start_date)
         VALUES ($1, $2, $3, 'daily', '08:00', '2026-09-01')`,
        [scheduleId, medicationId, userId]
      );
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

  it('creates one entry, replays after deletion, and rejects a changed operation', async () => {
    const scoped = await getClient(userId);
    try {
      const context = await scoped.query(
        "SELECT row_security_active('public.planned_supplement_actions') AS rls_active"
      );
      expect(context.rows[0]?.rls_active).toBe(true);
    } finally {
      scoped.release();
    }

    const created = await request(app).post(path).send(body);
    expect(created.statusCode).toBe(201);
    expect(created.body).toMatchObject({
      replayed: false,
      entry: {
        medication_id: medicationId,
        schedule_id: scheduleId,
        status: 'taken',
        source: 'planned_supplement_action',
      },
    });
    const entryId = created.body.entry.id as string;

    const replay = await request(app).post(path).send(body);
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toMatchObject({
      replayed: true,
      entry: { id: entryId },
    });

    const client = await getSystemClient();
    try {
      const entries = await client.query(
        'SELECT id FROM public.medication_entries WHERE user_id = $1 AND schedule_id = $2',
        [userId, scheduleId]
      );
      expect(entries.rows.map((row: { id: string }) => row.id)).toEqual([
        entryId,
      ]);
      await client.query(
        'DELETE FROM public.medication_entries WHERE id = $1',
        [entryId]
      );
    } finally {
      client.release();
    }

    const replayAfterDelete = await request(app).post(path).send(body);
    expect(replayAfterDelete.statusCode).toBe(200);
    expect(replayAfterDelete.body).toEqual({ entry: null, replayed: true });

    const changed = await request(app)
      .post(path)
      .send({ ...body, status: 'skipped' });
    expect(changed.statusCode).toBe(409);

    const verify = await getSystemClient();
    try {
      const rows = await verify.query(
        `SELECT (SELECT count(*)::int FROM public.planned_supplement_actions WHERE user_id = $1) AS operations,
                (SELECT count(*)::int FROM public.medication_entries WHERE user_id = $1) AS entries`,
        [userId]
      );
      expect(rows.rows[0]).toEqual({ operations: 1, entries: 0 });
    } finally {
      verify.release();
    }
  });
});
