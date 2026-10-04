import { expect, test } from 'vitest';
import {
  recordedMobilitySessionsOn,
  type MobilitySession,
} from '@workspace/shared';
const session: MobilitySession = {
  id: 'session',
  routine: {
    id: 'routine',
    name: 'Mobility',
    steps: [],
    cue: 'both',
    reminderTime: null,
    createdAt: '2026-10-04T09:00:00Z',
    updatedAt: '2026-10-04T09:00:00Z',
  },
  state: 'finished',
  phase: 'step',
  stepIndex: 0,
  elapsedSeconds: 0,
  phaseStartedAt: null,
  startedAt: '2026-10-03T22:30:00Z',
  endedAt: '2026-10-03T22:31:00Z',
  outcomes: [
    { stepId: 'step', result: 'completed', recordedAt: '2026-10-03T22:31:00Z' },
  ],
};
test('projects recorded mobility to its account-local start day, including partial completed sessions', () => {
  const partial = { ...session, id: 'partial', state: 'cancelled' as const };
  expect(
    recordedMobilitySessionsOn(
      [session, partial],
      '2026-10-04',
      'Europe/Berlin'
    )
  ).toEqual([partial, session]);
  expect(
    recordedMobilitySessionsOn([session], '2026-10-03', 'Europe/Berlin')
  ).toEqual([]);
  expect(
    recordedMobilitySessionsOn([session], '2026-10-03', 'America/New_York')
  ).toEqual([session]);
});
test('never turns running, paused, all-skipped or unperformed sessions into recorded workouts', () => {
  expect(
    recordedMobilitySessionsOn(
      [
        { ...session, state: 'running' },
        { ...session, state: 'paused' },
        { ...session, outcomes: [] },
        {
          ...session,
          outcomes: [{ ...session.outcomes[0], result: 'skipped' }],
        },
      ],
      '2026-10-04',
      'Europe/Berlin'
    )
  ).toEqual([]);
});
