import exerciseEntryRepository from '../../models/exerciseEntry.js';
import exerciseRepository from '../../models/exercise.js';
import measurementRepository from '../../models/measurementRepository.js';
import activityDetailsRepository from '../../models/activityDetailsRepository.js';
import workoutPresetRepository from '../../models/workoutPresetRepository.js';
import exercisePresetEntryRepository from '../../models/exercisePresetEntryRepository.js';
import { log } from '../../config/logging.js';
import { parseHevyInstant } from './hevyTimestamp.js';
import {
  todayInZone,
  instantToDay,
  instantHourMinute,
  isDayString,
} from '@workspace/shared';

/** A single set within a Hevy exercise. */
interface HevySet {
  index: number;
  type: string;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  custom_metric?: number | null;
  rep_range?: { start?: number | null; end?: number | null } | null;
}

/** One exercise within a Hevy workout. */
interface HevyExercise {
  index: number;
  title: string;
  notes?: string | null;
  exercise_template_id?: string | null;
  superset_id?: string | number | null;
  sets?: HevySet[] | null;
  rest_seconds?: number | string | null;
}

/** A saved Hevy routine, independent of any completed workout. */
export interface HevyRoutine {
  id: string;
  title: string;
  exercises?: HevyExercise[] | null;
}

/** A logged Hevy workout (one session). */
export interface HevyWorkout {
  id: string;
  title: string;
  routine_id?: string | null;
  description?: string | null;
  start_time: string;
  end_time: string;
  updated_at?: string | null;
  created_at?: string | null;
  exercises?: HevyExercise[] | null;
}

/** The Hevy user-info payload we read body metrics from. */
interface HevyUserInfoResponse {
  user?: {
    weight_kg?: number | null;
    height_cm?: number | null;
    updated_at?: string | null;
  } | null;
}

/** Minimal shapes for the repository rows we consume by id. */
interface ExerciseRow {
  id: string;
}
interface PresetEntryRow {
  id: string;
}
interface ExerciseEntryRow {
  id: string;
}

export interface HevyWorkoutImportResult {
  imported: number;
  skipped: number;
  failed: Array<{ id: string; message: string }>;
}

export type HevyRoutineImportResult = HevyWorkoutImportResult;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function restSecondsForExercise(value: number | string | null | undefined) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return null;
  }
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * Process Hevy user info to sync measurements.
 */
async function processHevyUserInfo(
  userId: string,
  createdByUserId: string,
  data: HevyUserInfoResponse | null | undefined,
  timezone = 'UTC'
) {
  if (!data || !data.user) return;
  const { weight_kg, height_cm, updated_at } = data.user;
  const measurements: { weight?: number; height?: number } = {};
  if (weight_kg) measurements.weight = weight_kg;
  if (height_cm) measurements.height = height_cm;
  if (Object.keys(measurements).length === 0) return;
  try {
    // A date-only value already names the intended day. A timestamp names an
    // instant and must be placed on the user's local day, not its UTC prefix.
    let entryDate = todayInZone(timezone);
    if (updated_at) {
      if (isDayString(updated_at)) {
        entryDate = updated_at;
      } else {
        const instant = parseHevyInstant(updated_at, 'measurement timestamp');
        entryDate = instantToDay(instant, timezone);
      }
    }
    await measurementRepository.upsertCheckInMeasurements(
      userId,
      createdByUserId,
      entryDate,
      measurements
    );
    log(
      'info',
      `Synced Hevy user measurements for user ${userId}: ${JSON.stringify(measurements)}`
    );
  } catch (error) {
    log(
      'error',
      `Failed to sync Hevy user measurements for user ${userId}: ${errorMessage(error)}`
    );
    throw error;
  }
}

/**
 * Process a list of workouts from Hevy.
 */
async function processHevyWorkouts(
  userId: string,
  createdByUserId: string,
  workouts: HevyWorkout[],
  timezone = 'UTC'
): Promise<HevyWorkoutImportResult> {
  const result: HevyWorkoutImportResult = {
    imported: 0,
    skipped: 0,
    failed: [],
  };
  log(
    'info',
    `Processing ${workouts.length} Hevy workouts for user ${userId}...`
  );
  // A provider re-sync must never delete or update a locally edited session.
  // Match existing exercises by stable source id. Legacy sessions without a
  // usable child id are conservatively matched by title and local day below.
  const sourceIds = workouts.flatMap((workout) =>
    (workout.exercises ?? []).map(
      (exercise) => `${workout.id}_${exercise.index}`
    )
  );
  const existingSourceIds = new Set(
    await exerciseEntryRepository.getExistingExerciseSourceIds(
      userId,
      'Hevy',
      sourceIds
    )
  );
  // The raw bundle can hold the same workout under overlapping page keys
  // (e.g. `raw_workouts_page` and `raw_workouts_page_1`), and paginated API
  // fetches can overlap too. Process each workout id only once — otherwise a
  // second pass creates a duplicate preset-entry session whose exercises stay
  // deduped on the first one, leaving an empty orphan session.
  const seenWorkoutIds = new Set<string>();
  for (const workout of workouts) {
    if (!workout.id) {
      log('warn', 'Skipping Hevy workout without a stable id');
      result.skipped++;
      continue;
    }
    if (seenWorkoutIds.has(workout.id)) {
      log('debug', `Skipping duplicate Hevy workout ${workout.id}`);
      result.skipped++;
      continue;
    }
    seenWorkoutIds.add(workout.id);
    try {
      const hasImportedExercise = (workout.exercises ?? []).some((exercise) =>
        existingSourceIds.has(`${workout.id}_${exercise.index}`)
      );
      if (hasImportedExercise) {
        log('debug', `Preserving existing Hevy workout ${workout.id}`);
        result.skipped++;
        continue;
      }
      const startTime = parseHevyInstant(
        workout.start_time,
        'workout start time'
      );
      const entryDate = instantToDay(startTime, timezone);
      const sameDaySessions =
        await exercisePresetEntryRepository.getExercisePresetEntriesByDate(
          userId,
          entryDate
        );
      if (
        sameDaySessions.some(
          (session: {
            source: string;
            source_id?: string | null;
            name: string;
          }) =>
            session.source === 'Hevy' &&
            (session.source_id === workout.id ||
              (!session.source_id && session.name === workout.title))
        )
      ) {
        log(
          'warn',
          `Skipping ambiguous Hevy workout ${workout.id}: a session with this title already exists on ${entryDate}`
        );
        result.skipped++;
        continue;
      }
      await processSingleWorkout(
        userId,
        createdByUserId,
        workout,
        timezone,
        startTime
      );
      result.imported++;
    } catch (error) {
      result.failed.push({ id: workout.id, message: errorMessage(error) });
      log(
        'error',
        `Failed to process Hevy workout ${workout.id}: ${errorMessage(error)}`
      );
    }
  }
  return result;
}

/**
 * Process a single workout from Hevy.
 */
async function processSingleWorkout(
  userId: string,
  createdByUserId: string,
  workout: HevyWorkout,
  timezone: string,
  startTime: Date
) {
  const endTime = parseHevyInstant(workout.end_time, 'workout end time');
  const workoutDurationMinutes = Math.round(
    (endTime.getTime() - startTime.getTime()) / (1000 * 60)
  );
  // Wall-clock start time of the workout, in the user's timezone, as an
  // 'HH:MM' string for the exercise_entries.entry_time (TIME) column.
  const { hour, minute } = instantHourMinute(startTime, timezone);
  const entryTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const entryDate = instantToDay(startTime, timezone);
  log(
    'debug',
    `Processing Hevy workout: ${workout.title} (${startTime.toISOString()})`
  );
  // A completed workout is history, even when it has a routine_id. Only the
  // separate /v1/routines endpoint proves that a routine is saved. The
  // session group has a nullable preset FK and can stand alone.
  const presetEntry: PresetEntryRow =
    await exercisePresetEntryRepository.createExercisePresetEntry(
      userId,
      {
        user_id: userId,
        workout_preset_id: null,
        name: workout.title,
        description:
          workout.description || `Logged session of ${workout.title}`,
        entry_date: entryDate,
        created_by_user_id: createdByUserId,
        notes: `Hevy Workout Session: ${workout.title}`,
        source: 'Hevy',
        source_id: workout.id,
      },
      createdByUserId
    );

  try {
    // Hevy identifies supersets by an opaque id; the DB stores superset_group as a
    // per-workout integer. Assign each distinct Hevy superset id a stable number
    // within this workout so grouped exercises share a value.
    const supersetGroupByHevyId = new Map<string, number>();
    const exercises = workout.exercises ?? [];
    const timedMinutes = exercises.map((exercise) =>
      Math.round(
        (exercise.sets ?? []).reduce(
          (sum, set) => sum + (set.duration_seconds || 0),
          0
        ) / 60
      )
    );
    const durationAnchorIndex = Math.max(
      0,
      exercises.findIndex((_, index) => timedMinutes[index] === 0)
    );
    const otherTimedMinutes = timedMinutes.reduce(
      (sum, minutes, index) =>
        sum + (index === durationAnchorIndex ? 0 : minutes),
      0
    );
    for (
      let exerciseIndex = 0;
      exerciseIndex < exercises.length;
      exerciseIndex++
    ) {
      const hevyExercise = exercises[exerciseIndex]!;
      // 1. Find or create exercise template
      let exercise: ExerciseRow | null =
        await exerciseRepository.findExerciseByNameAndUserId(
          hevyExercise.title,
          userId
        );
      if (!exercise) {
        exercise = await exerciseRepository.createExercise(
          {
            user_id: userId,
            name: hevyExercise.title,
            source: 'Hevy',
            is_custom: true,
            shared_with_public: false,
          },
          // @ts-expect-error TS(2554): repository accepts createdByUserId at runtime
          createdByUserId
        );
      }
      if (!exercise) {
        throw new Error(
          `Failed to find or create Hevy exercise "${hevyExercise.title}"`
        );
      }
      const sets = hevyExercise.sets ?? [];
      // Preserve explicit timed-set minutes while attributing the remaining
      // workout time (including rests) to one untimed exercise. Otherwise
      // timed exercises add minutes on top of the entire workout duration.
      const durationMinutes =
        exerciseIndex === durationAnchorIndex
          ? Math.max(0, workoutDurationMinutes - otherTimedMinutes)
          : timedMinutes[exerciseIndex] || 0;
      // Sum any per-set distances Hevy reports. The Hevy API reports metres
      // (`distance_meters`) regardless of the user's display units, while
      // exercise_entries.distance is kilometres like every other integration
      // writes it, so this must be converted rather than stored raw.
      const distanceMeters = sets.reduce(
        (sum, set) => sum + (set.distance_meters || 0),
        0
      );
      const distanceKm =
        distanceMeters > 0
          ? parseFloat((distanceMeters / 1000).toFixed(3))
          : null;
      // Map the Hevy superset id to a numeric per-workout group.
      let supersetGroup: number | null = null;
      if (
        hevyExercise.superset_id !== null &&
        hevyExercise.superset_id !== undefined
      ) {
        const key = String(hevyExercise.superset_id);
        if (!supersetGroupByHevyId.has(key)) {
          supersetGroupByHevyId.set(key, supersetGroupByHevyId.size + 1);
        }
        supersetGroup = supersetGroupByHevyId.get(key)!;
      }
      // Stable per-exercise identity so re-syncs update in place instead of
      // duplicating. Hevy workout ids are unique; exercise index is unique
      // within a workout.
      const sourceId = `${workout.id}_${hevyExercise.index}`;
      const restSeconds = restSecondsForExercise(hevyExercise.rest_seconds);
      // 2. Prepare entry data
      const entryData = {
        exercise_id: exercise.id,
        entry_date: entryDate,
        entry_time: entryTime,
        duration_minutes: durationMinutes,
        calories_burned: 0, // Hevy typically doesn't provide per-exercise calories
        distance: distanceKm,
        superset_group: supersetGroup,
        source_id: sourceId,
        exercise_preset_entry_id: presetEntry.id,
        notes:
          hevyExercise.notes ||
          workout.description ||
          `Synced from Hevy: ${workout.title}`,
        entry_source: 'Hevy',
        sort_order: hevyExercise.index,
        sets: sets.map((set) => ({
          set_number: set.index + 1,
          set_type: mapSetType(set.type),
          weight: set.weight_kg,
          reps: set.reps,
          duration: set.duration_seconds
            ? Math.round(set.duration_seconds)
            : null,
          distance:
            set.distance_meters === null || set.distance_meters === undefined
              ? null
              : set.distance_meters / 1000,
          rest_time: restSeconds,
          rpe: set.rpe,
        })),
      };
      // 3. Create the exercise entry, linked to the session (preset entry) via
      // the 5th argument so it groups under the workout instead of standing alone.
      const entry: ExerciseEntryRow | null =
        await exerciseEntryRepository.createExerciseEntry(
          userId,
          entryData,
          createdByUserId,
          'Hevy',
          presetEntry.id
        );
      if (!entry?.id) {
        throw new Error(
          `Failed to create Hevy exercise "${hevyExercise.title}"`
        );
      }
      // 4. Stash the full raw Hevy payload as an activity detail (like Garmin),
      // so nothing Hevy sends is lost and it stays visible/editable in the
      // Advanced section of the exercise entry.
      await activityDetailsRepository.createActivityDetail(userId, {
        exercise_entry_id: entry.id,
        provider_name: 'Hevy',
        detail_type: 'full_activity_data',
        detail_data: {
          workout: {
            id: workout.id,
            title: workout.title,
            description: workout.description,
            routine_id: workout.routine_id,
            start_time: workout.start_time,
            end_time: workout.end_time,
          },
          exercise: hevyExercise,
        },
        created_by_user_id: createdByUserId,
        updated_by_user_id: createdByUserId,
      });
    }
  } catch (error) {
    // This session was created only by this attempt. Deleting it cascades to
    // the exercise entries and set/detail rows, so a retry starts cleanly.
    try {
      await exercisePresetEntryRepository.deleteExercisePresetEntry(
        presetEntry.id,
        userId
      );
    } catch (cleanupError) {
      log(
        'error',
        `Failed to clean up partial Hevy workout ${workout.id}: ${errorMessage(cleanupError)}`
      );
      throw new Error(
        `Workout import failed (${errorMessage(error)}) and partial-session cleanup failed (${errorMessage(cleanupError)}). Manual review is required before retrying.`,
        { cause: cleanupError }
      );
    }
    throw error;
  }
}

/** Import saved routines once by Hevy ID; later syncs preserve local edits. */
async function processHevyRoutines(
  userId: string,
  createdByUserId: string,
  routines: HevyRoutine[]
): Promise<HevyRoutineImportResult> {
  const result: HevyRoutineImportResult = {
    imported: 0,
    skipped: 0,
    failed: [],
  };
  const seen = new Set<string>();
  for (const routine of routines) {
    if (!routine.id || seen.has(routine.id)) {
      result.skipped++;
      continue;
    }
    seen.add(routine.id);
    try {
      if (
        await workoutPresetRepository.getWorkoutPresetBySource(
          userId,
          'Hevy',
          routine.id
        )
      ) {
        result.skipped++;
        continue;
      }
      const supersetGroups = new Map<string, number>();
      const exercises = [];
      for (const item of routine.exercises ?? []) {
        let exercise: ExerciseRow | null =
          await exerciseRepository.findExerciseByNameAndUserId(
            item.title,
            userId
          );
        if (!exercise) {
          exercise = await exerciseRepository.createExercise(
            {
              user_id: userId,
              name: item.title,
              source: 'Hevy',
              is_custom: true,
              shared_with_public: false,
            },
            // @ts-expect-error TS(2554): repository accepts createdByUserId at runtime
            createdByUserId
          );
        }
        if (!exercise) throw new Error(`Cannot import exercise ${item.title}`);
        let supersetGroup: number | null = null;
        if (item.superset_id !== null && item.superset_id !== undefined) {
          const key = String(item.superset_id);
          if (!supersetGroups.has(key)) {
            supersetGroups.set(key, supersetGroups.size + 1);
          }
          supersetGroup = supersetGroups.get(key)!;
        }
        const restSeconds = restSecondsForExercise(item.rest_seconds);
        exercises.push({
          exercise_id: exercise.id,
          sort_order: item.index,
          superset_group: supersetGroup,
          notes: item.notes ?? null,
          sets: (item.sets ?? []).map((set) => ({
            set_number: set.index + 1,
            set_type: mapSetType(set.type),
            weight: set.weight_kg,
            reps: set.reps ?? set.rep_range?.start ?? null,
            duration: set.duration_seconds,
            distance:
              set.distance_meters === null || set.distance_meters === undefined
                ? null
                : set.distance_meters / 1000,
            rest_time: restSeconds,
            notes:
              set.rep_range?.end !== null && set.rep_range?.end !== undefined
                ? `Hevy rep range: ${set.rep_range?.start ?? '?'}–${set.rep_range.end}`
                : null,
          })),
        });
      }
      await workoutPresetRepository.createWorkoutPreset({
        user_id: userId,
        name: routine.title,
        description: 'Saved routine imported from Hevy',
        is_public: false,
        source: 'Hevy',
        source_id: routine.id,
        exercises,
      });
      result.imported++;
    } catch (error) {
      result.failed.push({ id: routine.id, message: errorMessage(error) });
      log(
        'error',
        `Failed to import Hevy routine ${routine.id}: ${errorMessage(error)}`
      );
    }
  }
  return result;
}

/**
 * Map Hevy set types to Sparky Fitness set types.
 */
function mapSetType(hevyType: string): string {
  switch (hevyType) {
    case 'normal':
      return 'Working Set';
    case 'warmup':
      return 'Warm-up';
    case 'dropset':
      return 'Drop Set';
    case 'failure':
      return 'To Failure';
    default:
      throw new Error(`Unsupported Hevy set type: ${hevyType}`);
  }
}
export { processHevyUserInfo };
export { processHevyWorkouts };
export { processHevyRoutines };
export default {
  processHevyUserInfo,
  processHevyWorkouts,
  processHevyRoutines,
};
