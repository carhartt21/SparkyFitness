/** Android has no workout export opt-in. Metro selects .ios.ts on iPhone. */
export interface FinishedWorkoutForHealth {
  sessionId: string;
  startedAt: number | null;
  finishedAt: number;
  completedSetCount: number;
  sourceServerConfigId: string | null;
}

export async function queueCompletedWorkoutExport(
  _workout: FinishedWorkoutForHealth
): Promise<void> {}

export async function retryPendingWorkoutExports(): Promise<void> {}

export function hasWorkoutWritePermission(): boolean {
  return false;
}
