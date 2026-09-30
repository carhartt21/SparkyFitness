import { createHash } from 'node:crypto';
import { getClient } from '../db/poolManager.js';
import {
  getDueDosesForDate,
  type PlannedSupplementActionBody,
  type PlannedSupplementActionResult,
  type SharedScheduleRule,
} from '@workspace/shared';

export class PlannedSupplementActionError extends Error {
  constructor(
    readonly statusCode: 404 | 409,
    message: string
  ) {
    super(message);
  }
}

type ScheduleRow = SharedScheduleRule & {
  id: string;
  medication_id: string;
  created_at: Date | string;
  medication_active: boolean;
  is_supplement: boolean;
  name: string;
  display_name: string | null;
  medication_dose_amount: number | null;
  dose_unit: string | null;
  nutrients: Record<string, unknown> | null;
};

function fingerprint(body: PlannedSupplementActionBody): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        body.medication_id,
        body.schedule_id,
        body.entry_date,
        body.status,
        body.occurred_at,
      ])
    )
    .digest('hex');
}

/**
 * Serializes both the operation ID and the schedule/day occurrence. The ledger
 * survives entry deletion, so a delayed offline retry cannot restore a removed
 * dose. Existing manual logs for the same slot are treated as conflicts.
 */
export async function createPlannedSupplementAction(
  userId: string,
  body: PlannedSupplementActionBody,
  timezone: string
): Promise<PlannedSupplementActionResult> {
  const client = await getClient(userId);
  const requestFingerprint = fingerprint(body);
  try {
    await client.query('BEGIN');
    // Different schedules can carry the same forged operation UUID. Lock that
    // key before checking it; the schedule row lock below serializes the slot.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`planned-supplement:${userId}:${body.client_operation_id}`]
    );
    const priorOperation = await client.query(
      `SELECT a.request_fingerprint, to_jsonb(me) AS entry
         FROM planned_supplement_actions a
         LEFT JOIN medication_entries me
           ON me.id = a.entry_id AND me.user_id = a.user_id
        WHERE a.user_id = $1 AND a.client_operation_id = $2`,
      [userId, body.client_operation_id]
    );
    if (priorOperation.rows[0]) {
      if (priorOperation.rows[0].request_fingerprint !== requestFingerprint) {
        throw new PlannedSupplementActionError(
          409,
          'Operation ID already belongs to a different supplement response.'
        );
      }
      await client.query('COMMIT');
      return {
        entry: priorOperation.rows[0].entry ?? null,
        replayed: true,
      };
    }

    const scheduleResult = await client.query(
      `SELECT ms.*, m.is_active AS medication_active, m.is_supplement,
              m.name, m.display_name,
              m.dose_amount AS medication_dose_amount, m.dose_unit, m.nutrients
         FROM medication_schedules ms
         JOIN medications m ON m.id = ms.medication_id AND m.user_id = ms.user_id
        WHERE ms.id = $1 AND ms.user_id = $2 AND m.id = $3
        FOR UPDATE OF ms, m`,
      [body.schedule_id, userId, body.medication_id]
    );
    const schedule = scheduleResult.rows[0] as ScheduleRow | undefined;
    if (!schedule || !schedule.is_supplement) {
      throw new PlannedSupplementActionError(
        404,
        'Planned supplement schedule not found.'
      );
    }
    const rule = {
      ...schedule,
      created_at: new Date(schedule.created_at).toISOString(),
    };
    const due = getDueDosesForDate(
      [
        {
          id: body.medication_id,
          is_active: schedule.medication_active,
          schedules: [rule],
        },
      ],
      body.entry_date,
      timezone
    );
    if (due.length !== 1) {
      throw new PlannedSupplementActionError(
        409,
        'Supplement schedule is not due on this date.'
      );
    }

    const priorOccurrence = await client.query(
      `SELECT id FROM planned_supplement_actions
        WHERE user_id = $1 AND occurrence_schedule_id = $2 AND entry_date = $3`,
      [userId, body.schedule_id, body.entry_date]
    );
    if (priorOccurrence.rows[0]) {
      throw new PlannedSupplementActionError(
        409,
        'This planned supplement occurrence already has a response.'
      );
    }
    const existingEntry = await client.query(
      `SELECT id FROM medication_entries
        WHERE user_id = $1 AND schedule_id = $2 AND entry_date = $3
        LIMIT 1`,
      [userId, body.schedule_id, body.entry_date]
    );
    if (existingEntry.rows[0]) {
      throw new PlannedSupplementActionError(
        409,
        'This planned supplement occurrence is already logged.'
      );
    }

    const entryResult = await client.query(
      `INSERT INTO medication_entries (
         medication_id, schedule_id, user_id, status, taken_at, entry_date,
         med_name_snapshot, dose_amount_snapshot, dose_unit_snapshot,
         nutrients_snapshot, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'planned_supplement_action')
       RETURNING *`,
      [
        body.medication_id,
        body.schedule_id,
        userId,
        body.status,
        body.occurred_at,
        body.entry_date,
        schedule.display_name || schedule.name,
        schedule.dose_amount ?? schedule.medication_dose_amount,
        schedule.dose_unit,
        schedule.nutrients === null ? null : JSON.stringify(schedule.nutrients),
      ]
    );
    const entry = entryResult.rows[0];
    await client.query(
      `INSERT INTO planned_supplement_actions (
         user_id, client_operation_id, medication_id, schedule_id,
         occurrence_schedule_id, entry_date, status, occurred_at,
         request_fingerprint, entry_id)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        body.client_operation_id,
        body.medication_id,
        body.schedule_id,
        body.entry_date,
        body.status,
        body.occurred_at,
        requestFingerprint,
        entry.id,
      ]
    );
    await client.query('COMMIT');
    return { entry, replayed: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
