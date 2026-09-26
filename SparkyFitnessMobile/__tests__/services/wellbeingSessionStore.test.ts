import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '33333333-3333-4333-8333-333333333333'),
}));
import {
  endStoredWellbeingSession,
  getWellbeingSession,
  setWellbeingActivityId,
  startStoredMovementBreak,
} from '../../src/services/wellbeingSessionStore';

const identity = { serverConfigId: 'server-A', userId: 'user-A' };

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('persists one bounded session and does not turn a timer into a domain action', async () => {
  const started = await startStoredMovementBreak(
    identity,
    5,
    new Date('2026-09-23T12:00:00Z')
  );
  expect(started).toMatchObject({
    mode: 'movementBreak',
    state: 'active',
    startedAt: '2026-09-23T12:00:00.000Z',
    endsAt: '2026-09-23T12:05:00.000Z',
  });
  expect(await getWellbeingSession()).toEqual(started);
  expect(
    await startStoredMovementBreak(
      identity,
      5,
      new Date('2026-09-23T12:01:00Z')
    )
  ).toEqual(started);
  await setWellbeingActivityId(started.id, 'activity-1');
  expect((await getWellbeingSession())?.activityId).toBe('activity-1');
  await endStoredWellbeingSession(started.id);
  expect((await getWellbeingSession())?.state).toBe('ended');
  expect(
    (await AsyncStorage.getAllKeys()).filter((key) =>
      key.includes('nutrition-action')
    )
  ).toEqual([]);
});

it('rejects unbounded timers and never reuses another account session', async () => {
  await expect(startStoredMovementBreak(identity, 0)).rejects.toThrow();
  await expect(startStoredMovementBreak(identity, 31)).rejects.toThrow();
  await startStoredMovementBreak(identity, 5, new Date('2026-09-23T12:00:00Z'));
  const switched = await startStoredMovementBreak(
    {
      serverConfigId: 'server-B',
      userId: 'user-B',
    },
    2,
    new Date('2026-09-23T12:01:00Z')
  );
  expect(switched).toMatchObject({
    serverConfigId: 'server-B',
    userId: 'user-B',
    endsAt: '2026-09-23T12:03:00.000Z',
  });
});
