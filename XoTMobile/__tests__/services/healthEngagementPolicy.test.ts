import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  arbitrateDiscretionaryCandidates,
  deriveNutritionEngagementState,
  movementBreakReminderCandidate,
  mobilityReminderCandidates,
  nutritionReminderCandidates,
  selectHydrationReminderSchedule,
  type ReminderCandidate,
} from '../../src/services/healthEngagementPolicy';
import {
  enqueuePhotoCapture,
  listNutritionActions,
} from '../../src/services/nutritionActionOutbox';
import type {
  MobilityRoutine,
  MobilitySession,
} from '../../src/services/mobilityRoutineStore';

const day = '2026-09-23';
const at = (hour: number, minute = 0) =>
  new Date(2026, 8, 23, hour, minute).getTime();
const identity = { serverConfigId: 'server-A', userId: 'user-A' };
const captureId = '11111111-1111-4111-8111-111111111111';
const imageId = '22222222-2222-4222-8222-222222222222';

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('counts a durable offline photo as capture while leaving nutrition unknown', async () => {
  await enqueuePhotoCapture({
    ...identity,
    payload: {
      id: captureId,
      capturedAt: new Date(at(12, 5)).toISOString(),
      consumedAt: new Date(at(12, 5)).toISOString(),
      entryDate: day,
      mealTypeId: null,
      notes: null,
      images: [{ id: imageId, uri: 'file:///synthetic-test.jpg' }],
    },
  });
  const actions = await listNutritionActions(identity);
  const state = deriveNutritionEngagementState({
    day,
    remoteEntries: null,
    remoteCaptures: null,
    localActions: actions,
    knownRemoteCalories: null,
    now: at(12, 10),
  });
  expect(state).toMatchObject({
    capturedCount: 1,
    incompleteCount: 1,
    pendingSyncCount: 1,
    knownCalories: null,
  });
  expect(
    nutritionReminderCandidates({
      state,
      windows: [
        {
          id: 'lunch',
          start: '11:00',
          prompt: '12:30',
          end: '14:00',
          enabled: true,
        },
      ],
      reviewTime: null,
      now: at(12, 10),
    })
  ).toEqual([]);
  expect(await listNutritionActions(identity)).toHaveLength(1);
});

it('merges the same remote and local capture and keeps completion distinct from sync', async () => {
  const action = await enqueuePhotoCapture({
    ...identity,
    payload: {
      id: captureId,
      capturedAt: new Date(at(12, 5)).toISOString(),
      consumedAt: new Date(at(12, 5)).toISOString(),
      entryDate: day,
      images: [{ id: imageId, uri: 'file:///synthetic-test.jpg' }],
    },
  });
  const state = deriveNutritionEngagementState({
    day,
    remoteEntries: [],
    remoteCaptures: [
      {
        id: captureId,
        user_id: identity.userId,
        captured_at: action.payload.capturedAt,
        consumed_at: action.payload.consumedAt,
        entry_date: day,
        meal_type_id: null,
        notes: null,
        completion_state: 'incomplete',
        images: [],
      },
    ],
    localActions: [action],
    knownRemoteCalories: 0,
    now: at(12, 10),
  });
  expect(state.capturedCount).toBe(1);
  expect(state.incompleteCount).toBe(1);
  expect(state.pendingSyncCount).toBe(1);
  expect(state.knownCalories).toBe(0);
});

it('does not catch up a missed meal prompt after its preferred time', () => {
  const state = deriveNutritionEngagementState({
    day,
    remoteEntries: [],
    remoteCaptures: [],
    localActions: [],
    knownRemoteCalories: 0,
    now: at(12, 40),
  });
  expect(
    nutritionReminderCandidates({
      state,
      windows: [
        {
          id: 'lunch',
          start: '11:00',
          prompt: '12:30',
          end: '14:00',
          enabled: true,
        },
      ],
      reviewTime: null,
      now: at(12, 40),
    })
  ).toHaveLength(0);
});

it('keeps photo review separate from capture and only proposes a future prompt', () => {
  const state = deriveNutritionEngagementState({
    day,
    remoteEntries: [],
    remoteCaptures: [
      {
        id: captureId,
        user_id: identity.userId,
        captured_at: new Date(at(12)).toISOString(),
        consumed_at: new Date(at(12)).toISOString(),
        entry_date: day,
        meal_type_id: null,
        notes: null,
        completion_state: 'incomplete',
        images: [],
      },
    ],
    localActions: [],
    knownRemoteCalories: 0,
    now: at(18),
  });
  const evaluate = (now: number) =>
    nutritionReminderCandidates({
      state,
      windows: [],
      reviewTime: '20:00',
      now,
    });
  expect(evaluate(at(18))).toEqual([
    expect.objectContaining({ id: `nutrition:review:${day}`, kind: 'review' }),
  ]);
  expect(evaluate(at(21))).toEqual([]);
  expect(
    nutritionReminderCandidates({
      state: { ...state, incompleteCount: 0 },
      windows: [],
      reviewTime: '20:00',
      now: at(18),
    })
  ).toEqual([]);
});

it('respects the shared cap and reserved scheduled-intake timing', () => {
  const candidates: ReminderCandidate[] = [
    {
      id: 'nutrition:capture:lunch',
      domain: 'nutrition',
      kind: 'capture',
      preferredAt: at(12),
      earliestAt: at(12),
      expiresAt: at(13),
      flexibilityMinutes: 30,
    },
    {
      id: 'hydration:midday',
      domain: 'hydration',
      kind: 'drink',
      preferredAt: at(12, 5),
      earliestAt: at(12, 5),
      expiresAt: at(13),
      flexibilityMinutes: 20,
    },
  ];
  const plan = arbitrateDiscretionaryCandidates({
    candidates,
    dailyCap: 1,
    domainCaps: { nutrition: 1, hydration: 1 },
    collisionMinutes: 10,
    reservedTimes: [at(12)],
    now: at(11),
  });
  expect(plan).toHaveLength(1);
  expect(plan[0].preferredAt).toBe(at(12, 10));
});

it('offers one future movement invitation at the chosen time', () => {
  const input = {
    day,
    time: '15:00',
    enabled: true,
    alreadyStartedToday: false,
    activeSession: false,
    now: at(14),
  };
  expect(movementBreakReminderCandidate(input)).toMatchObject({
    id: `movement:break:${day}`,
    domain: 'movement',
    kind: 'move',
    preferredAt: at(15),
  });
  expect(
    movementBreakReminderCandidate({ ...input, enabled: false })
  ).toBeNull();
  expect(
    movementBreakReminderCandidate({ ...input, alreadyStartedToday: true })
  ).toBeNull();
  expect(
    movementBreakReminderCandidate({ ...input, activeSession: true })
  ).toBeNull();
  expect(movementBreakReminderCandidate({ ...input, now: at(15) })).toBeNull();
  expect(
    movementBreakReminderCandidate({ ...input, time: '25:00' })
  ).toBeNull();
});

it('offers a saved mobility routine only before its time and before it was started today', () => {
  const routine: MobilityRoutine = {
    id: captureId,
    name: 'Desk reset',
    cue: 'off',
    reminderTime: '15:00',
    steps: [
      {
        id: imageId,
        name: 'Reach',
        instructions: '',
        side: 'both',
        kind: 'timed',
        durationSeconds: 30,
        transitionSeconds: 0,
      },
    ],
    createdAt: new Date(at(9)).toISOString(),
    updatedAt: new Date(at(9)).toISOString(),
  };
  const input = {
    day,
    routines: [routine],
    activeSession: null as MobilitySession | null,
    history: [] as MobilitySession[],
    now: at(14),
  };
  const candidates = mobilityReminderCandidates(input);
  expect(candidates).toMatchObject([
    {
      id: `movement:mobility:${day}:${routine.id}`,
      domain: 'movement',
      kind: 'mobility',
      preferredAt: at(15),
    },
  ]);
  expect(mobilityReminderCandidates({ ...input, now: at(15) })).toEqual([]);
  const started = {
    routine,
    startedAt: new Date(at(10)).toISOString(),
  } as MobilitySession;
  expect(mobilityReminderCandidates({ ...input, history: [started] })).toEqual(
    []
  );
  expect(
    mobilityReminderCandidates({ ...input, activeSession: started })
  ).toEqual([]);
  const breakCandidate = movementBreakReminderCandidate({
    day,
    time: '15:05',
    enabled: true,
    alreadyStartedToday: false,
    activeSession: false,
    now: at(14),
  });
  const plan = arbitrateDiscretionaryCandidates({
    candidates: [...candidates, breakCandidate!],
    dailyCap: 3,
    domainCaps: { movement: 1 },
    collisionMinutes: 20,
    reservedTimes: [],
    now: at(14),
  });
  expect(plan).toHaveLength(1);
  expect(plan[0].kind).toBe('mobility');
});

it('moves a movement invitation away from a meal prompt within the shared cap', () => {
  const movement = movementBreakReminderCandidate({
    day,
    time: '15:05',
    enabled: true,
    alreadyStartedToday: false,
    activeSession: false,
    now: at(14),
  });
  expect(movement).not.toBeNull();
  const nutrition: ReminderCandidate = {
    id: `nutrition:capture:${day}:selected`,
    domain: 'nutrition',
    kind: 'capture',
    preferredAt: at(15),
    earliestAt: at(15),
    expiresAt: at(16),
    flexibilityMinutes: 30,
  };
  const plan = arbitrateDiscretionaryCandidates({
    candidates: [nutrition, movement!],
    dailyCap: 3,
    domainCaps: { nutrition: 2, movement: 1 },
    collisionMinutes: 20,
    reservedTimes: [],
    now: at(14),
  });
  expect(plan).toHaveLength(2);
  expect(plan[0].preferredAt).toBe(at(15));
  expect(plan[1].preferredAt).toBe(at(15, 20));
});

it('limits water to the remaining daily slots without consuming tomorrow’s budget', () => {
  const sharedPlan: ReminderCandidate[] = [
    {
      id: 'nutrition:capture:2026-09-23:selected',
      domain: 'nutrition',
      kind: 'capture',
      preferredAt: at(10, 5),
      earliestAt: at(10, 5),
      expiresAt: at(11),
      flexibilityMinutes: 20,
    },
    {
      id: 'movement:break:2026-09-23',
      domain: 'movement',
      kind: 'move',
      preferredAt: at(14),
      earliestAt: at(14),
      expiresAt: at(15),
      flexibilityMinutes: 20,
    },
  ];
  const times = [
    new Date(at(10)),
    new Date(at(11)),
    new Date(at(12)),
    new Date(2026, 8, 24, 8),
    new Date(2026, 8, 24, 9),
    new Date(2026, 8, 24, 10),
    new Date(2026, 8, 24, 11),
  ];
  const selected = selectHydrationReminderSchedule({
    times,
    sharedPlan,
    now: at(9),
    windowEnd: '22:00',
    maxScheduled: 12,
  });
  expect(selected).toEqual([
    new Date(at(11)),
    new Date(2026, 8, 24, 8),
    new Date(2026, 8, 24, 9),
    new Date(2026, 8, 24, 10),
  ]);
});

it('shifts water away from a scheduled medication dose without spending a discretionary slot', () => {
  const selected = selectHydrationReminderSchedule({
    times: [new Date(at(12)), new Date(at(13))],
    sharedPlan: [],
    reservedTimes: [at(12)],
    now: at(11),
    windowEnd: '22:00',
    maxScheduled: 12,
  });
  expect(selected).toEqual([new Date(at(12, 20)), new Date(at(13))]);
});

it('uses only the slots left by prompts already scheduled earlier today', () => {
  expect(
    selectHydrationReminderSchedule({
      times: [new Date(at(10)), new Date(at(11)), new Date(at(12))],
      sharedPlan: [],
      spentByDay: { [day]: 2 },
      now: at(9),
      windowEnd: '22:00',
      maxScheduled: 12,
    })
  ).toEqual([new Date(at(10))]);
});
