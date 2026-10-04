import type { MobilitySession } from '@workspace/shared';
export function mobilitySession(
  overrides: Partial<MobilitySession> = {}
): MobilitySession {
  const stamp = '2026-10-04T09:00:00Z';
  const stepId = '00000000-0000-4000-8000-000000000002';
  return {
    id: '00000000-0000-4000-8000-000000000003',
    routine: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Morning reach',
      cue: 'both',
      reminderTime: null,
      steps: [
        {
          id: stepId,
          name: 'Reach',
          instructions: '',
          side: 'both',
          kind: 'timed',
          durationSeconds: 30,
          transitionSeconds: 5,
        },
      ],
      createdAt: stamp,
      updatedAt: stamp,
    },
    state: 'finished',
    phase: 'step',
    stepIndex: 0,
    phaseStartedAt: null,
    elapsedSeconds: 0,
    outcomes: [
      { stepId, result: 'completed', recordedAt: '2026-10-04T09:01:00Z' },
    ],
    startedAt: stamp,
    endedAt: '2026-10-04T09:01:00Z',
    ...overrides,
  };
}
