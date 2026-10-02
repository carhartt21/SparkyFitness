import type { PoolClient } from 'pg';
import { z } from 'zod';
import {
  coachingEvidenceRowSchema,
  coachingGoalFieldSchema,
  coachingMetricDomain,
  mobilitySessionSchema,
  instantToDay,
  addDays,
  type CoachingDomain,
  type CoachingEvidenceRow,
} from '@workspace/shared';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { getFoodDerivedWaterMlForDate } from '../models/foodMisc.js';
import { readStoredGoal } from '../models/goalRepository.js';
import goalService from './goalService.js';
import nutrientGoalPreferenceService from './nutrientGoalPreferenceService.js';
import { sumFoodEntryCalories } from './calorieBalanceService.js';
import {
  aggregateWorkoutPlanAdherence,
  type WorkoutPlanVersionRow,
  type CompletedPlanAssignmentRow,
} from './exerciseReviewService.js';

interface Projection {
  domain: CoachingDomain;
  kind: string;
  query: string;
}
const foodColumns =
  'id,entry_date,created_at,source,food_name,quantity,unit,serving_size,serving_unit,calories,protein,carbs,fat,dietary_fiber,saturated_fat,sugars,sodium,caffeine_mg,alcohol_g,water_ml,meal_type_id,meal_plan_template_id';
const projections: readonly Projection[] = [
  {
    domain: 'nutrition',
    kind: 'hydration',
    query:
      'SELECT id,entry_date,created_at,logged_at AS updated_at,source,water_ml,hydration_factor,food_entry_id FROM water_intake_entries WHERE user_id=$1 AND entry_date BETWEEN $2 AND $3',
  },
  {
    domain: 'nutrition',
    kind: 'food',
    query: `SELECT ${foodColumns} FROM food_entries WHERE user_id=$1 AND entry_date BETWEEN $2 AND $3`,
  },
  {
    domain: 'nutrition',
    kind: 'meal_status',
    query:
      "SELECT meal_type_id::text || ':' || entry_date::text AS id,entry_date,updated_at,status,meal_type_id FROM meal_day_statuses WHERE user_id=$1 AND entry_date BETWEEN $2 AND $3",
  },
  {
    domain: 'nutrition',
    kind: 'meal_occurrence',
    query:
      'SELECT p.id,p.plan_date AS entry_date,p.updated_at,p.state,v.template_id,p.template_version_id,p.assignment_id,p.item_snapshot FROM meal_plans p JOIN meal_plan_template_versions v ON v.id=p.template_version_id AND v.user_id=p.user_id WHERE p.user_id=$1 AND p.plan_date BETWEEN $2 AND $3',
  },
  {
    domain: 'activity',
    kind: 'exercise',
    query: `SELECT e.id,e.entry_date,e.updated_at,e.source,e.exercise_name,e.duration_minutes,e.calories_burned,e.distance,e.steps,e.workout_plan_origin_assignment_id,e.workout_plan_assignment_id,
    (SELECT count(*)::integer FROM exercise_entry_sets s WHERE s.exercise_entry_id=e.id AND s.completed_at IS NOT NULL) AS completed_set_count
    FROM exercise_entries e WHERE e.user_id=$1 AND e.entry_date BETWEEN $2 AND $3`,
  },
  {
    domain: 'activity',
    kind: 'daily_activity',
    query:
      'SELECT id,entry_date,updated_at,source_provider AS source,total_steps,total_distance_meters,active_calories,total_calories FROM daily_health_metrics WHERE user_id=$1 AND entry_date BETWEEN $2 AND $3',
  },
  {
    domain: 'recovery',
    kind: 'sleep',
    query:
      'SELECT id,entry_date,updated_at,source,bedtime,wake_time,duration_in_seconds,time_asleep_in_seconds,sleep_score,deep_sleep_seconds,rem_sleep_seconds,awake_sleep_seconds,avg_overnight_hrv,resting_heart_rate,record_timezone FROM sleep_entries WHERE user_id=$1 AND entry_date BETWEEN $2 AND $3',
  },
  {
    domain: 'recovery',
    kind: 'checkin',
    query:
      'SELECT id,entry_date,updated_at,state,energy,stress,sleep_quality,overall_day,completed_at,skipped_at FROM daily_checkins WHERE user_id=$1 AND entry_date BETWEEN $2 AND $3',
  },
  {
    domain: 'habits',
    kind: 'habit_log',
    query: `SELECT m.id,m.entry_date,m.updated_at,m.source,m.category_id,m.value,c.name,c.habit_type,c.habit_target AS target,c.measurement_type AS unit,c.habit_days AS days
    FROM custom_measurements m JOIN custom_categories c ON c.id=m.category_id AND c.user_id=m.user_id
    WHERE m.user_id=$1 AND m.entry_date BETWEEN $2 AND $3 AND c.habit_type IS NOT NULL`,
  },
  {
    domain: 'measurements',
    kind: 'measurement',
    query:
      'SELECT id,entry_date,updated_at,weight,waist,body_fat_percentage,steps FROM check_in_measurements WHERE user_id=$1 AND entry_date BETWEEN $2 AND $3',
  },
];
const objectStatus = (value: unknown, mealId: string) => {
  const data = z.record(z.string(), z.unknown()).parse(value);
  return (
    data.meal_type_id === mealId &&
    ['complete', 'skipped'].includes(String(data.status))
  );
};
const jsonObject = z.record(z.string(), z.json());
const numeric = (value: unknown): number | null =>
  value === null ||
  value === undefined ||
  value === '' ||
  !Number.isFinite(Number(value))
    ? null
    : Number(value);
const stamp = (value: unknown): string | null =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;

/** Frozen, explicit wellness projections. No auth/provider secrets or medical domains. */
export async function collectCoachingEvidence(
  client: PoolClient,
  userId: string,
  domains: readonly CoachingDomain[],
  from: string,
  to: string
): Promise<{ rows: CoachingEvidenceRow[]; warnings: string[] }> {
  const rows: CoachingEvidenceRow[] = [];
  const warnings = [
    'Missing days, unsynced records, and null nutrients are unknown, not zero or non-adherence.',
    'Zero nutrient values can be provider defaults. Do not infer deficiency without nutrient coverage.',
    'A calorie target is not TDEE. No energy expenditure or calorie change is inferred from a default.',
    'Legacy meal-template-generated diary rows are unconfirmed consumption.',
    'Daily activity summaries already include workouts. Never add active calories to workout calories.',
  ];
  for (const projection of projections) {
    if (!domains.includes(projection.domain)) continue;
    const result = await client.query<{ value: unknown }>(
      `SELECT to_jsonb(projection) AS value FROM (${projection.query} ORDER BY entry_date,id LIMIT 10001) projection`,
      [userId, from, to]
    );
    if (result.rows.length > 10000)
      warnings.push(
        `${projection.kind}: evidence is incomplete; the 10,000-record collection bound was reached.`
      );
    for (const raw of result.rows.slice(0, 10000)) {
      const value = jsonObject.parse(raw.value);
      const day =
        typeof value.entry_date === 'string'
          ? value.entry_date.slice(0, 10)
          : null;
      rows.push(
        coachingEvidenceRowSchema.parse({
          id: `${projection.kind}:${String(value.id)}`,
          domain: projection.domain,
          kind: projection.kind,
          day,
          source: typeof value.source === 'string' ? value.source : 'app',
          observedAt: stamp(value.updated_at ?? value.created_at),
          confirmation:
            projection.kind === 'food' && value.meal_plan_template_id
              ? 'unconfirmed'
              : projection.kind === 'exercise' &&
                  value.workout_plan_origin_assignment_id &&
                  Number(value.completed_set_count) === 0
                ? 'unconfirmed'
                : 'confirmed',
          value,
        })
      );
    }
  }
  if (domains.includes('nutrition') || domains.includes('activity')) {
    const [stored, displayed, directions] = await Promise.all([
      readStoredGoal(client, userId, to),
      goalService.getUserGoals(userId, to, undefined, true) as Promise<unknown>,
      nutrientGoalPreferenceService.getEffectiveGoalTypes(userId),
    ]);
    const projectGoals = (value: unknown, domain: CoachingDomain) => {
      const input =
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)
          : {};
      return Object.fromEntries(
        coachingGoalFieldSchema.options
          .filter((field) => coachingMetricDomain(field) === domain)
          .map((field) => [field, numeric(input[field])])
      );
    };
    for (const domain of ['nutrition', 'activity'] as const) {
      if (!domains.includes(domain)) continue;
      rows.push(
        coachingEvidenceRowSchema.parse({
          id: `goals:${domain}:${to}`,
          domain,
          kind: 'goals',
          day: to,
          source: 'server',
          observedAt: new Date().toISOString(),
          confirmation: 'confirmed',
          value: {
            stored: projectGoals(stored, domain),
            displayed: projectGoals(displayed, domain),
            directions: domain === 'nutrition' ? directions : {},
            limitation:
              'Displayed goals may be calculated. Acceptance updates stored targets only, preserving goal-mode settings.',
          },
        })
      );
    }
  }
  const foodWaterPreference = domains.includes('nutrition')
    ? await client.query<{ add_food_water_to_intake: boolean }>(
        'SELECT add_food_water_to_intake FROM user_preferences WHERE user_id=$1',
        [userId]
      )
    : null;
  const trackedMeals = domains.includes('nutrition')
    ? (
        await client.query<{ id: string }>(
          "SELECT id FROM meal_types WHERE (user_id=$1 OR user_id IS NULL) AND is_visible AND lower(trim(name))<>'fddb import'",
          [userId]
        )
      ).rows
    : [];
  if (domains.includes('habits')) {
    const habits = await client.query<{ value: unknown }>(
      "SELECT jsonb_build_object('id',id,'days',habit_days,'target',habit_target) AS value FROM custom_categories WHERE user_id=$1 AND habit_type IS NOT NULL",
      [userId]
    );
    for (const habit of habits.rows) {
      const value = jsonObject.parse(habit.value);
      rows.push(
        coachingEvidenceRowSchema.parse({
          id: `habit_definition:${String(value.id)}`,
          domain: 'habits',
          kind: 'habit_definition',
          day: null,
          observedAt: null,
          source: 'app',
          confirmation: 'confirmed',
          value,
        })
      );
    }
  }
  if (domains.includes('activity')) {
    const timezone = await loadUserTimezone(userId);
    const sessions = await client.query<{
      id: string;
      day: string;
      data: unknown;
    }>(
      "SELECT id,((data->>'startedAt')::timestamptz AT TIME ZONE $4)::date::text AS day,data FROM mobility_sessions WHERE user_id=$1 AND NOT deleted AND data->>'state' IN ('finished','cancelled') AND ((data->>'startedAt')::timestamptz AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date",
      [userId, from, to, timezone]
    );
    for (const session of sessions.rows) {
      const parsed = mobilitySessionSchema.safeParse(session.data);
      if (!parsed.success) continue;
      rows.push(
        coachingEvidenceRowSchema.parse({
          id: `mobility_session:${session.id}`,
          domain: 'activity',
          kind: 'mobility_session',
          day: session.day,
          observedAt: null,
          source: 'app',
          confirmation: 'confirmed',
          value: parsed.data,
        })
      );
    }
  }
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const drinks = rows.filter(
      (row) => row.kind === 'hydration' && row.day === day
    );
    const foodWater = foodWaterPreference?.rows[0]?.add_food_water_to_intake
      ? await getFoodDerivedWaterMlForDate(userId, day, client, true)
      : 0;
    if (drinks.length || foodWater > 0)
      rows.push(
        coachingEvidenceRowSchema.parse({
          id: `hydration_day:${day}`,
          domain: 'nutrition',
          kind: 'hydration_day',
          day,
          source: 'server',
          observedAt: null,
          confirmation: 'confirmed',
          value: {
            effectiveWaterMl:
              foodWater +
              drinks.reduce((sum, row) => {
                const data = jsonObject.parse(row.value);
                return (
                  sum +
                  Number(data.water_ml) * (numeric(data.hydration_factor) ?? 1)
                );
              }, 0),
            unit: 'ml',
            limitation:
              'Matches account hydration preferences. Linked food water is excluded from the food component to avoid double counting. Missing logs are unknown.',
          },
        })
      );
    const foods = rows.filter(
      (row) =>
        row.kind === 'food' &&
        row.day === day &&
        row.confirmation === 'confirmed'
    );
    if (foods.length) {
      const values = foods.map((row) => jsonObject.parse(row.value));
      const nutrients = Object.fromEntries(
        [
          'protein',
          'carbs',
          'fat',
          'dietary_fiber',
          'saturated_fat',
          'sugars',
          'sodium',
          'caffeine_mg',
          'alcohol_g',
          'water_ml',
        ].map((field) => {
          const known = values.filter(
            (value) =>
              numeric(value[field]) !== null &&
              (numeric(value.serving_size) ?? 0) > 0
          );
          const total = known.length
            ? known.reduce(
                (sum, value) =>
                  sum +
                  (Number(value[field]) * Number(value.quantity)) /
                    Number(value.serving_size),
                0
              )
            : null;
          return [
            field,
            {
              value: total,
              knownEntries: known.length,
              totalEntries: values.length,
            },
          ];
        })
      );
      const knownCalories = values.filter(
        (value) =>
          numeric(value.calories) !== null &&
          (numeric(value.serving_size) ?? 0) > 0
      );
      rows.push(
        coachingEvidenceRowSchema.parse({
          id: `nutrition_day:${day}`,
          domain: 'nutrition',
          kind: 'nutrition_day',
          day,
          source: 'server',
          observedAt: null,
          confirmation: 'confirmed',
          value: {
            calories: knownCalories.length
              ? sumFoodEntryCalories(
                  knownCalories.map((value) => ({
                    calories: Number(value.calories),
                    quantity: Number(value.quantity),
                    serving_size: Number(value.serving_size),
                  }))
                )
              : null,
            nutrients,
            confirmedEntryCount: values.length,
            knownCalorieEntries: knownCalories.length,
            completeDay:
              trackedMeals.length > 0 &&
              trackedMeals.every((meal) =>
                rows.some(
                  (row) =>
                    row.kind === 'meal_status' &&
                    row.day === day &&
                    objectStatus(row.value, meal.id)
                )
              ) &&
              !rows.some(
                (row) =>
                  row.kind === 'food' &&
                  row.day === day &&
                  row.confirmation === 'unconfirmed'
              ),
            units: {
              calories: 'kcal',
              protein: 'g',
              carbs: 'g',
              fat: 'g',
              dietary_fiber: 'g',
              saturated_fat: 'g',
              sugars: 'g',
              sodium: 'mg',
              caffeine_mg: 'mg',
              alcohol_g: 'g',
              water_ml: 'ml',
            },
            unconfirmedEntryCount: rows.filter(
              (row) =>
                row.kind === 'food' &&
                row.day === day &&
                row.confirmation === 'unconfirmed'
            ).length,
            limitation:
              'Recorded intake only, not proof of a complete day. Food-derived water is not the full hydration ledger.',
          },
        })
      );
    }
  }
  if (domains.includes('activity')) {
    const actualToday = instantToDay(
      new Date(),
      await loadUserTimezone(userId)
    );
    const versions = (
      await client.query<WorkoutPlanVersionRow>(
        'SELECT template_id,effective_from::text,start_date::text,end_date::text,is_active,assignments FROM workout_plan_template_versions WHERE user_id=$1 AND effective_from<=$2 ORDER BY template_id,effective_from,id',
        [userId, to]
      )
    ).rows;
    const completed = (
      await client.query<CompletedPlanAssignmentRow>(
        'SELECT DISTINCT e.entry_date::text,e.workout_plan_origin_assignment_id AS assignment_id FROM exercise_entries e WHERE e.user_id=$1 AND e.entry_date BETWEEN $2 AND $3 AND e.workout_plan_origin_assignment_id IS NOT NULL AND EXISTS(SELECT 1 FROM exercise_entry_sets s WHERE s.exercise_entry_id=e.id AND s.completed_at IS NOT NULL)',
        [userId, from, to]
      )
    ).rows;
    for (const templateId of new Set(
      versions.map((version) => version.template_id)
    ))
      for (
        let day = from;
        day <= to && day < actualToday;
        day = addDays(day, 1)
      ) {
        const adherence = aggregateWorkoutPlanAdherence(
          versions.filter((version) => version.template_id === templateId),
          completed,
          day,
          day,
          actualToday
        );
        if (!adherence.eligibleScheduledSessions) continue;
        rows.push(
          coachingEvidenceRowSchema.parse({
            id: `workout_adherence:${templateId}:${day}`,
            domain: 'activity',
            kind: 'workout_adherence',
            day,
            source: 'server',
            observedAt: null,
            confirmation: 'confirmed',
            value: {
              templateId,
              ratio:
                adherence.attendedScheduledSessions /
                adherence.eligibleScheduledSessions,
              eligible: adherence.eligibleScheduledSessions,
              attended: adherence.attendedScheduledSessions,
              unit: 'ratio',
              knownSchedule: true,
              limitation:
                'Attendance requires an explicitly completed set. Scheduled entries and timer expiry are not completion.',
            },
          })
        );
      }
  }
  for (const domain of domains) {
    const relevant = rows.filter(
      (row) => row.domain === domain && row.day && row.kind !== 'goals'
    );
    const days = new Set(relevant.map((row) => row.day));
    rows.push(
      coachingEvidenceRowSchema.parse({
        id: `coverage:${domain}`,
        domain,
        kind: 'coverage',
        day: null,
        source: 'server',
        observedAt: null,
        confirmation: 'unknown',
        value: {
          from,
          to,
          observedDays: [...days].sort(),
          recordCount: relevant.length,
          complete: !warnings.some((warning) => warning.includes('10,000')),
          freshness: 'unknown',
          limitation:
            'An observed day does not establish a full day of nutrition, activity, or provider synchronization.',
        },
      })
    );
  }
  return { rows, warnings };
}
