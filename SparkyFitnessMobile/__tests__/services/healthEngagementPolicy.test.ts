import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  arbitrateDiscretionaryCandidates,
  deriveNutritionEngagementState,
  nutritionReminderCandidates,
  type ReminderCandidate,
} from '../../src/services/healthEngagementPolicy';
import {
  enqueuePhotoCapture,
  listNutritionActions,
} from '../../src/services/nutritionActionOutbox';

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
