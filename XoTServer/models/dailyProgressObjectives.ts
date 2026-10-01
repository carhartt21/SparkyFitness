import type { PoolClient } from 'pg';
import { getClient } from '../db/poolManager.js';
import { weekdayOfDay, type DailyProgressInput } from '@workspace/shared';
import goalRepository from './goalRepository.js';
import { resolveWaterTotalsForDate } from '../services/hydrationTotalsService.js';

/** Read dated immutable schedules and actual recording evidence; never create plans. */
export async function readProgressObjectives(
  userId: string,
  date: string,
  mealsResolved: boolean
): Promise<Pick<DailyProgressInput, 'goals' | 'workouts'>> {
  const client: PoolClient = await getClient(userId);
  let released = false;
  try {
    const schedules = await client.query<{
      plan_id: string;
      assignment_id: string;
      label: string;
      recorded_at: Date | null;
      optional: boolean;
      activity_type: string | null;
    }>(
      `WITH versions AS (
         SELECT DISTINCT ON (template_id) * FROM workout_plan_template_versions
         WHERE user_id = $1 AND effective_from <= $2::date
         ORDER BY template_id, effective_from DESC, id DESC
       )
       SELECT v.template_id::text AS plan_id, (a->>'id') AS assignment_id,
         COALESCE(NULLIF(a->>'sessionName',''), p.name, e.name, a->>'activityType', v.plan_name) AS label,
         CASE WHEN NULLIF(a->>'sessionName','') IS NULL AND p.name IS NULL AND e.name IS NULL THEN a->>'activityType' END AS activity_type,
         COALESCE((a->>'isOptional')::boolean,false) AS optional,
         (SELECT MAX(ee.updated_at) FROM exercise_entries ee
          WHERE ee.user_id = $1 AND ee.entry_date = $2::date
            AND ee.workout_plan_origin_assignment_id = (a->>'id')::int
            AND (EXISTS (SELECT 1 FROM exercise_entry_sets s WHERE s.exercise_entry_id = ee.id AND s.completed_at IS NOT NULL)
              OR (ee.exercise_preset_entry_id IS NULL AND ee.source IS DISTINCT FROM 'Workout Plan' AND ee.duration_minutes > 0))) AS recorded_at
       FROM versions v CROSS JOIN LATERAL jsonb_array_elements(v.assignments) a
       LEFT JOIN workout_presets p ON p.id = (a->>'workoutPresetId')::int
       LEFT JOIN exercises e ON e.id = (a->>'exerciseId')::uuid
       WHERE v.is_active AND $2::date >= v.start_date AND (v.end_date IS NULL OR $2::date <= v.end_date)
         AND (a->>'dayOfWeek')::int = $3 AND (a->>'activityType') IS DISTINCT FROM 'rest'
       ORDER BY v.template_id, (a->>'sortOrder')::int, (a->>'id')::int`,
      [userId, date, weekdayOfDay(date)]
    );
    const duration = await client.query<{ minutes: string | null }>(
      `SELECT SUM(duration_minutes) AS minutes FROM exercise_entries ee
       WHERE ee.user_id = $1 AND ee.entry_date = $2::date
         AND ee.exercise_name IS DISTINCT FROM 'Active Calories'
         AND (EXISTS (SELECT 1 FROM exercise_entry_sets s WHERE s.exercise_entry_id = ee.id AND s.completed_at IS NOT NULL)
           OR (ee.exercise_preset_entry_id IS NULL AND ee.source IS DISTINCT FROM 'Workout Plan'))`,
      [userId, date]
    );
    client.release();
    released = true;
    const configured =
      (await goalRepository.getGoalByDate(userId, date)) ??
      (await goalRepository.getMostRecentGoalBeforeDate(userId, date));
    const goals: NonNullable<DailyProgressInput['goals']>[number][] = [];
    if (configured) {
      const waterTarget = Number(configured.water_goal_ml);
      if (waterTarget > 0) {
        const water = await resolveWaterTotalsForDate(userId, userId, date);
        goals.push({
          key: 'hydration',
          value: water.water_ml,
          target: waterTarget,
          unit: 'ml',
          complete: water.water_ml >= waterTarget,
        });
      }
      const durationTarget = Number(
        configured.target_exercise_duration_minutes
      );
      if (durationTarget > 0) {
        const minutes =
          duration.rows[0]?.minutes === null ||
          duration.rows[0]?.minutes === undefined
            ? null
            : Number(duration.rows[0].minutes);
        goals.push({
          key: 'activity_duration',
          value: minutes,
          target: durationTarget,
          unit: 'min',
          complete: minutes !== null && minutes >= durationTarget,
        });
      }
      const summary: Record<string, number> = {};
      for (const key of ['calories', 'protein', 'carbs', 'fat']) {
        const value = Number(configured[key]);
        if (value > 0) summary[key] = value;
      }
      if (Object.keys(summary).length)
        goals.push({
          key: 'nutrition_review',
          value: null,
          target: 1,
          unit: '',
          complete: mealsResolved,
          summary,
        });
    }
    return {
      goals,
      workouts: schedules.rows.map((row) => ({
        assignment_id: row.assignment_id,
        plan_id: row.plan_id,
        label: row.label,
        activity_type: row.activity_type,
        recorded_at: row.recorded_at?.toISOString() ?? null,
        optional: row.optional,
      })),
    };
  } finally {
    if (!released) client.release();
  }
}
