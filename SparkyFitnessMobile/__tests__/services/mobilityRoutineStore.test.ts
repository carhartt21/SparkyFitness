import AsyncStorage from '@react-native-async-storage/async-storage';

let mockNextId = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => {
    mockNextId += 1;
    return `00000000-0000-4000-8000-${String(mockNextId).padStart(12, '0')}`;
  },
}));

import {
  applyMobilitySessionAction,
  deleteMobilitySessionHistory,
  deleteMobilityRoutine,
  getMobilityState,
  mobilitySecondsRemaining,
  saveMobilityRoutine,
  startMobilitySession,
} from '../../src/services/mobilityRoutineStore';

const alice = { serverConfigId: 'server-A', userId: 'alice' };
const bob = { serverConfigId: 'server-A', userId: 'bob' };
const at = (seconds: number) =>
  new Date(Date.parse('2026-09-25T09:00:00.000Z') + seconds * 1000);

beforeEach(async () => {
  mockNextId = 0;
  await AsyncStorage.clear();
});

it('records only explicit step outcomes through pause, restart, and transition', async () => {
  const routine = await saveMobilityRoutine(
    alice,
    {
      name: 'Morning mobility',
      cue: 'haptic',
      steps: [
        {
          name: 'Shoulder circles',
          instructions: 'Move comfortably',
          side: 'both',
          kind: 'timed',
          durationSeconds: 30,
          transitionSeconds: 10,
        },
        {
          name: 'Side reach',
          instructions: '',
          side: 'left',
          kind: 'repetitions',
          repetitions: 8,
          transitionSeconds: 0,
        },
      ],
    },
    at(0)
  );
  const started = await startMobilitySession(alice, routine.id, at(1));
  expect(mobilitySecondsRemaining(started, at(40))).toBe(0);
  expect((await getMobilityState(alice)).activeSession?.outcomes).toEqual([]);

  const paused = await applyMobilitySessionAction(
    alice,
    started.id,
    'pause',
    at(11)
  );
  expect(mobilitySecondsRemaining(paused, at(100))).toBe(20);
  const resumed = await applyMobilitySessionAction(
    alice,
    started.id,
    'resume',
    at(100)
  );
  expect(mobilitySecondsRemaining(resumed, at(105))).toBe(15);

  const firstDone = await applyMobilitySessionAction(
    alice,
    started.id,
    'complete-step',
    at(120)
  );
  expect(firstDone.phase).toBe('transition');
  expect(firstDone.outcomes).toMatchObject([
    { stepId: routine.steps[0].id, result: 'completed' },
  ]);
  expect(mobilitySecondsRemaining(firstDone, at(125))).toBe(5);
  expect(mobilitySecondsRemaining(firstDone, at(200))).toBe(0);
  expect((await getMobilityState(alice)).activeSession?.phase).toBe(
    'transition'
  );
  await expect(
    applyMobilitySessionAction(alice, started.id, 'complete-step', at(201))
  ).rejects.toThrow('Continue the transition first');

  await applyMobilitySessionAction(alice, started.id, 'continue', at(202));
  const finished = await applyMobilitySessionAction(
    alice,
    started.id,
    'skip-step',
    at(203)
  );
  expect(finished.state).toBe('finished');
  expect(finished.outcomes.map((outcome) => outcome.result)).toEqual([
    'completed',
    'skipped',
  ]);
  const stored = await getMobilityState(alice);
  expect(stored.activeSession).toBeNull();
  expect(stored.history[0]).toEqual(finished);
});

it('keeps account data isolated and uses a routine snapshot during edits', async () => {
  const routine = await saveMobilityRoutine(alice, {
    name: 'First version',
    cue: 'off',
    steps: [
      {
        name: 'Reach',
        instructions: '',
        side: 'right',
        kind: 'timed',
        durationSeconds: 15,
        transitionSeconds: 0,
      },
    ],
  });
  const session = await startMobilitySession(alice, routine.id, at(0));
  expect(await startMobilitySession(alice, routine.id, at(1))).toEqual(session);
  await saveMobilityRoutine(alice, {
    id: routine.id,
    name: 'Edited version',
    cue: 'both',
    steps: [
      {
        ...routine.steps[0],
        name: 'Changed reach',
      },
    ],
  });
  await deleteMobilityRoutine(alice, routine.id);
  expect((await getMobilityState(alice)).activeSession?.routine.name).toBe(
    'First version'
  );
  expect((await getMobilityState(bob)).routines).toEqual([]);
  expect((await getMobilityState(bob)).activeSession).toBeNull();
  await applyMobilitySessionAction(alice, session.id, 'cancel', at(2));
  expect((await getMobilityState(alice)).history[0]?.state).toBe('cancelled');
  expect((await getMobilityState(alice)).history[0]?.outcomes).toEqual([]);
});

it('deletes only the selected account-scoped session without disturbing an active one', async () => {
  const routine = await saveMobilityRoutine(alice, {
    name: 'Desk reset',
    cue: 'off',
    steps: [
      {
        name: 'Reach',
        instructions: '',
        side: 'both',
        kind: 'timed',
        durationSeconds: 30,
        transitionSeconds: 0,
      },
    ],
  });
  const ended = await startMobilitySession(alice, routine.id, at(0));
  await applyMobilitySessionAction(alice, ended.id, 'cancel', at(1));
  const active = await startMobilitySession(alice, routine.id, at(2));

  await deleteMobilitySessionHistory(bob, ended.id);
  expect((await getMobilityState(alice)).history).toHaveLength(1);
  await deleteMobilitySessionHistory(alice, ended.id);
  const state = await getMobilityState(alice);
  expect(state.history).toEqual([]);
  expect(state.activeSession?.id).toBe(active.id);
  expect(state.routines).toHaveLength(1);
});

it('rejects ambiguous step identities and leaves the saved routine intact', async () => {
  const routine = await saveMobilityRoutine(alice, {
    name: 'Distinct steps',
    cue: 'off',
    steps: [
      {
        name: 'Reach',
        instructions: '',
        side: 'both',
        kind: 'repetitions',
        repetitions: 5,
        transitionSeconds: 0,
      },
    ],
  });
  await expect(
    saveMobilityRoutine(alice, {
      id: routine.id,
      name: 'Duplicate steps',
      cue: 'off',
      steps: [routine.steps[0], routine.steps[0]],
    })
  ).rejects.toThrow('unique IDs');
  expect((await getMobilityState(alice)).routines).toEqual([routine]);
});

it('reads an earlier saved routine without a reminder as unscheduled', async () => {
  const routine = await saveMobilityRoutine(alice, {
    name: 'Desk reset',
    cue: 'off',
    steps: [
      {
        name: 'Reach',
        instructions: '',
        side: 'both',
        kind: 'timed',
        durationSeconds: 30,
        transitionSeconds: 0,
      },
    ],
  });
  const key = '@SparkyFitness/mobility-routines/v1/server-A/alice';
  const stored = JSON.parse((await AsyncStorage.getItem(key))!);
  delete stored.routines[0].reminderTime;
  await AsyncStorage.setItem(key, JSON.stringify(stored));
  expect((await getMobilityState(alice)).routines[0]).toMatchObject({
    id: routine.id,
    reminderTime: null,
  });
});
