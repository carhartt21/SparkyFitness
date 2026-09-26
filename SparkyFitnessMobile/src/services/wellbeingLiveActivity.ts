import { getActiveNutritionIdentity } from './nutritionIdentity';
import {
  endStoredWellbeingSession,
  getWellbeingSession,
  startStoredMovementBreak,
  type WellbeingSession,
} from './wellbeingSessionStore';

/** Platform-neutral entry point; Metro resolves the iOS ActivityKit sibling. */
export function initWellbeingLiveActivity(): void {}

export async function startMovementBreak(
  durationMinutes: number
): Promise<WellbeingSession> {
  const identity = await getActiveNutritionIdentity();
  if (!identity)
    throw new Error('Sign in once before starting a movement break.');
  return startStoredMovementBreak(identity, durationMinutes);
}

export async function finishMovementBreak(
  expectedSessionId?: string
): Promise<void> {
  const session = await getWellbeingSession();
  if (session && (!expectedSessionId || session.id === expectedSessionId))
    await endStoredWellbeingSession(session.id);
}
