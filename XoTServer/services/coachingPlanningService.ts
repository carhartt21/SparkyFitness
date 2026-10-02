import type { PoolClient } from 'pg';
import { z } from 'zod';
import {
  coachingPlanningContextSchema,
  coachingDomainSchema,
  isFddbImportMeal,
  type CoachingDomain,
  type CoachingAction,
} from '@workspace/shared';
import {
  coachingTransaction,
  CoachingValidationError,
  CoachingNotFoundError,
} from '../models/coachingRepository.js';
import {
  readCoachingAgent,
  readCoachingSettings,
  requireCoachingEnabled,
} from './coachingRunService.js';

const object = z.record(z.string(), z.json());
type JsonObject = z.infer<typeof object>;
interface PlanningProjection {
  kind: string;
  domain: CoachingDomain;
  query: string;
}
const projections: readonly PlanningProjection[] = [
  {
    kind: 'food',
    domain: 'nutrition',
    query:
      "SELECT id::text,name AS label,jsonb_build_object('name',name,'brand',brand,'is_quick_food',is_quick_food) AS data FROM foods",
  },
  {
    kind: 'variant',
    domain: 'nutrition',
    query:
      "SELECT v.id::text,f.name || ' · ' || v.serving_size::text || ' ' || v.serving_unit AS label,to_jsonb(v)-'created_at'-'updated_at' AS data FROM food_variants v JOIN foods f ON f.id=v.food_id",
  },
  {
    kind: 'meal',
    domain: 'nutrition',
    query:
      "SELECT id::text,name AS label,jsonb_build_object('name',name,'serving_size',serving_size,'serving_unit',serving_unit,'total_servings',total_servings) AS data FROM meals",
  },
  {
    kind: 'meal_type',
    domain: 'nutrition',
    query:
      "SELECT id::text,name AS label,jsonb_build_object('name',name,'default_time',default_time) AS data FROM meal_types",
  },
  {
    kind: 'meal_plan',
    domain: 'nutrition',
    query:
      "SELECT id::text,plan_name AS label,(to_jsonb(t)-'user_id') || jsonb_build_object('assignments',COALESCE((SELECT jsonb_agg(to_jsonb(a)-'template_id' ORDER BY a.day_of_week,a.id) FROM meal_plan_template_assignments a WHERE a.template_id=t.id),'[]'::jsonb)) AS data FROM meal_plan_templates t WHERE user_id=$1",
  },
  {
    kind: 'exercise',
    domain: 'activity',
    query:
      "SELECT id::text,name AS label,jsonb_build_object('name',name,'category',category,'equipment',equipment) AS data FROM exercises",
  },
  {
    kind: 'workout_preset',
    domain: 'activity',
    query:
      "SELECT p.id::text,p.name AS label,jsonb_build_object('name',p.name,'description',p.description,'exercises',COALESCE((SELECT jsonb_agg((to_jsonb(e)-'workout_preset_id') || jsonb_build_object('sets',COALESCE((SELECT jsonb_agg(to_jsonb(s)-'workout_preset_exercise_id' ORDER BY s.id) FROM workout_preset_exercise_sets s WHERE s.workout_preset_exercise_id=e.id),'[]'::jsonb)) ORDER BY e.id) FROM workout_preset_exercises e WHERE e.workout_preset_id=p.id),'[]'::jsonb)) AS data FROM workout_presets p",
  },
  {
    kind: 'workout_plan',
    domain: 'activity',
    query:
      "SELECT id::text,plan_name AS label,(to_jsonb(t)-'user_id') || jsonb_build_object('assignments',COALESCE((SELECT jsonb_agg((to_jsonb(a)-'template_id') || jsonb_build_object('sets',COALESCE((SELECT jsonb_agg(to_jsonb(s)-'assignment_id' ORDER BY s.set_number,s.id) FROM workout_plan_assignment_sets s WHERE s.assignment_id=a.id),'[]'::jsonb)) ORDER BY a.id) FROM workout_plan_template_assignments a WHERE a.template_id=t.id),'[]'::jsonb)) AS data FROM workout_plan_templates t WHERE user_id=$1",
  },
  {
    kind: 'habit',
    domain: 'habits',
    query:
      "SELECT id::text,COALESCE(display_name,name) AS label,jsonb_build_object('name',COALESCE(display_name,name),'habit_type',habit_type,'target',habit_target,'unit',measurement_type,'days',habit_days,'reminder_time',habit_reminder_time,'active',habit_active) AS data FROM custom_categories WHERE user_id=$1 AND habit_type IS NOT NULL",
  },
  {
    kind: 'measurement_reminder',
    domain: 'measurements',
    query:
      "SELECT id::text,measurement_key AS label,to_jsonb(t)-'user_id' AS data FROM measurement_reminders t WHERE user_id=$1",
  },
  {
    kind: 'mobility_routine',
    domain: 'activity',
    query:
      "SELECT id::text,data->>'name' AS label,jsonb_build_object('revision',revision,'definition',data) AS data FROM mobility_routines WHERE user_id=$1 AND deleted=false",
  },
  {
    kind: 'mobility_schedule',
    domain: 'activity',
    query:
      "SELECT id::text,data->>'time' AS label,jsonb_build_object('revision',revision,'definition',data) AS data FROM mobility_schedules WHERE user_id=$1 AND deleted=false",
  },
];

/** Database RLS governs accessible library choices; agent domain scopes narrow it. */
export async function getCoachingPlanningContext(
  userId: string,
  agentId: string | null,
  input: {
    offset?: number;
    limit?: number;
    search?: string;
    kind?: string;
  } = {}
) {
  requireCoachingEnabled();
  return coachingTransaction(
    userId,
    async (client) => {
      const { settings } = await readCoachingSettings(client, userId);
      const agent = agentId
        ? await readCoachingAgent(client, userId, agentId)
        : null;
      const domains = agent
        ? settings.domains.filter((domain) => agent.domains.includes(domain))
        : coachingDomainSchema.options;
      const selected = projections.filter(
        (projection) =>
          domains.includes(projection.domain) &&
          (!input.kind || projection.kind === input.kind)
      );
      const offset = input.offset ?? 0,
        limit = input.limit ?? 50;
      if (!selected.length)
        return coachingPlanningContextSchema.parse({
          items: [],
          offset,
          nextOffset: null,
          total: 0,
          warnings: [],
        });
      const union = selected
        .map(
          (projection) =>
            `SELECT '${projection.kind}'::text AS kind,'${projection.domain}'::text AS domain,p.* FROM (${projection.query}) p`
        )
        .join(' UNION ALL ');
      const result = await client.query<{
        kind: string;
        domain: CoachingDomain;
        id: string;
        label: string;
        data: unknown;
        total: string;
      }>(
        `SELECT *,COUNT(*) OVER() AS total FROM (${union}) choices WHERE $1::uuid IS NOT NULL AND label ILIKE $2 AND NOT(kind='meal_type' AND lower(trim(label))='fddb import') ORDER BY kind,lower(label),id LIMIT $3 OFFSET $4`,
        [userId, `%${input.search ?? ''}%`, limit, offset]
      );
      const total = Number(result.rows[0]?.total ?? 0);
      return coachingPlanningContextSchema.parse({
        items: result.rows.map(({ total: _total, ...row }) => row),
        offset,
        nextOffset: offset + limit < total ? offset + limit : null,
        total,
        warnings: [
          'Reference IDs and quantities are revalidated on preview and acceptance. Planned meals and workouts do not establish consumption or completion.',
        ],
      });
    },
    true
  );
}

/** Include nutrition and component revisions in the approval conflict check. */
export async function coachingReferenceState(
  client: PoolClient,
  userId: string,
  action: CoachingAction,
  lock = false
): Promise<JsonObject[]> {
  const states: JsonObject[] = [];
  const read = async (
    table:
      | 'foods'
      | 'food_variants'
      | 'meals'
      | 'meal_types'
      | 'exercises'
      | 'workout_presets'
      | 'meal_plan_templates'
      | 'workout_plan_templates'
      | 'custom_categories'
      | 'mobility_routines'
      | 'mobility_schedules',
    id: string | number,
    owner = false
  ) => {
    const result = await client.query<{ data: unknown }>(
      `SELECT to_jsonb(t) AS data FROM ${table} t WHERE id=$1 ${owner ? 'AND user_id=$2' : ''} ${lock ? 'FOR SHARE' : ''}`,
      owner ? [id, userId] : [id]
    );
    if (!result.rows[0])
      throw new CoachingNotFoundError(
        'A referenced library item was deleted or is no longer accessible.'
      );
    const value = object.parse(result.rows[0].data);
    if (
      table === 'meal_types' &&
      typeof value.name === 'string' &&
      isFddbImportMeal(value.name)
    )
      throw new CoachingValidationError(
        'FDDB imports are read-only and cannot be used for a planned meal.'
      );
    if (table === 'meal_plan_templates' || table === 'workout_plan_templates') {
      const assignmentTable =
        table === 'meal_plan_templates'
          ? 'meal_plan_template_assignments'
          : 'workout_plan_template_assignments';
      const assignments = await client.query<{ data: unknown }>(
        `SELECT to_jsonb(a) AS data FROM ${assignmentTable} a WHERE template_id=$1 ORDER BY id ${lock ? 'FOR SHARE' : ''}`,
        [id]
      );
      const definitions = assignments.rows.map((row) => object.parse(row.data));
      for (const assignment of definitions) {
        if (table === 'workout_plan_templates') {
          const sets = await client.query<{ data: unknown }>(
            `SELECT to_jsonb(s) AS data FROM workout_plan_assignment_sets s WHERE assignment_id=$1 ORDER BY set_number,id ${lock ? 'FOR SHARE' : ''}`,
            [assignment.id]
          );
          assignment.sets = sets.rows.map((row) => object.parse(row.data));
        }
      }
      value.assignments = definitions;
      // Before values may reference different or deleted library items. Resolve
      // accessible labels without requiring those old items to be valid inputs.
      for (const [field, source, cast, label] of [
        ['food_id', 'foods', 'uuid', 'name'],
        [
          'variant_id',
          'food_variants',
          'uuid',
          "serving_size::text || ' ' || serving_unit",
        ],
        ['meal_id', 'meals', 'uuid', 'name'],
        ['meal_type_id', 'meal_types', 'uuid', 'name'],
        ['exercise_id', 'exercises', 'uuid', 'name'],
        ['workout_preset_id', 'workout_presets', 'integer', 'name'],
      ] as const) {
        const ids = [
          ...new Set(
            definitions
              .map((definition) => definition[field])
              .filter(
                (item): item is string | number =>
                  typeof item === 'string' || typeof item === 'number'
              )
          ),
        ];
        if (!ids.length) continue;
        const labels = await client.query<{ id: string; name: string }>(
          `SELECT id::text,name FROM (SELECT id,${label} AS name FROM ${source}) t WHERE id=ANY($1::${cast}[]) ORDER BY id`,
          [ids]
        );
        for (const item of ids)
          states.push({
            table: source,
            id: item,
            name:
              labels.rows.find((row) => row.id === String(item))?.name ??
              'Unavailable library item',
          });
      }
    }
    states.push({ table, ...value });
    return value;
  };
  const food = async (
    foodId: string,
    variantId: string | null,
    unit: string
  ) => {
    await read('foods', foodId);
    const result = await client.query<{
      id: string;
      food_id: string;
      serving_unit: string;
    }>(
      `SELECT id,food_id,serving_unit FROM food_variants WHERE food_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY is_default DESC NULLS LAST,created_at,id LIMIT 1 ${lock ? 'FOR SHARE' : ''}`,
      [foodId, variantId]
    );
    const variant = result.rows[0];
    if (!variant || variant.serving_unit !== unit)
      throw new CoachingValidationError(
        'Choose an accessible serving option whose unit matches the planned quantity.'
      );
    await read('food_variants', variant.id);
    return variant;
  };
  const meal = async (mealId: string, visited: Set<string>) => {
    if (visited.has(mealId) || visited.size >= 8)
      throw new CoachingValidationError(
        'Meal composition is cyclic or too deeply nested.'
      );
    const branch = new Set(visited).add(mealId);
    await read('meals', mealId);
    const result = await client.query<{ data: unknown }>(
      `SELECT to_jsonb(m) AS data FROM meal_foods m WHERE meal_id=$1 ORDER BY id ${lock ? 'FOR SHARE' : ''}`,
      [mealId]
    );
    if (!result.rows.length)
      throw new CoachingValidationError(
        'A planned meal must contain accessible ingredients.'
      );
    for (const row of result.rows) {
      const value = object.parse(row.data);
      states.push({ table: 'meal_foods', ...value });
      if (typeof value.child_meal_id === 'string')
        await meal(value.child_meal_id, branch);
      else if (
        typeof value.food_id === 'string' &&
        typeof value.unit === 'string'
      )
        await food(
          value.food_id,
          typeof value.variant_id === 'string' ? value.variant_id : null,
          value.unit
        );
      else
        throw new CoachingValidationError(
          'A planned meal has an unresolved ingredient.'
        );
    }
  };
  if (action.kind === 'meal_plan') {
    if (action.templateId)
      await read('meal_plan_templates', action.templateId, true);
    for (const assignment of action.definition.assignments) {
      await read('meal_types', assignment.meal_type_id);
      if (assignment.item_type === 'food')
        await food(assignment.food_id, assignment.variant_id, assignment.unit);
      else {
        const source = await read('meals', assignment.meal_id);
        if (
          assignment.unit !== 'serving' &&
          assignment.unit !== source.serving_unit
        )
          throw new CoachingValidationError(
            'Choose a valid meal serving unit.'
          );
        await meal(assignment.meal_id, new Set());
      }
    }
  } else if (action.kind === 'workout_plan') {
    if (action.templateId)
      await read('workout_plan_templates', action.templateId, true);
    for (const assignment of action.definition.assignments) {
      if (assignment.exercise_id)
        await read('exercises', assignment.exercise_id);
      if (assignment.workout_preset_id) {
        await read('workout_presets', assignment.workout_preset_id);
        const children = await client.query<{ data: unknown }>(
          `SELECT to_jsonb(e) AS data FROM workout_preset_exercises e WHERE workout_preset_id=$1 ORDER BY id ${lock ? 'FOR SHARE' : ''}`,
          [assignment.workout_preset_id]
        );
        if (!children.rows.length)
          throw new CoachingValidationError(
            'A workout preset must contain accessible exercises.'
          );
        for (const child of children.rows) {
          const value = object.parse(child.data);
          states.push({ table: 'workout_preset_exercises', ...value });
          const sets = await client.query<{ data: unknown }>(
            `SELECT to_jsonb(s) AS data FROM workout_preset_exercise_sets s WHERE workout_preset_exercise_id=$1 ORDER BY id ${lock ? 'FOR SHARE' : ''}`,
            [value.id]
          );
          for (const set of sets.rows)
            states.push({
              table: 'workout_preset_exercise_sets',
              ...object.parse(set.data),
            });
          if (typeof value.exercise_id === 'string')
            await read('exercises', value.exercise_id);
        }
      }
    }
  } else if (action.kind === 'habit' && action.habitId) {
    const current = await read('custom_categories', action.habitId, true);
    if (current.habit_type !== action.definition.habit_type)
      throw new CoachingValidationError(
        'A habit’s type cannot change while preserving existing logs.'
      );
  } else if (action.kind === 'mobility') {
    if (action.scheduleId) {
      const schedule = await read(
        'mobility_schedules',
        action.scheduleId,
        true
      );
      const definition = object.parse(schedule.data);
      if (definition.routineId !== action.routineId)
        throw new CoachingValidationError(
          'The schedule must belong to the selected routine.'
        );
      if (!action.definition.schedule)
        throw new CoachingValidationError(
          'Choose schedule details when revising an existing schedule.'
        );
    }
    if (action.routineId)
      await read('mobility_routines', action.routineId, true);
    for (const step of action.definition.steps)
      if (step.exerciseId) await read('exercises', step.exerciseId);
  } else if (
    action.kind === 'measurement_reminder' &&
    action.definition.measurement_key.startsWith('custom:')
  )
    await read(
      'custom_categories',
      action.definition.measurement_key.slice(7),
      true
    );
  return states;
}
