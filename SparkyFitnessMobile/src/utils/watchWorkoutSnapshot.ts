import type { WatchWorkoutPayload } from '../../modules/watch-connectivity';
import type { ActiveWorkoutState } from '../stores/activeWorkoutStore';
import { watchSetSignature } from './watchSetIdentity';

/** Build the latest-value Watch mirror from the phone's authoritative store. */
export function buildWatchWorkoutSnapshot(
  state: ActiveWorkoutState
): WatchWorkoutPayload | null {
  if (!state.sessionId || !state.session) return null;

  return {
    sessionId: state.sessionId,
    name: state.session.name,
    activeSetId: state.activeSetId,
    restEndsAt: state.rest.state === 'resting' ? state.rest.endsAt : null,
    exercises: state.session.exercises.map((exercise) => ({
      id: exercise.id,
      name:
        exercise.exercise_snapshot?.name ?? exercise.exercise_id ?? exercise.id,
      sets: exercise.sets.map((set) => ({
        id: String(set.id),
        key: state.setRenderKeys[String(set.id)] ?? String(set.id),
        signature: watchSetSignature(set),
        number: set.set_number,
        type: set.set_type ?? null,
        weightKg: set.weight ?? null,
        reps: set.reps ?? null,
        durationSeconds: set.duration ?? null,
        completed: state.completedSetIds[String(set.id)] != null,
      })),
    })),
  };
}
