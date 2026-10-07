import type { ExerciseSessionResponse } from '@workspace/shared';
import { importedWorkoutClock } from '@workspace/shared';
import type { TFunction } from 'i18next';

const IMPORTED_ACTIVITIES: Record<string, string> = {
  walking: 'walking',
  running: 'running',
  cycling: 'cycling',
  soccer: 'soccer',
  swimming: 'swimming',
  hiking: 'hiking',
  yoga: 'yoga',
  pilates: 'pilates',
  'traditional strength training': 'strength',
  'functional strength training': 'strength',
  'strength training': 'strength',
  rowing: 'rowing',
  flexibility: 'mobility',
};
/** Imported type labels are UI vocabulary; authored names stay literal. */
export function workoutDisplayName(
  session: ExerciseSessionResponse,
  name: string,
  t: TFunction
): string {
  if (
    session.type !== 'individual' ||
    !session.source ||
    session.source.toLowerCase() === 'manual'
  )
    return name;
  const activity = IMPORTED_ACTIVITIES[name.toLowerCase()];
  const sourceType = /Activity Type: (.+)$/.exec(session.notes ?? '')?.[1];
  if (!activity || sourceType !== name) return name;
  switch (activity) {
    case 'walking':
      return t('dailyTraining.types.walking', { defaultValue: 'Walking' });
    case 'running':
      return t('dailyTraining.types.running', { defaultValue: 'Running' });
    case 'cycling':
      return t('dailyTraining.types.cycling', { defaultValue: 'Cycling' });
    case 'soccer':
      return t('dailyTraining.types.soccer', { defaultValue: 'Soccer' });
    case 'swimming':
      return t('dailyTraining.types.swimming', { defaultValue: 'Swimming' });
    case 'hiking':
      return t('dailyTraining.types.hiking', { defaultValue: 'Hiking' });
    case 'yoga':
      return t('dailyTraining.types.yoga', { defaultValue: 'Yoga' });
    case 'pilates':
      return t('dailyTraining.types.pilates', { defaultValue: 'Pilates' });
    case 'strength':
      return t('dailyTraining.types.strength', {
        defaultValue: 'Strength training',
      });
    case 'rowing':
      return t('dailyTraining.types.rowing', { defaultValue: 'Rowing' });
    case 'mobility':
      return t('dailyTraining.types.mobility', { defaultValue: 'Mobility' });
    default:
      return name;
  }
}

export function isDailyEnergyAggregate(
  session: ExerciseSessionResponse
): boolean {
  if (session.type !== 'individual') return false;
  if (/^Active calories logged from /.test(session.notes ?? '')) return true;
  return (
    session.duration_minutes === 0 &&
    !!session.source &&
    session.source !== 'manual' &&
    /^(ActiveCalories|Active Calories|ActiveCaloriesBurned)$/i.test(
      session.name ?? session.exercise_snapshot?.name ?? ''
    )
  );
}

function sourceClock(
  details: ExerciseSessionResponse['activity_details'],
  timezone: string
): string | null {
  for (const detail of details ?? []) {
    if (!detail.detail_type.endsWith('_raw_data')) continue;
    let raw: unknown = detail.detail_data;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    if (!raw || typeof raw !== 'object') continue;
    const clock = importedWorkoutClock(
      raw as Record<string, unknown>,
      timezone
    );
    if (clock) return clock;
  }
  return null;
}

export function workoutRecordedTime(
  session: ExerciseSessionResponse,
  timezone: string
): string | null {
  const times =
    session.type === 'individual'
      ? [session.entry_time]
      : session.exercises.map((exercise) => exercise.entry_time);
  return (
    times
      .filter(
        (value): value is string =>
          typeof value === 'string' &&
          /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)
      )
      .sort()[0]
      ?.slice(0, 5) ?? sourceClock(session.activity_details, timezone)
  );
}
