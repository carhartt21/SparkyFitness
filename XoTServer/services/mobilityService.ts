import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  addDays,
  instantToDay,
  mobilityScheduleDays,
  mobilitySnapshotUnchanged,
  mobilityOutcomeIdsValid,
  mobilityRoutineSchema,
  mobilityScheduleSchema,
  mobilityPlanSchema,
  mobilitySessionSchema,
  mobilitySnapshotSchema,
  type MobilityOperation,
  type MobilitySnapshot,
} from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import {
  mobilityRow,
  mobilityRows,
  type MobilityTable,
} from '../models/mobilityRepository.js';
export class MobilityConflictError extends Error {}
export class MobilityNotFoundError extends Error {}
export class MobilityValidationError extends Error {}
async function transaction<T>(
  userId: string,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client: PoolClient = await getClient(userId, userId);
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`mobility:${userId}`]
    );
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
async function materialize(
  client: PoolClient,
  userId: string,
  from: string,
  to: string
): Promise<void> {
  const routines = await mobilityRows(client, userId, 'mobility_routines');
  const schedules = await mobilityRows(client, userId, 'mobility_schedules');
  for (const row of schedules) {
    if (row.deleted) continue;
    const schedule = mobilityScheduleSchema.parse(row.data);
    const source = routines.find(
      (routine) => routine.id === schedule.routineId && !routine.deleted
    );
    if (!source) continue;
    const routine = mobilityRoutineSchema.parse(source.data);
    for (const day of mobilityScheduleDays(schedule, from, to)) {
      const plan = mobilityPlanSchema.parse({
        id: randomUUID(),
        routine,
        scheduleId: schedule.id,
        day,
        time: schedule.time,
        state: 'planned',
        activeSessionId: null,
      });
      await client.query(
        `INSERT INTO mobility_plans(user_id,id,schedule_id,local_day,revision,data)
        VALUES($1,$2,$3,$4,1,$5) ON CONFLICT(user_id,schedule_id,local_day) DO NOTHING`,
        [userId, plan.id, schedule.id, day, plan]
      );
    }
  }
}
export async function getMobilitySnapshot(
  userId: string,
  from?: string,
  to?: string
): Promise<MobilitySnapshot> {
  const timezone = await loadUserTimezone(userId);
  const today = instantToDay(new Date(), timezone);
  const first = from ?? addDays(today, -7);
  const last = to ?? addDays(today, 30);
  if (first > last || addDays(first, 92) < last)
    throw new MobilityValidationError('Date range must be at most 93 days.');
  return transaction(userId, async (client) => {
    await materialize(client, userId, first, last);
    const [routines, schedules, plans, sessions] = [
      await mobilityRows(client, userId, 'mobility_routines'),
      await mobilityRows(client, userId, 'mobility_schedules'),
      (
        await client.query<
          import('../models/mobilityRepository.js').MobilityRow
        >(
          'SELECT * FROM mobility_plans WHERE user_id=$1 AND local_day BETWEEN $2 AND $3 ORDER BY local_day,id',
          [userId, first, last]
        )
      ).rows,
      (
        await client.query<
          import('../models/mobilityRepository.js').MobilityRow
        >(
          from || to
            ? "SELECT * FROM mobility_sessions WHERE user_id=$1 AND ((data->>'state') IN ('running','paused') OR ((data->>'startedAt')::timestamptz AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date) ORDER BY data->>'startedAt',id"
            : "SELECT * FROM mobility_sessions WHERE user_id=$1 AND ((data->>'state') IN ('running','paused') OR id IN (SELECT id FROM mobility_sessions WHERE user_id=$1 ORDER BY data->>'startedAt' DESC,id LIMIT 100)) ORDER BY data->>'startedAt',id",
          from || to ? [userId, first, last, timezone] : [userId]
        )
      ).rows,
    ];
    return mobilitySnapshotSchema.parse({
      timezone,
      routines: routines.map(({ revision, data, deleted }) => ({
        revision,
        data,
        deleted,
      })),
      schedules: schedules.map(({ revision, data, deleted }) => ({
        revision,
        data,
        deleted,
      })),
      plans: plans
        .filter((row) => {
          const plan = mobilityPlanSchema.parse(row.data);
          return plan.day >= first && plan.day <= last;
        })
        .map(({ revision, data, deleted }) => ({ revision, data, deleted })),
      sessions: sessions.map((row) => ({
        revision: row.revision,
        data: row.data,
        deleted: row.deleted,
        provenance: row.provenance ?? 'phone',
      })),
    });
  });
}
/** CAS and operation receipts apply equally to phone, web and consent-gated MCP. */
export async function applyMobilityOperation(
  userId: string,
  operation: MobilityOperation,
  provenance: 'phone' | 'web' | 'mcp' | 'import' = 'phone'
): Promise<{ revision: number }> {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([operation, provenance]))
    .digest('hex');
  const timezone = await loadUserTimezone(userId);
  return transaction(userId, async (client) => {
    const receipt = await client.query<{
      request_fingerprint: string;
      result: { revision: number };
    }>(
      'SELECT request_fingerprint,result FROM mobility_operations WHERE user_id=$1 AND operation_id=$2',
      [userId, operation.operationId]
    );
    if (receipt.rows[0]) {
      if (receipt.rows[0].request_fingerprint !== fingerprint)
        throw new MobilityConflictError(
          'Operation ID belongs to another mutation.'
        );
      return receipt.rows[0].result;
    }
    const mutation = operation.mutation;
    const kind = mutation.kind;
    const tables = {
      routine: 'mobility_routines',
      schedule: 'mobility_schedules',
      plan: 'mobility_plans',
      session: 'mobility_sessions',
      result: 'mobility_plans',
    } as const;
    const table: MobilityTable = tables[kind];
    const id = mutation.kind === 'result' ? mutation.planId : mutation.data.id;
    const before = await mobilityRow(client, userId, table, id);
    if ((before?.revision ?? 0) !== operation.expectedRevision)
      throw new MobilityConflictError('Mobility item changed elsewhere.');
    const revision = (before?.revision ?? 0) + 1;
    if (mutation.kind === 'result') {
      if (!before || before.deleted)
        throw new MobilityNotFoundError('Planned session not found.');
      const plan = mobilityPlanSchema.parse(before.data);
      if (plan.state !== 'planned')
        throw new MobilityConflictError(
          'Planned session is active or already resolved.'
        );
      if (!mobilityOutcomeIdsValid(plan.routine, mutation.data.outcomes))
        throw new MobilityValidationError('Invalid step outcomes.');
      // Missing outcomes stay unknown. A manual completion is not a workout/HealthKit entry.
      const session = mobilitySessionSchema.parse({
        id: randomUUID(),
        routine: plan.routine,
        planId: plan.id,
        state: mutation.data.state === 'completed' ? 'finished' : 'cancelled',
        phase: 'step',
        stepIndex: 0,
        phaseStartedAt: null,
        elapsedSeconds: 0,
        outcomes: mutation.data.outcomes,
        startedAt: mutation.data.recordedAt,
        endedAt: mutation.data.recordedAt,
      });
      await client.query(
        'INSERT INTO mobility_sessions(user_id,id,plan_id,revision,data,provenance) VALUES($1,$2,$3,1,$4,$5)',
        [userId, session.id, plan.id, session, provenance]
      );
      await client.query(
        'UPDATE mobility_plans SET data=$3,revision=$4,updated_at=now() WHERE user_id=$1 AND id=$2',
        [userId, id, { ...plan, state: mutation.data.state }, revision]
      );
    } else {
      const data = mutation.data;
      if (mutation.kind === 'schedule') {
        const routine = await mobilityRow(
          client,
          userId,
          'mobility_routines',
          mutation.data.routineId
        );
        if (!routine || routine.deleted)
          throw new MobilityNotFoundError('Routine not found.');
      }
      if (mutation.kind === 'routine') {
        for (const step of mutation.data.steps)
          if (step.exerciseId) {
            const exercise = await client.query(
              'SELECT id FROM exercises WHERE id=$1',
              [step.exerciseId]
            );
            if (!exercise.rows[0])
              throw new MobilityValidationError('Exercise is unavailable.');
          }
      }
      if (mutation.kind === 'plan') {
        if (before && mobilityPlanSchema.parse(before.data).state !== 'planned')
          throw new MobilityConflictError(
            'Active and historical plans are immutable.'
          );
        if (mutation.data.state !== 'planned' || mutation.data.activeSessionId)
          throw new MobilityValidationError(
            'Use session or result operations to resolve plans.'
          );
        if (mutation.data.scheduleId && !before)
          throw new MobilityValidationError(
            'Recurring occurrences are generated by their schedule.'
          );
      }
      if (mutation.kind === 'session') {
        if (provenance !== 'phone' && provenance !== 'import')
          throw new MobilityValidationError(
            'Run sessions on the phone; use an explicit plan result otherwise.'
          );
        if (before) {
          const previous = mobilitySessionSchema.parse(before.data);
          if (!mobilitySnapshotUnchanged(previous, mutation.data))
            throw new MobilityConflictError('Session snapshots are immutable.');
          if (
            ['finished', 'cancelled'].includes(previous.state) &&
            !mutation.deleted
          )
            throw new MobilityConflictError('Session is already closed.');
        }
        if (mutation.data.planId) {
          const row = await mobilityRow(
            client,
            userId,
            'mobility_plans',
            mutation.data.planId
          );
          if (!row || row.deleted)
            throw new MobilityNotFoundError('Planned session not found.');
          const plan = mobilityPlanSchema.parse(row.data);
          if (
            (plan.state !== 'planned' && plan.activeSessionId !== data.id) ||
            JSON.stringify(plan.routine) !==
              JSON.stringify(mutation.data.routine)
          )
            throw new MobilityConflictError(
              'Plan is claimed, resolved or has a different snapshot.'
            );
          const state =
            mutation.data.state === 'finished'
              ? 'completed'
              : mutation.data.state === 'cancelled'
                ? 'cancelled'
                : 'active';
          await client.query(
            'UPDATE mobility_plans SET data=$3,revision=revision+1,updated_at=now() WHERE user_id=$1 AND id=$2',
            [userId, plan.id, { ...plan, state, activeSessionId: data.id }]
          );
        }
      }
      const extra =
        mutation.kind === 'schedule'
          ? { name: 'routine_id', value: mutation.data.routineId }
          : mutation.kind === 'plan'
            ? {
                name: 'schedule_id,local_day',
                value: [mutation.data.scheduleId, mutation.data.day],
              }
            : mutation.kind === 'session'
              ? {
                  name: 'plan_id,provenance',
                  value: [mutation.data.planId ?? null, provenance],
                }
              : null;
      const extras = extra
        ? Array.isArray(extra.value)
          ? extra.value
          : [extra.value]
        : [];
      const placeholders = extras.map((_, index) => `$${index + 7}`).join(',');
      await client.query(
        `INSERT INTO ${table}(user_id,id,revision,data,deleted,updated_at${extra ? ',' + extra.name : ''})
        VALUES($1,$2,$3,$4,$5,$6${extra ? ',' + placeholders : ''}) ON CONFLICT(user_id,id) DO UPDATE SET
        revision=EXCLUDED.revision,data=EXCLUDED.data,deleted=EXCLUDED.deleted,updated_at=EXCLUDED.updated_at`,
        [userId, id, revision, data, mutation.deleted, new Date(), ...extras]
      );
      if (mutation.kind === 'routine') {
        const legacySchedule = await mobilityRow(
          client,
          userId,
          'mobility_schedules',
          id
        );
        if (!legacySchedule && mutation.data.reminderTime) {
          const schedule = mobilityScheduleSchema.parse({
            id,
            routineId: id,
            time: mutation.data.reminderTime,
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            startDay: instantToDay(new Date(), timezone),
            endDay: null,
            enabled: !mutation.deleted,
          });
          await client.query(
            'INSERT INTO mobility_schedules(user_id,id,routine_id,revision,data) VALUES($1,$2,$2,1,$3)',
            [userId, id, schedule]
          );
        } else if (legacySchedule && before) {
          const schedule = mobilityScheduleSchema.parse(legacySchedule.data);
          const oldRoutine = mobilityRoutineSchema.parse(before.data);
          // Do not overwrite an independently edited web schedule.
          if (
            schedule.time === oldRoutine.reminderTime &&
            (oldRoutine.reminderTime !== mutation.data.reminderTime ||
              mutation.deleted)
          ) {
            await client.query(
              'UPDATE mobility_schedules SET data=$3,revision=revision+1,updated_at=now() WHERE user_id=$1 AND id=$2',
              [
                userId,
                id,
                {
                  ...schedule,
                  time: mutation.data.reminderTime ?? schedule.time,
                  enabled: !!mutation.data.reminderTime && !mutation.deleted,
                },
              ]
            );
          }
        }
      }
      if (mutation.kind === 'routine' || mutation.kind === 'schedule') {
        // Only future unstarted generated occurrences are regenerated; exceptions,
        // active sessions and historical snapshots remain untouched.
        const today = instantToDay(new Date(), timezone);
        const schedules = await mobilityRows(
          client,
          userId,
          'mobility_schedules'
        );
        const affected =
          mutation.kind === 'schedule'
            ? [id]
            : schedules
                .filter(
                  (row) =>
                    mobilityScheduleSchema.parse(row.data).routineId === id
                )
                .map((row) => row.id);
        await client.query(
          `DELETE FROM mobility_plans WHERE user_id=$1 AND schedule_id=ANY($2::uuid[]) AND local_day>$3
          AND data->>'state'='planned' AND revision=1`,
          [userId, affected, today]
        );
        if (mutation.deleted)
          await client.query(
            "UPDATE mobility_plans SET deleted=true,revision=revision+1,updated_at=now() WHERE user_id=$1 AND schedule_id=ANY($2::uuid[]) AND local_day>=$3 AND data->>'state'='planned'",
            [userId, affected, today]
          );
        await materialize(client, userId, today, addDays(today, 30));
      }
    }
    const result = { revision };
    await client.query(
      'INSERT INTO mobility_operations(user_id,operation_id,request_fingerprint,result) VALUES($1,$2,$3,$4)',
      [userId, operation.operationId, fingerprint, result]
    );
    await client.query(
      "UPDATE engagement_occurrences SET status='cancelled' WHERE user_id=$1 AND kind='mobility' AND status='pending'",
      [userId]
    );
    return result;
  });
}
