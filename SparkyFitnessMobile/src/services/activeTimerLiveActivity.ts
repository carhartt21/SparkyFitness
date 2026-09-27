import type { FastingLog } from '../types/fasting';
import type { NutritionActionIdentity } from './nutritionActionOutbox';

/** Non-iOS builds keep timer and session state without ActivityKit presentation. */
export function initActiveTimerLiveActivities(): void {}
export async function reconcileActiveTimerLiveActivities(
  _identity: NutritionActionIdentity | null,
  _fast: FastingLog | null | undefined
): Promise<void> {}
