import { mobilityCueAt } from '../../src/utils/mobilityCue';
import type { MobilitySession } from '@workspace/shared';

const session: MobilitySession = {
  id: '00000000-0000-4000-8000-000000000003',
  routine: {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Mobility',
    cue: 'both',
    reminderTime: null,
    steps: [
      {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Reach',
        instructions: '',
        side: 'both',
        kind: 'timed',
        durationSeconds: 31,
        transitionSeconds: 5,
      },
    ],
    createdAt: '2026-10-04T09:00:00Z',
    updatedAt: '2026-10-04T09:00:00Z',
  },
  state: 'running',
  phase: 'step',
  stepIndex: 0,
  elapsedSeconds: 0,
  phaseStartedAt: '2026-10-04T09:00:00Z',
  outcomes: [],
  startedAt: '2026-10-04T09:00:00Z',
  endedAt: null,
};

test('cues at actual halfway for odd durations and only once at each threshold', () => {
  let event = mobilityCueAt(session, 15, null);
  event = mobilityCueAt(session, 15.5, event.position);
  expect(event.cue).toBe('halfway');
  event = mobilityCueAt(session, 16, event.position);
  expect(event.cue).toBeNull();
  event = mobilityCueAt(session, 31, event.position);
  expect(event.cue).toBe('end');
  expect(mobilityCueAt(session, 40, event.position).cue).toBeNull();
});

test('preserves cue progress through pause/resume and rearms after restarting', () => {
  let event = mobilityCueAt(session, 10, null);
  event = mobilityCueAt({ ...session, state: 'paused' }, 10, event.position);
  expect(event.cue).toBeNull();
  event = mobilityCueAt(session, 16, event.position);
  expect(event.cue).toBe('halfway');
  event = mobilityCueAt({ ...session, state: 'paused' }, 16, event.position);
  event = mobilityCueAt(session, 16, event.position);
  expect(event.cue).toBeNull();
  event = mobilityCueAt(session, 0, event.position);
  expect(mobilityCueAt(session, 16, event.position).cue).toBe('halfway');
});

test('does not cue unilateral, repetition or transition halves or replay on remount', () => {
  const position = mobilityCueAt(session, 10, null).position;
  for (const side of ['left', 'right'] as const) {
    expect(
      mobilityCueAt(
        {
          ...session,
          routine: {
            ...session.routine,
            steps: [{ ...session.routine.steps[0], side }],
          },
        },
        16,
        position
      ).cue
    ).toBeNull();
  }
  expect(
    mobilityCueAt({ ...session, phase: 'transition' }, 16, position).cue
  ).toBeNull();
  expect(mobilityCueAt(session, 17, null).cue).toBeNull();
  expect(
    mobilityCueAt(
      {
        ...session,
        routine: {
          ...session.routine,
          steps: [
            {
              id: session.routine.steps[0].id,
              name: 'Reach',
              instructions: '',
              side: 'both',
              kind: 'repetitions',
              repetitions: 10,
              transitionSeconds: 5,
            },
          ],
        },
      },
      16,
      position
    ).cue
  ).toBeNull();
});

test('a delayed update beyond both thresholds produces one end cue', () => {
  expect(
    mobilityCueAt(session, 40, mobilityCueAt(session, 1, null).position).cue
  ).toBe('end');
});
