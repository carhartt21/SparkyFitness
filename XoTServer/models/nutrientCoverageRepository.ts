import type { PoolClient } from 'pg';
import {
  HEALTH_MICRONUTRIENT_IDS,
  getMicronutrientById,
  type NutrientCoverage,
} from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import { doseScale, supplementCountable } from './supplementSql.js';

interface Definition {
  catalog_id: string;
  name: string;
  unit: string;
}
interface CoverageRow {
  date: string;
  catalog_id: string;
  known: number;
  eligible: number;
  total: string | null;
  unit: string;
}

export async function getNutrientCoverage(
  userId: string,
  actorId: string,
  startDate: string,
  endDate: string
): Promise<NutrientCoverage> {
  const client: PoolClient = await getClient(userId, actorId);
  try {
    const definitions = await client.query<Definition>(
      'SELECT catalog_id, name, unit FROM user_custom_nutrients WHERE user_id = $1 AND catalog_id IS NOT NULL',
      [userId]
    );
    const fields = HEALTH_MICRONUTRIENT_IDS.flatMap((id) => {
      const catalog = getMicronutrientById(id);
      if (!catalog) return [];
      const definition = definitions.rows.find((row) => row.catalog_id === id);
      return [
        {
          catalog_id: id,
          key: catalog.fixedField ?? definition?.name ?? null,
          fixed: !!catalog.fixedField,
          unit: definition?.unit ?? catalog.unit,
        },
      ];
    });
    const result = await client.query<CoverageRow>(
      `
      WITH fields AS (SELECT * FROM jsonb_to_recordset($4::jsonb) AS f(catalog_id text, key text, fixed boolean, unit text)),
      observations AS (
        SELECT COALESCE(fem.entry_date, fe.entry_date) AS entry_date, to_jsonb(fe) AS payload, fe.quantity::numeric / fe.serving_size::numeric AS scale
        FROM food_entries fe LEFT JOIN food_entry_meals fem ON fem.id = fe.food_entry_meal_id
        WHERE fe.user_id = $1 AND COALESCE(fem.entry_date, fe.entry_date) BETWEEN $2 AND $3 AND fe.serving_size > 0 AND fe.quantity > 0
        UNION ALL
        SELECT me.entry_date, me.nutrients_snapshot, ${doseScale('me')}
        FROM medication_entries me WHERE me.user_id = $1 AND me.entry_date BETWEEN $2 AND $3 AND ${supplementCountable('me')} AND ${doseScale('me')} > 0
      ), parsed AS (
        SELECT o.entry_date, f.*, o.scale, public.sf_try_numeric(CASE WHEN f.fixed THEN o.payload->>f.key ELSE o.payload->'custom_nutrients'->>f.key END) AS value
        FROM observations o CROSS JOIN fields f
      )
      SELECT to_char(entry_date, 'YYYY-MM-DD') AS date, catalog_id, unit,
        count(*)::integer AS eligible,
        count(*) FILTER (WHERE value >= 0 AND value * scale <= 1.7976931348623157e308)::integer AS known,
        sum(value * scale) FILTER (WHERE value >= 0 AND value * scale <= 1.7976931348623157e308) AS total
      FROM parsed GROUP BY entry_date, catalog_id, unit ORDER BY entry_date`,
      [userId, startDate, endDate, JSON.stringify(fields)]
    );
    const coverage: NutrientCoverage = {};
    for (const row of result.rows) {
      const total = row.total === null ? null : Number(row.total);
      coverage[row.date] ??= {};
      coverage[row.date]![row.catalog_id] = {
        knownEntryCount: row.known,
        eligibleEntryCount: row.eligible,
        recordedTotal: total !== null && Number.isFinite(total) ? total : null,
        unit: row.unit,
      };
    }
    return coverage;
  } finally {
    client.release();
  }
}
