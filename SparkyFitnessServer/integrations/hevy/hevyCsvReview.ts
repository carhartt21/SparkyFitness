import { instantToDay } from '@workspace/shared';
import { getClient } from '../../db/poolManager.js';
import type { HevyWorkout } from './hevyDataProcessor.js';

interface SessionCandidate {
  id: string;
  name: string;
  entry_date: string;
  source: string | null;
  source_id: string | null;
}

interface HevyCsvExerciseMapping {
  title: string;
  status: 'existing-name' | 'will-create';
}

interface HevyCsvPotentialDuplicate {
  workoutIndex: number;
  existingSessionId: string;
  existingSource: string | null;
  entryDate: string;
}

interface HevyCsvReview {
  exerciseMappings: HevyCsvExerciseMapping[];
  potentialDuplicateSessions: HevyCsvPotentialDuplicate[];
}

/** Name matches mirror the importer's exact-name lookup; date/title overlap is a warning, never an automatic merge. */
export function buildHevyCsvReview(
  workouts: readonly HevyWorkout[],
  timezone: string,
  existingExerciseNames: readonly string[],
  sessions: readonly SessionCandidate[]
): HevyCsvReview {
  const titles = [
    ...new Set(
      workouts.flatMap((workout) =>
        (workout.exercises ?? []).map((exercise) => exercise.title)
      )
    ),
  ];
  const existingNames = new Set(existingExerciseNames);
  const exerciseMappings = titles.map((title) => ({
    title,
    status: existingNames.has(title)
      ? ('existing-name' as const)
      : ('will-create' as const),
  }));
  const byDateAndTitle = new Map<string, SessionCandidate[]>();
  for (const session of sessions) {
    const key = JSON.stringify([session.entry_date, session.name]);
    const matches = byDateAndTitle.get(key) ?? [];
    matches.push(session);
    byDateAndTitle.set(key, matches);
  }
  const potentialDuplicateSessions: HevyCsvPotentialDuplicate[] = [];
  workouts.forEach((workout, workoutIndex) => {
    const entryDate = instantToDay(new Date(workout.start_time), timezone);
    const key = JSON.stringify([entryDate, workout.title]);
    for (const session of byDateAndTitle.get(key) ?? []) {
      if (session.source === 'Hevy' && session.source_id === workout.id)
        continue;
      potentialDuplicateSessions.push({
        workoutIndex,
        existingSessionId: session.id,
        existingSource: session.source,
        entryDate,
      });
    }
  });
  return { exerciseMappings, potentialDuplicateSessions };
}

/** Read-only review of exercise names and same-day session titles visible to this user. */
export async function getHevyCsvReview(
  userId: string,
  workouts: readonly HevyWorkout[],
  timezone: string
): Promise<HevyCsvReview> {
  if (workouts.length === 0) {
    return { exerciseMappings: [], potentialDuplicateSessions: [] };
  }
  const exerciseTitles = [
    ...new Set(
      workouts.flatMap((workout) =>
        (workout.exercises ?? []).map((exercise) => exercise.title)
      )
    ),
  ];
  const workoutTitles = [...new Set(workouts.map((workout) => workout.title))];
  const dates = workouts
    .map((workout) => instantToDay(new Date(workout.start_time), timezone))
    .sort();
  const client = await getClient(userId);
  try {
    const exerciseResult = await client.query(
      `SELECT DISTINCT name FROM public.exercises
         WHERE name = ANY($1::text[]) AND (user_id = $2 OR shared_with_public = TRUE)`,
      [exerciseTitles, userId]
    );
    const sessionResult = await client.query(
      `SELECT id, name, entry_date::text AS entry_date, source, source_id
         FROM public.exercise_preset_entries
         WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3
           AND name = ANY($4::text[])`,
      [userId, dates[0], dates[dates.length - 1], workoutTitles]
    );
    return buildHevyCsvReview(
      workouts,
      timezone,
      (exerciseResult.rows as Array<{ name: string }>).map((row) => row.name),
      sessionResult.rows as SessionCandidate[]
    );
  } finally {
    client.release();
  }
}
