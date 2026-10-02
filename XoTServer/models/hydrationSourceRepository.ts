import type { PoolClient } from 'pg';
import { getClient } from '../db/poolManager.js';
import type {
  HydrationSourceEntry,
  HydrationSourceTotals,
} from '@workspace/shared';

/**
 * One projection, no writes: aggregate water is authoritative per source; log
 * rows explain it. Linked food is already credited by its water row. Nutrient
 * values come from diary snapshots, never the mutable food library.
 */
const SOURCES = `WITH logs AS (
  SELECT w.id::text, w.entry_date::text, w.water_ml::numeric,
    CASE WHEN w.food_entry_id IS NOT NULL THEN 'drink'
         WHEN w.source = 'manual' THEN 'water' ELSE 'imported' END AS kind,
    COALESCE(w.container_name, f.food_name) AS name,
    w.logged_at, w.source, w.id::text AS water_entry_id,
    w.food_entry_id::text, NULL::text AS medication_id,
    'recorded'::text AS amount_basis, TRUE AS counts_toward_goal
  FROM water_intake_entries w
  LEFT JOIN food_entries f ON f.id=w.food_entry_id AND f.user_id=w.user_id
  WHERE w.user_id=$1 AND ($2::date IS NULL OR w.entry_date >= $2::date)
    AND ($3::date IS NULL OR w.entry_date <= $3::date)
), log_totals AS (
  SELECT entry_date, source, SUM(water_ml) AS water_ml FROM logs GROUP BY entry_date, source
), daily AS (
  SELECT entry_date::text, source, SUM(water_ml)::numeric AS water_ml
  FROM water_intake WHERE user_id=$1
    AND ($2::date IS NULL OR entry_date >= $2::date)
    AND ($3::date IS NULL OR entry_date <= $3::date)
  GROUP BY entry_date, source
), water AS (
  SELECT * FROM logs
  UNION ALL
  SELECT 'aggregate:' || d.entry_date || ':' || d.source, d.entry_date,
    d.water_ml-COALESCE(l.water_ml,0),
    CASE WHEN d.source='manual' THEN 'water' ELSE 'imported' END,
    NULL::text, NULL::timestamptz, d.source, NULL::text, NULL::text, NULL::text,
    'daily_total', TRUE
  FROM daily d LEFT JOIN log_totals l USING(entry_date,source)
  WHERE ABS(d.water_ml-COALESCE(l.water_ml,0)) > 0.000001
), food AS (
  SELECT 'food:' || f.id, f.entry_date::text,
    CASE WHEN f.water_ml > 0 AND f.serving_size > 0
         THEN f.water_ml * f.quantity / f.serving_size
         ELSE f.quantity * sf_volume_unit_to_ml(f.unit) END::numeric AS water_ml,
    CASE WHEN sf_volume_unit_to_ml(f.unit) IS NOT NULL OR sf_volume_unit_to_ml(f.serving_unit) IS NOT NULL THEN 'drink' ELSE 'food' END AS kind,
    f.food_name AS name,
    CASE WHEN f.entry_time IS NOT NULL THEN
      (f.entry_date + f.entry_time) AT TIME ZONE COALESCE(p.timezone,'UTC')
      ELSE NULL END AS logged_at,
    f.source, NULL::text AS water_entry_id, f.id::text AS food_entry_id,
    NULL::text AS medication_id,
    CASE WHEN f.water_ml > 0 AND f.serving_size > 0 THEN 'recorded'
         WHEN sf_volume_unit_to_ml(f.unit) IS NOT NULL THEN 'volume'
         ELSE 'unknown' END AS amount_basis,
    (sf_volume_unit_to_ml(f.unit) IS NOT NULL OR sf_volume_unit_to_ml(f.serving_unit) IS NOT NULL) AS counts_toward_goal
  FROM food_entries f LEFT JOIN user_preferences p ON p.user_id=f.user_id
  WHERE f.user_id=$1 AND f.quantity>0
    AND ($2::date IS NULL OR f.entry_date >= $2::date)
    AND ($3::date IS NULL OR f.entry_date <= $3::date)
    AND NOT EXISTS (SELECT 1 FROM water_intake_entries w WHERE w.food_entry_id=f.id AND w.user_id=f.user_id)
), supplements AS (
  SELECT 'supplement:' || m.id, m.entry_date::text,
    (public.sf_try_numeric(m.nutrients_snapshot->>'water_ml') * GREATEST(COALESCE(m.dose_amount_snapshot,1),0))::numeric AS water_ml,
    'supplement'::text AS kind, m.med_name_snapshot AS name, m.taken_at AS logged_at,
    m.source, NULL::text AS water_entry_id, NULL::text AS food_entry_id,
    m.medication_id::text, 'recorded'::text AS amount_basis, TRUE AS counts_toward_goal
  FROM medication_entries m WHERE m.user_id=$1 AND m.status IN ('taken','prn_taken')
    AND public.sf_try_numeric(m.nutrients_snapshot->>'water_ml') > 0
    AND ($2::date IS NULL OR m.entry_date >= $2::date)
    AND ($3::date IS NULL OR m.entry_date <= $3::date)
), sources AS (SELECT * FROM water UNION ALL SELECT * FROM food UNION ALL SELECT * FROM supplements)`;

export async function getHydrationSourceEntries(
  userId: string,
  date: string
): Promise<HydrationSourceEntry[]> {
  const client: PoolClient = await getClient(userId);
  try {
    const result = await client.query<HydrationSourceEntry>(
      `${SOURCES}
      SELECT id, entry_date, water_ml::float8, kind, name, logged_at, source,
        water_entry_id, food_entry_id, medication_id, amount_basis, counts_toward_goal
      FROM sources ORDER BY logged_at DESC NULLS LAST, id`,
      [userId, date, date]
    );
    return result.rows.map((row) => ({
      ...row,
      logged_at: row.logged_at ? new Date(row.logged_at).toISOString() : null,
    }));
  } finally {
    client.release();
  }
}

export async function getHydrationSourceTotals(
  userId: string,
  startDate?: string,
  endDate?: string,
  actingUserId?: string
): Promise<Array<HydrationSourceTotals & { entry_date: string }>> {
  const client: PoolClient = await getClient(userId, actingUserId);
  try {
    const result = await client.query<
      HydrationSourceTotals & { entry_date: string }
    >(
      `${SOURCES}
      SELECT entry_date,
        COALESCE(SUM(water_ml) FILTER(WHERE counts_toward_goal),0)::float8 AS water_ml,
        COALESCE(SUM(water_ml) FILTER(WHERE kind IN ('water','imported') OR water_entry_id IS NOT NULL),0)::float8 AS ledger_ml,
        COALESCE(SUM(water_ml) FILTER(WHERE (kind IN ('water','imported') OR water_entry_id IS NOT NULL) AND source='manual'),0)::float8 AS manual_ml,
        COALESCE(SUM(water_ml) FILTER(WHERE kind IN ('drink','supplement') AND water_entry_id IS NULL),0)::float8 AS food_ml,
        COALESCE(SUM(water_ml) FILTER(WHERE kind IN ('drink','supplement') AND water_entry_id IS NULL AND (source='manual' OR source IS NULL)),0)::float8 AS exportable_food_ml,
        COALESCE(SUM(water_ml) FILTER(WHERE kind='drink'),0)::float8 AS drink_ml,
        COALESCE(SUM(water_ml) FILTER(WHERE kind='supplement'),0)::float8 AS supplement_ml,
        COALESCE(SUM(water_ml) FILTER(WHERE kind='food'),0)::float8 AS solid_food_ml,
        COUNT(*) FILTER(WHERE water_ml IS NULL)::int AS unknown_count
      FROM sources GROUP BY entry_date ORDER BY entry_date`,
      [userId, startDate ?? null, endDate ?? null]
    );
    return result.rows;
  } finally {
    client.release();
  }
}
