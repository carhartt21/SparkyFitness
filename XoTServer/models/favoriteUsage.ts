import type { PoolClient } from 'pg';
import { getClient } from '../db/poolManager.js';

export interface FavoriteUsageRow {
  kind: 'food' | 'meal';
  id: string;
  usage_count_28d: number;
  last_used_at: Date | null;
}

/** Bounded actual consumption, excluding planned and composite ingredient rows. */
export async function getFavoriteUsage(
  userId: string,
  from: string,
  to: string,
  timezone: string
): Promise<FavoriteUsageRow[]> {
  const client: PoolClient = await getClient(userId);
  try {
    const result = await client.query<FavoriteUsageRow>(
      `WITH consumption AS (
        SELECT 'food' AS kind, food_id AS id, entry_date, entry_time
        FROM food_entries WHERE user_id = $1 AND food_id IS NOT NULL
          AND food_entry_meal_id IS NULL AND meal_id IS NULL AND meal_plan_template_id IS NULL
          AND entry_date BETWEEN $2::date AND $3::date
        UNION ALL
        SELECT 'meal', meal_template_id, entry_date, entry_time FROM food_entry_meals m
        WHERE user_id = $1 AND meal_template_id IS NOT NULL AND entry_date BETWEEN $2::date AND $3::date
          AND NOT EXISTS (SELECT 1 FROM food_entries c WHERE c.food_entry_meal_id = m.id AND c.meal_plan_template_id IS NOT NULL)
        UNION ALL
        SELECT DISTINCT 'meal', meal_id, entry_date, entry_time FROM food_entries
        WHERE user_id = $1 AND meal_id IS NOT NULL AND food_entry_meal_id IS NULL
          AND meal_plan_template_id IS NULL AND entry_date BETWEEN $2::date AND $3::date
      )
      SELECT kind, id, COUNT(*)::int AS usage_count_28d,
        MAX((entry_date + COALESCE(entry_time, TIME '00:00')) AT TIME ZONE $4) AS last_used_at
      FROM consumption
      WHERE ((entry_date + COALESCE(entry_time, TIME '00:00')) AT TIME ZONE $4) <= CURRENT_TIMESTAMP
      GROUP BY kind, id`,
      [userId, from, to, timezone]
    );
    return result.rows;
  } finally {
    client.release();
  }
}
