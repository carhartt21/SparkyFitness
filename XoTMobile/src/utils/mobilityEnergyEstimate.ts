import {
  isRecordedMobilitySession,
  type MobilitySession,
} from '@workspace/shared';

export interface MobilityEnergyEstimate {
  activeKcal: number;
  weightKg: number;
  timedSeconds: number;
}

/**
 * User-confirmed approximation, not telemetry. Adult Compendium (2024),
 * conditioning 02101: mild stretching = 2.3 MET. Subtract 1 MET resting energy.
 * https://pacompendium.com/conditioning-exercise/
 * Use only confirmed timed steps, capped by their available wall-clock interval
 * and prescribed duration. No guessed cadence for reps or energy for transitions.
 * Historical sessions have no per-step pause telemetry, so time is approximate.
 */
export function estimateMobilityActiveEnergy(
  session: MobilitySession,
  weightKg: number | null | undefined
): MobilityEnergyEstimate | undefined {
  if (
    !isRecordedMobilitySession(session) ||
    !session.endedAt ||
    weightKg == null ||
    !Number.isFinite(weightKg) ||
    weightKg <= 0
  )
    return undefined;
  let previousAt = Date.parse(session.startedAt);
  const endedAt = Date.parse(session.endedAt);
  let timedSeconds = 0;
  for (const outcome of session.outcomes) {
    const index = session.routine.steps.findIndex(
      (step) => step.id === outcome.stepId
    );
    const step = session.routine.steps[index];
    const recordedAt = Math.min(Date.parse(outcome.recordedAt), endedAt);
    const previousStep =
      index > 0 ? session.routine.steps[index - 1] : undefined;
    const transition = previousStep
      ? Math.max(5, previousStep.transitionSeconds)
      : 0;
    if (outcome.result === 'completed' && step?.kind === 'timed')
      timedSeconds += Math.min(
        step.durationSeconds,
        Math.max(0, (recordedAt - previousAt) / 1000 - transition)
      );
    previousAt = recordedAt;
  }
  if (!Number.isFinite(timedSeconds) || timedSeconds <= 0) return undefined;
  // Round to whole kcal; a result rounded to zero leaves no suggestion.
  const activeKcal = Math.round(
    ((((2.3 - 1) * 3.5 * weightKg) / 200) * timedSeconds) / 60
  );
  return activeKcal > 0 ? { activeKcal, weightKg, timedSeconds } : undefined;
}
