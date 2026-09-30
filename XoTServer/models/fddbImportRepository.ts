import { createHash } from 'node:crypto';
import { getClient } from '../db/poolManager.js';
import type { FddbActivityRow, FddbDiaryRow } from '@workspace/shared';

export const fddbSourceId = (key: string): string =>
  `fddb:${createHash('sha256').update(key).digest('hex')}`;

/** Preserve source nutrition as an entry snapshot, without creating a food. */
export async function importFddbDiaryBatch(
  userId: string,
  actorId: string,
  mealTypeId: string,
  rows: FddbDiaryRow[]
): Promise<number> {
  const client = await getClient(userId, actorId);
  try {
    await client.query('BEGIN');
    const params: Array<string | number> = [];
    const tuples = rows.map((row) => {
      const offset = params.length;
      params.push(
        userId,
        mealTypeId,
        row.quantity,
        row.unit,
        row.date,
        row.time,
        row.foodName,
        row.quantity,
        row.unit,
        row.calories,
        row.protein,
        row.carbs,
        row.fat,
        fddbSourceId(row.sourceKey),
        actorId,
        actorId,
        'fddb'
      );
      return `(${Array.from({ length: 17 }, (_, i) => `$${offset + i + 1}`).join(', ')})`;
    });
    const inserted = await client.query(
      `INSERT INTO food_entries (
         user_id, meal_type_id, quantity, unit, entry_date, entry_time,
         food_name, serving_size, serving_unit, calories, protein, carbs, fat,
         source_id, created_by_user_id, updated_by_user_id, source
       ) VALUES ${tuples.join(', ')}
       ON CONFLICT (user_id, source, source_id)
         WHERE source IS NOT NULL AND source_id IS NOT NULL
         DO NOTHING
       RETURNING id`,
      params
    );
    await client.query('COMMIT');
    return inserted.rowCount ?? inserted.rows.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Imported recipes have no structured ingredient IDs; the marker lives in notes. */
export async function hasImportedFddbRecipe(
  userId: string,
  actorId: string,
  sourceId: string
): Promise<boolean> {
  const client = await getClient(userId, actorId);
  try {
    const result = await client.query(
      'SELECT 1 FROM meals WHERE user_id = $1 AND notes LIKE $2 LIMIT 1',
      [userId, `FDDB import ${sourceId}%`]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

/** Favorites require an unambiguous exact match among the user's own foods. */
export async function findUniqueOwnedFoodByName(
  userId: string,
  actorId: string,
  name: string
): Promise<string | null> {
  const client = await getClient(userId, actorId);
  try {
    const result = await client.query(
      'SELECT id FROM foods WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 2',
      [userId, name]
    );
    return result.rows.length === 1 ? String(result.rows[0].id) : null;
  } finally {
    client.release();
  }
}

/** Fill a missing weight but never overwrite an existing measurement. */
export async function importFddbWeight(
  userId: string,
  actorId: string,
  date: string,
  weightKg: number
): Promise<boolean> {
  const client = await getClient(userId, actorId);
  try {
    const result = await client.query(
      `INSERT INTO check_in_measurements (
         user_id, entry_date, weight, created_by_user_id, updated_by_user_id
       ) VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (user_id, entry_date) DO UPDATE SET
         weight = EXCLUDED.weight,
         updated_at = now(),
         updated_by_user_id = EXCLUDED.updated_by_user_id
       WHERE check_in_measurements.weight IS NULL
       RETURNING id`,
      [userId, date, weightKg, actorId]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

/** FDDB activities are energy-duration snapshots, not structured workouts. */
export async function importFddbActivities(
  userId: string,
  actorId: string,
  rows: FddbActivityRow[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const client = await getClient(userId, actorId);
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `fddb-activities:${userId}`,
    ]);
    let inserted = 0;
    for (const row of rows) {
      const result = await client.query(
        `INSERT INTO exercise_entries (
           user_id, exercise_name, duration_minutes, calories_burned,
           entry_date, entry_time, source, source_id,
           created_by_user_id, updated_by_user_id
         ) SELECT $1, $2, $3, $4, $5, $6, 'fddb', $7, $8, $8
         WHERE NOT EXISTS (
           SELECT 1 FROM exercise_entries
           WHERE user_id = $1 AND source = 'fddb' AND source_id = $7
         ) RETURNING id`,
        [
          userId,
          row.name,
          row.durationMinutes,
          row.caloriesBurned,
          row.date,
          row.time,
          fddbSourceId(row.sourceKey),
          actorId,
        ]
      );
      inserted += result.rowCount ?? result.rows.length;
    }
    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
