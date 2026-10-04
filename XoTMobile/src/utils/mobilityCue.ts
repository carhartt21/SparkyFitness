import type { MobilitySession } from '@workspace/shared';

export type MobilityCuePosition = { key: string; elapsed: number };

/** Threshold crossings avoid repeated cues, including through pause/resume. */
export function mobilityCueAt(
  session: MobilitySession,
  elapsed: number,
  previous: MobilityCuePosition | null
): { position: MobilityCuePosition; cue: 'halfway' | 'end' | null } {
  const position = {
    key: `${session.id}:${session.phase}:${session.stepIndex}`,
    elapsed,
  };
  const step = session.routine.steps[session.stepIndex];
  if (
    !previous ||
    previous.key !== position.key ||
    session.state !== 'running' ||
    session.phase !== 'step' ||
    step?.kind !== 'timed'
  )
    return { position, cue: null };
  // A restart reduces elapsed time and naturally rearms both thresholds.
  const crossed = (threshold: number) =>
    previous.elapsed < threshold && elapsed >= threshold;
  const cue = crossed(step.durationSeconds)
    ? 'end'
    : step.side === 'both' && crossed(step.durationSeconds / 2)
      ? 'halfway'
      : null;
  return { position, cue };
}
