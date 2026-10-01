import type { PoolClient } from 'pg';
import {
  activityPlanningRangeSchema,
  activityPlanningResponseSchema,
  instantToDay,
  type ActivityPlanningResponse,
  type ActivityResolutionRequest,
} from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { readActivityPlanningData } from '../models/activityPlanningRepository.js';
import { projectActivityPlanning } from './activityPlanningProjection.js';
export class ActivityPlanningConflictError extends Error {}
export class ActivityPlanningValidationError extends Error {}
export class ActivityPlanningNotFoundError extends Error {}
async function transaction<T>(
  userId: string,
  readOnly: boolean,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client: PoolClient = await getClient(userId, userId);
  try {
    await client.query(
      readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN'
    );
    if (!readOnly)
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [`activity-planning:${userId}`]
      );
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505'
    )
      throw new ActivityPlanningConflictError(
        'This diary session is already linked.'
      );
    throw error;
  } finally {
    client.release();
  }
}
export async function getActivityPlanning(
  userId: string,
  from: string,
  to: string
): Promise<ActivityPlanningResponse> {
  const range = activityPlanningRangeSchema.safeParse({
    start_date: from,
    end_date: to,
  });
  if (!range.success)
    throw new ActivityPlanningValidationError(
      'Choose at most 42 calendar days.'
    );
  const timezone = await loadUserTimezone(userId);
  const today = instantToDay(new Date(), timezone);
  return transaction(userId, true, async (client) =>
    activityPlanningResponseSchema.parse(
      projectActivityPlanning(
        await readActivityPlanningData(client, userId, from, to),
        from,
        to,
        timezone,
        today
      )
    )
  );
}
/** Explicit owner decision; never changes diary rows, set completion or calories. */
export async function resolveActivityPlanning(
  userId: string,
  operation: ActivityResolutionRequest
): Promise<ActivityPlanningResponse> {
  const timezone = await loadUserTimezone(userId);
  const today = instantToDay(new Date(), timezone);
  const date = operation.occurrence_id.split(':').at(-1)!;
  return transaction(userId, false, async (client) => {
    const data = await readActivityPlanningData(client, userId, date, date);
    const snapshot = projectActivityPlanning(data, date, date, timezone, today);
    const occurrence = snapshot.occurrences.find(
      (row) => row.id === operation.occurrence_id
    );
    if (!occurrence)
      throw new ActivityPlanningNotFoundError(
        'This scheduled activity no longer exists. Refresh the plan.'
      );
    const previous = data.resolutions.find(
      (row) => row.occurrence_id === operation.occurrence_id
    );
    const recordId = operation.action === 'link' ? operation.record_id : null;
    // An identical retry is read-only. A conflicting stale request cannot replace a decision.
    if (
      previous?.revision === operation.expected_revision + 1 &&
      previous.action === operation.action &&
      previous.record_id === recordId
    )
      return snapshot;
    if (occurrence.revision !== operation.expected_revision)
      throw new ActivityPlanningConflictError(
        'This activity changed. Refresh before trying again.'
      );
    let entryId: string | null = null;
    if (operation.action === 'link') {
      const record = snapshot.records.find(
        (row) => row.id === operation.record_id
      );
      if (
        !record ||
        !record.confirmed ||
        record.date !== date ||
        date > today ||
        record.origin_assignment_ids.length > 0
      )
        throw new ActivityPlanningValidationError(
          'Choose a confirmed, unassigned diary session on this date.'
        );
      if (
        record.linked_occurrence_id &&
        record.linked_occurrence_id !== occurrence.id
      )
        throw new ActivityPlanningConflictError(
          'This diary session is already linked.'
        );
      entryId = record.entry_ids[0];
    }
    await client.query(
      `INSERT INTO activity_plan_resolutions(user_id,occurrence_id,local_day,revision,action,record_id,entry_id)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,occurrence_id) DO UPDATE
      SET revision=EXCLUDED.revision,action=EXCLUDED.action,record_id=EXCLUDED.record_id,entry_id=EXCLUDED.entry_id,updated_at=NOW()`,
      [
        userId,
        occurrence.id,
        date,
        occurrence.revision + 1,
        operation.action,
        recordId,
        entryId,
      ]
    );
    return activityPlanningResponseSchema.parse(
      projectActivityPlanning(
        await readActivityPlanningData(client, userId, date, date),
        date,
        date,
        timezone,
        today
      )
    );
  });
}
