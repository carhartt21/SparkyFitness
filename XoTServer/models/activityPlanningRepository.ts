import type { PoolClient } from 'pg';
import { z } from 'zod';
import {
  activityPrescriptionSchema,
  activityPlanResolutionsSchema,
  mobilityPlanRecordSchema,
  mobilitySessionRecordSchema,
} from '@workspace/shared';

export const planVersionSchema = z.object({
  id: z.string(),
  template_id: z.number().int(),
  effective_from: z.iso.date(),
  captured_at: z.iso.datetime({ offset: true }),
  plan_name: z.string(),
  start_date: z.iso.date().nullable(),
  end_date: z.iso.date().nullable(),
  is_active: z.boolean(),
  assignments: z.array(activityPrescriptionSchema),
});
export const planningEntrySchema = z.object({
  id: z.uuid(),
  record_id: z.uuid(),
  entry_date: z.iso.date(),
  exercise_name: z.string(),
  session_name: z.string(),
  origin_id: z.number().int().nullable(),
  set_count: z.coerce.number().int(),
  completed_count: z.coerce.number().int(),
  recorded_at: z.iso.datetime({ offset: true }).nullable(),
  first_confirmed_at: z.iso.datetime({ offset: true }).nullable(),
  exercise_id: z.uuid().nullable(),
  source: z.string().nullable(),
  category: z.string().nullable(),
  notes: z.string().nullable(),
  provider_name: z.string().nullable(),
  detail_data: z.unknown(),
});
export type PlanVersion = z.infer<typeof planVersionSchema>;
export type PlanningEntry = z.infer<typeof planningEntrySchema>;

/** Queries use the caller's read snapshot or mutation transaction and owner RLS. */
export async function readActivityPlanningData(
  client: PoolClient,
  userId: string,
  from: string,
  to: string
) {
  const versions = await client.query(
    `SELECT id::text,template_id,effective_from::text,captured_at::text,plan_name,start_date::text,end_date::text,is_active,assignments
     FROM workout_plan_template_versions WHERE user_id=$1 AND effective_from<=$2 ORDER BY template_id,effective_from,id`,
    [userId, to]
  );
  const entries = await client.query(
    `SELECT e.id,COALESCE(e.exercise_preset_entry_id,e.id) AS record_id,e.entry_date::text,e.exercise_name,
      COALESCE(p.name,e.exercise_name) AS session_name,e.workout_plan_origin_assignment_id AS origin_id,
      COALESCE(s.set_count,0) AS set_count,COALESCE(s.completed_count,0) AS completed_count,
      COALESCE(s.last_completed,e.updated_at)::text AS recorded_at,s.first_completed::text AS first_confirmed_at,
      e.exercise_id,e.source,e.category,e.notes,d.provider_name,d.detail_data
     FROM exercise_entries e LEFT JOIN exercise_preset_entries p ON p.id=e.exercise_preset_entry_id AND p.user_id=e.user_id
     LEFT JOIN LATERAL (SELECT COUNT(*) AS set_count,COUNT(completed_at) AS completed_count,
       MAX(completed_at) AS last_completed,MIN(completed_at) AS first_completed FROM exercise_entry_sets WHERE exercise_entry_id=e.id) s ON TRUE
     LEFT JOIN LATERAL (SELECT provider_name,detail_data FROM exercise_entry_activity_details
       WHERE exercise_entry_id=e.id ORDER BY CASE WHEN detail_type LIKE '%activity_data%' THEN 0 ELSE 1 END,id LIMIT 1) d ON TRUE
     WHERE e.user_id=$1 AND e.entry_date BETWEEN $2 AND $3 AND e.exercise_name<>'Active Calories'
     ORDER BY e.entry_date,e.id`,
    [userId, from, to]
  );
  const resolutions = await client.query(
    `SELECT user_id,occurrence_id,local_day::text,revision,action,record_id,entry_id,updated_at::text
     FROM activity_plan_resolutions WHERE user_id=$1 AND local_day BETWEEN $2 AND $3`,
    [userId, from, to]
  );
  const mobilityPlans = await client.query(
    'SELECT revision,data,deleted FROM mobility_plans WHERE user_id=$1 AND local_day BETWEEN $2 AND $3',
    [userId, from, to]
  );
  const mobilitySessions = await client.query(
    `SELECT s.revision,s.data,s.deleted,COALESCE(s.provenance,'phone') AS provenance FROM mobility_sessions s
     JOIN mobility_plans p ON p.id=s.plan_id AND p.user_id=s.user_id
     WHERE s.user_id=$1 AND p.local_day BETWEEN $2 AND $3`,
    [userId, from, to]
  );
  // Categories of the planned exercises, so a plan row is classified like a
  // logged one ("Pull Workout" in Strength is strength, not "other"). Read
  // live: snapshots predate this field, and RLS limits it to visible rows.
  const plannedExerciseIds = [
    ...new Set(
      versions.rows.flatMap((row) =>
        (Array.isArray(row.assignments) ? row.assignments : []).flatMap(
          (assignment: {
            exerciseId?: string | null;
            exercises?: { exerciseId?: string }[];
          }) => [
            ...(assignment.exerciseId ? [assignment.exerciseId] : []),
            ...(assignment.exercises ?? []).flatMap((exercise) =>
              exercise.exerciseId ? [exercise.exerciseId] : []
            ),
          ]
        )
      )
    ),
  ];
  const categories =
    plannedExerciseIds.length > 0
      ? await client.query<{ id: string; category: string | null }>(
          'SELECT id::text, category FROM exercises WHERE id = ANY($1::uuid[])',
          [plannedExerciseIds]
        )
      : { rows: [] };
  // pg's textual timestamptz uses a space; normalize at the database boundary.
  const timestamp = (value: unknown): string | null =>
    value === null || value === undefined
      ? null
      : new Date(String(value)).toISOString();
  return {
    versions: z.array(planVersionSchema).parse(
      versions.rows.map((row) => ({
        ...row,
        captured_at: timestamp(row.captured_at),
      }))
    ),
    entries: z.array(planningEntrySchema).parse(
      entries.rows.map((row) => ({
        ...row,
        recorded_at: timestamp(row.recorded_at),
        first_confirmed_at: timestamp(row.first_confirmed_at),
      }))
    ),
    resolutions: z.array(activityPlanResolutionsSchema).parse(
      resolutions.rows.map((row) => ({
        ...row,
        updated_at: timestamp(row.updated_at),
      }))
    ),
    mobilityPlans: z.array(mobilityPlanRecordSchema).parse(mobilityPlans.rows),
    mobilitySessions: z
      .array(mobilitySessionRecordSchema)
      .parse(mobilitySessions.rows),
    exerciseCategories: Object.fromEntries(
      categories.rows.map((row) => [row.id, row.category])
    ) as Record<string, string | null>,
  };
}
export type ActivityPlanningData = Awaited<
  ReturnType<typeof readActivityPlanningData>
>;
