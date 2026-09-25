import { getClient } from '../db/poolManager.js';
import { addDays, classifyActivitySport, daysBetween } from '@workspace/shared';
import type {
  ExerciseReviewAdherencePeriod,
  ExerciseReviewBucket,
  ExerciseReviewPeriod,
  ExerciseReviewResponse,
  ExerciseReviewSourceSession,
  ExerciseReviewTrendPoint,
} from '@workspace/shared';
import { resolveTemplateStartDay } from '../utils/timezoneLoader.js';

export interface WorkoutPlanVersionRow {
  template_id: number;
  effective_from: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  assignments: { id: number; dayOfWeek: number }[];
}

export interface CompletedPlanAssignmentRow {
  entry_date: string;
  assignment_id: number;
}

/** A scheduled slot is attended once any set in that assignment is completed. */
export function aggregateWorkoutPlanAdherence(
  versions: readonly WorkoutPlanVersionRow[],
  completed: readonly CompletedPlanAssignmentRow[],
  startDate: string,
  endDate: string,
  today: string
): ExerciseReviewAdherencePeriod {
  const byTemplate = new Map<number, WorkoutPlanVersionRow[]>();
  for (const version of versions) {
    const list = byTemplate.get(version.template_id) ?? [];
    list.push(version);
    byTemplate.set(version.template_id, list);
  }
  const completedSlots = new Set(
    completed.map(
      ({ entry_date, assignment_id }) => `${entry_date}:${assignment_id}`
    )
  );
  let elapsedDays = 0;
  let coveredDays = 0;
  let eligibleScheduledSessions = 0;
  let attendedScheduledSessions = 0;
  for (
    let day = startDate;
    day <= endDate && day < today;
    day = addDays(day, 1)
  ) {
    elapsedDays += 1;
    const dayOfWeek = new Date(`${day}T12:00:00Z`).getUTCDay();
    let hasKnownPlanState = false;
    for (const history of byTemplate.values()) {
      // Rows arrive in effective_from, id order, so the last applicable
      // snapshot is the schedule that was in force on this calendar day.
      let version: WorkoutPlanVersionRow | undefined;
      for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index].effective_from <= day) {
          version = history[index];
          break;
        }
      }
      if (!version) continue;
      hasKnownPlanState = true;
      if (
        !version.is_active ||
        (version.start_date && version.start_date > day) ||
        (version.end_date && version.end_date < day)
      )
        continue;
      for (const assignment of version.assignments) {
        if (assignment.dayOfWeek !== dayOfWeek) continue;
        eligibleScheduledSessions += 1;
        if (completedSlots.has(`${day}:${assignment.id}`)) {
          attendedScheduledSessions += 1;
        }
      }
    }
    if (hasKnownPlanState) coveredDays += 1;
  }
  return {
    startDate,
    endDate,
    elapsedDays,
    coveredDays,
    eligibleScheduledSessions,
    attendedScheduledSessions,
    adherencePercent: eligibleScheduledSessions
      ? Math.round(
          (attendedScheduledSessions / eligibleScheduledSessions) * 100
        )
      : null,
  };
}

export interface ExerciseReviewRow {
  id: string;
  exercise_preset_entry_id: string | null;
  entry_date: string;
  exercise_name: string | null;
  category: string | null;
  notes: string | null;
  provider_name: string | null;
  detail_data: unknown;
  exercise_source_id: string | null;
  session_name: string | null;
  session_source: string | null;
  distance: number | string | null;
  duration_minutes: number | string | null;
  lifted_volume_kg: number | string | null;
  reps: number | string | null;
}

/** One link per diary session, even when a workout contains many exercises. */
export function sourceSessionsForExerciseReview(
  rows: readonly ExerciseReviewRow[],
  startDate: string,
  endDate: string
): ExerciseReviewSourceSession[] {
  const sessions = new Map<string, ExerciseReviewSourceSession>();
  for (const row of rows) {
    if (row.entry_date < startDate || row.entry_date > endDate) continue;
    if (row.exercise_name === 'Active Calories') continue;
    const type = row.exercise_preset_entry_id ? 'preset' : 'individual';
    const id = row.exercise_preset_entry_id ?? row.id;
    const key = `${type}:${id}`;
    if (!sessions.has(key)) {
      sessions.set(key, {
        id,
        type,
        entryDate: row.entry_date,
        name: row.session_name ?? row.exercise_name,
        source: row.session_source ?? row.provider_name,
      });
    }
  }
  return [...sessions.values()].sort(
    (a, b) => b.entryDate.localeCompare(a.entryDate) || a.id.localeCompare(b.id)
  );
}

type BucketKey = 'overall' | 'running' | 'cycling' | 'strength' | 'other';
type MutableBucket = ExerciseReviewBucket & { sessionIds: Set<string> };

function safeAmount(value: number | string | null): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function emptyBucket(): MutableBucket {
  return {
    sessions: 0,
    exerciseEntries: 0,
    distanceMeters: 0,
    durationMinutes: 0,
    liftedVolumeKg: 0,
    reps: 0,
    inferredEntries: 0,
    sessionIds: new Set(),
  };
}

function publicBucket(bucket: MutableBucket): ExerciseReviewBucket {
  const { sessionIds: _sessionIds, ...publicFields } = bucket;
  return publicFields;
}

/** Keep recorded facts and session identity intact across sport summaries. */
export function aggregateExerciseReviewPeriod(
  rows: readonly ExerciseReviewRow[],
  startDate: string,
  endDate: string
): ExerciseReviewPeriod {
  const buckets: Record<BucketKey, MutableBucket> = {
    overall: emptyBucket(),
    running: emptyBucket(),
    cycling: emptyBucket(),
    strength: emptyBucket(),
    other: emptyBucket(),
  };

  for (const row of rows) {
    if (row.entry_date < startDate || row.entry_date > endDate) continue;
    if (row.exercise_name === 'Active Calories') continue;
    const { sport, confidence } = classifyActivitySport({
      exerciseName: row.exercise_name,
      category: row.category,
      notes: row.notes,
      providerName: row.provider_name,
      detailData: row.detail_data,
      exerciseSourceId: row.exercise_source_id,
    });
    // A lift called "Bent Over Row" contains a rowing keyword, but an
    // explicitly strength-categorized diary entry is stronger evidence than
    // a name inference. Provider-declared sports still take precedence.
    const reviewedSport =
      row.category?.toLowerCase() === 'strength' && confidence !== 'declared'
        ? 'strength'
        : sport;
    const sportBucket: Exclude<BucketKey, 'overall'> =
      reviewedSport === 'running' ||
      reviewedSport === 'cycling' ||
      reviewedSport === 'strength'
        ? reviewedSport
        : 'other';
    const sessionId = row.exercise_preset_entry_id ?? row.id;
    const distanceMeters = safeAmount(row.distance) * 1000;
    const durationMinutes = safeAmount(row.duration_minutes);
    const liftedVolumeKg = safeAmount(row.lifted_volume_kg);
    const reps = Math.floor(safeAmount(row.reps));
    for (const key of ['overall', sportBucket] as const) {
      const bucket = buckets[key];
      bucket.sessionIds.add(sessionId);
      bucket.exerciseEntries += 1;
      bucket.distanceMeters += distanceMeters;
      bucket.durationMinutes += durationMinutes;
      bucket.liftedVolumeKg += liftedVolumeKg;
      bucket.reps += reps;
      if (confidence === 'inferred') bucket.inferredEntries += 1;
    }
  }

  for (const bucket of Object.values(buckets)) {
    bucket.sessions = bucket.sessionIds.size;
    bucket.distanceMeters = Math.round(bucket.distanceMeters);
    bucket.durationMinutes = Math.round(bucket.durationMinutes * 100) / 100;
    bucket.liftedVolumeKg = Math.round(bucket.liftedVolumeKg * 100) / 100;
  }

  return {
    startDate,
    endDate,
    overall: publicBucket(buckets.overall),
    running: publicBucket(buckets.running),
    cycling: publicBucket(buckets.cycling),
    strength: publicBucket(buckets.strength),
    other: publicBucket(buckets.other),
  };
}

/** Calendar-aligned points preserve zero-activity intervals for honest trends. */
export function aggregateExerciseReviewTrend(
  rows: readonly ExerciseReviewRow[],
  startDate: string,
  endDate: string
): ExerciseReviewTrendPoint[] {
  const span = daysBetween(startDate, endDate) + 1;
  if (span <= 0) return [];
  const granularity = span <= 7 ? 'day' : span <= 31 ? 'week' : 'month';
  const points: ExerciseReviewTrendPoint[] = [];
  let pointStart = startDate;
  while (pointStart <= endDate) {
    let pointEnd: string;
    if (granularity === 'day') {
      pointEnd = pointStart;
    } else if (granularity === 'week') {
      const utcDay = new Date(`${pointStart}T00:00:00Z`).getUTCDay();
      pointEnd = addDays(pointStart, 6 - ((utcDay + 6) % 7));
    } else {
      const [year, month] = pointStart.split('-').map(Number);
      pointEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    }
    if (pointEnd > endDate) pointEnd = endDate;
    const period = aggregateExerciseReviewPeriod(rows, pointStart, pointEnd);
    points.push({
      startDate: pointStart,
      endDate: pointEnd,
      running: period.running,
      cycling: period.cycling,
      strength: period.strength,
    });
    pointStart = addDays(pointEnd, 1);
  }
  return points;
}

export async function getExerciseReview(
  userId: string,
  startDate: string,
  endDate: string,
  comparison?: { startDate: string; endDate: string }
): Promise<ExerciseReviewResponse> {
  const previousEndDate = comparison?.endDate ?? addDays(startDate, -1);
  const previousStartDate =
    comparison?.startDate ??
    addDays(previousEndDate, -daysBetween(startDate, endDate));
  const latestEndDate = endDate > previousEndDate ? endDate : previousEndDate;
  const today = await resolveTemplateStartDay(userId);
  const client = await getClient(userId);
  try {
    const result = await client.query(
      `SELECT e.id, e.exercise_preset_entry_id,
              e.entry_date::text AS entry_date,
              e.exercise_name, e.category, e.notes,
              COALESCE(p.name, e.exercise_name) AS session_name,
              COALESCE(p.source, e.source) AS session_source,
              e.distance, e.duration_minutes,
              d.provider_name, d.detail_data,
              x.source_id AS exercise_source_id,
              COALESCE(s.lifted_volume_kg, 0) AS lifted_volume_kg,
              COALESCE(s.reps, 0) AS reps
       FROM public.exercise_entries e
       LEFT JOIN public.exercise_preset_entries p
         ON p.id = e.exercise_preset_entry_id AND p.user_id = e.user_id
       LEFT JOIN public.exercises x ON x.id = e.exercise_id
       LEFT JOIN LATERAL (
         SELECT provider_name, detail_data
         FROM public.exercise_entry_activity_details
         WHERE exercise_entry_id = e.id
         ORDER BY CASE WHEN detail_type LIKE '%activity_data%' THEN 0 ELSE 1 END
         LIMIT 1
       ) d ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(GREATEST(weight, 0) * GREATEST(reps, 0)), 0) AS lifted_volume_kg,
                COALESCE(SUM(GREATEST(reps, 0)), 0) AS reps
         FROM public.exercise_entry_sets
         WHERE exercise_entry_id = e.id
           AND (e.workout_plan_origin_assignment_id IS NULL OR completed_at IS NOT NULL)
       ) s ON TRUE
       WHERE e.user_id = $1
         AND (e.entry_date BETWEEN $2 AND $3 OR e.entry_date BETWEEN $4 AND $5)
         AND (
           e.workout_plan_origin_assignment_id IS NULL
           OR EXISTS (
             SELECT 1 FROM public.exercise_entry_sets completed_set
             WHERE completed_set.exercise_entry_id = e.id
               AND completed_set.completed_at IS NOT NULL
           )
         )
         AND e.exercise_name != 'Active Calories'`,
      [userId, previousStartDate, previousEndDate, startDate, endDate]
    );
    const rows = result.rows as ExerciseReviewRow[];
    const versionResult = await client.query(
      `SELECT template_id, effective_from::text AS effective_from,
              start_date::text AS start_date, end_date::text AS end_date,
              is_active, assignments
       FROM public.workout_plan_template_versions
       WHERE user_id = $1 AND effective_from <= $2::date
       ORDER BY template_id, effective_from, id`,
      [userId, latestEndDate]
    );
    const completedResult = await client.query(
      `SELECT DISTINCT e.entry_date::text AS entry_date,
              e.workout_plan_origin_assignment_id AS assignment_id
       FROM public.exercise_entries e
       WHERE e.user_id = $1
         AND e.workout_plan_origin_assignment_id IS NOT NULL
         AND (e.entry_date BETWEEN $2 AND $3 OR e.entry_date BETWEEN $4 AND $5)
         AND EXISTS (
           SELECT 1 FROM public.exercise_entry_sets s
           WHERE s.exercise_entry_id = e.id AND s.completed_at IS NOT NULL
         )`,
      [userId, previousStartDate, previousEndDate, startDate, endDate]
    );
    const versions = versionResult.rows as WorkoutPlanVersionRow[];
    const completed = completedResult.rows as CompletedPlanAssignmentRow[];
    return {
      current: aggregateExerciseReviewPeriod(rows, startDate, endDate),
      previous: aggregateExerciseReviewPeriod(
        rows,
        previousStartDate,
        previousEndDate
      ),
      trend: aggregateExerciseReviewTrend(rows, startDate, endDate),
      sources: sourceSessionsForExerciseReview(rows, startDate, endDate),
      adherence: {
        current: aggregateWorkoutPlanAdherence(
          versions,
          completed,
          startDate,
          endDate,
          today
        ),
        previous: aggregateWorkoutPlanAdherence(
          versions,
          completed,
          previousStartDate,
          previousEndDate,
          today
        ),
      },
    };
  } finally {
    client.release();
  }
}
