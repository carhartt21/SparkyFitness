import type { WatchWorkoutHealthEvent } from '../../modules/watch-connectivity';

/** Android has no workout export opt-in. Metro selects .ios.ts on iPhone. */
export interface FinishedWorkoutForHealth {
  sessionId: string;
  startedAt: number | null;
  finishedAt: number;
  completedSetCount: number;
  sourceServerConfigId: string | null;
  /** Explicitly confirmed active energy, never a guessed zero or total expenditure. */
  activeEnergyKcal?: number;
  energySource?: 'known' | 'confirmed-estimate';
  /** Omitted for existing strength workouts; mobility uses HealthKit flexibility. */
  activityKind?: 'mobility';
  sourceUserId?: string;
}

export interface WorkoutHealthRecordingSession {
  sessionId: string | null;
  startedAt: number | null;
  sourceServerConfigId: string | null;
}

export type WorkoutHealthExportResult =
  'saved' | 'watch-pending' | 'watch-unavailable' | 'skipped';

export async function queueCompletedWorkoutExport(
  _workout: FinishedWorkoutForHealth
): Promise<WorkoutHealthExportResult> {
  return 'skipped';
}

export async function needsPhoneWorkoutEnergy(
  _sessionId: string
): Promise<boolean> {
  return false;
}

export async function getWorkoutHealthExportStatus(
  _sessionId: string
): Promise<'saved' | 'pending' | 'skipped' | null> {
  return null;
}

export async function isWorkoutHealthRecordingEnabled(): Promise<boolean> {
  return false;
}

export async function handleWatchWorkoutHealth(
  _event: WatchWorkoutHealthEvent,
  _active: WorkoutHealthRecordingSession
): Promise<void> {}

export async function discardWatchWorkoutRecording(
  _sessionId: string
): Promise<void> {}

export async function retryPendingWorkoutExports(): Promise<void> {}

export function hasWorkoutWritePermission(): boolean {
  return false;
}
