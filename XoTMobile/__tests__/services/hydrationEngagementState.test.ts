import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueueContainerWaterAction,
  enqueueManualWaterAction,
  type PendingContainerWaterAction,
  type PendingManualWaterAction,
} from '../../src/services/nutritionActionOutbox';
import { deriveHydrationEngagementState } from '../../src/services/hydrationEngagementState';

const identity = { serverConfigId: 'server-A', userId: 'user-A' };
const operationId = '11111111-1111-4111-8111-111111111111';
const day = '2026-09-15';

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('anchors hydration to an offline drink without counting it twice after server replay', async () => {
  const action = await enqueueManualWaterAction({
    ...identity,
    entryDate: day,
    waterMl: 250,
    loggedAt: '2026-09-15T10:30:00.000Z',
    clientOperationId: operationId,
  });
  const offline = deriveHydrationEngagementState({
    day,
    remoteLog: null,
    localActions: [action],
  });
  expect(offline).toMatchObject({
    pendingMl: 250,
    remoteKnown: false,
    latestLoggedAt: new Date('2026-09-15T10:30:00.000Z'),
  });

  const replayed = deriveHydrationEngagementState({
    day,
    remoteLog: [
      {
        id: 'ledger-1',
        user_id: identity.userId,
        entry_date: day,
        water_ml: 250,
        container_id: null,
        container_name: null,
        source: 'manual',
        source_id: operationId,
        created_at: '2026-09-15T10:31:00.000Z',
        logged_at: '2026-09-15T10:30:00.000Z',
      },
    ],
    localActions: [action],
  });
  expect(replayed).toMatchObject({
    pendingMl: 0,
    remoteKnown: true,
    latestLoggedAt: new Date('2026-09-15T10:30:00.000Z'),
  });
});

it('keeps an attention-required action separate and ignores another day', async () => {
  const action = await enqueueManualWaterAction({
    ...identity,
    entryDate: day,
    waterMl: 250,
    loggedAt: '2026-09-15T10:30:00.000Z',
    clientOperationId: operationId,
  });
  const attention = {
    ...action,
    syncState: 'attentionRequired',
  } as PendingManualWaterAction;
  expect(
    deriveHydrationEngagementState({
      day,
      remoteLog: [],
      localActions: [attention],
    })
  ).toMatchObject({ pendingMl: 0, attentionMl: 250 });
  expect(
    deriveHydrationEngagementState({
      day: '2026-09-16',
      remoteLog: [],
      localActions: [attention],
    })
  ).toMatchObject({
    pendingMl: 0,
    attentionMl: 0,
    latestLoggedAt: null,
  });
});

it('anchors reminders to an offline container tap without inventing its water volume', async () => {
  const action = await enqueueContainerWaterAction({
    ...identity,
    entryDate: day,
    containerId: 7,
    loggedAt: '2026-09-15T11:30:00.000Z',
    clientOperationId: operationId,
  });
  const offline = deriveHydrationEngagementState({
    day,
    remoteLog: null,
    localActions: [],
    containerActions: [action],
  });
  expect(offline).toMatchObject({
    pendingMl: 0,
    pendingContainerCount: 1,
    latestLoggedAt: new Date('2026-09-15T11:30:00.000Z'),
  });

  const replayed = deriveHydrationEngagementState({
    day,
    remoteLog: [
      {
        id: 'ledger-1',
        user_id: identity.userId,
        entry_date: day,
        water_ml: 140,
        container_id: 7,
        container_name: 'Synthetic cup',
        source: 'manual',
        source_id: operationId,
        created_at: '2026-09-15T11:31:00.000Z',
        logged_at: '2026-09-15T11:30:00.000Z',
      },
    ],
    localActions: [],
    containerActions: [action],
  });
  expect(replayed).toMatchObject({
    pendingMl: 0,
    pendingContainerCount: 0,
    latestLoggedAt: new Date('2026-09-15T11:30:00.000Z'),
  });
});

it('uses a failed container tap as an attention anchor but trusts a fetched deletion', async () => {
  const action = await enqueueContainerWaterAction({
    ...identity,
    entryDate: day,
    containerId: 7,
    loggedAt: '2026-09-15T11:30:00.000Z',
    clientOperationId: operationId,
  });
  const attention = {
    ...action,
    syncState: 'attentionRequired',
  } as PendingContainerWaterAction;
  expect(
    deriveHydrationEngagementState({
      day,
      remoteLog: [],
      localActions: [],
      containerActions: [attention],
    })
  ).toMatchObject({
    attentionContainerCount: 1,
    latestLoggedAt: new Date('2026-09-15T11:30:00.000Z'),
  });

  expect(
    deriveHydrationEngagementState({
      day,
      remoteLog: [],
      localActions: [],
      containerActions: [{ ...action, syncState: 'synced' }],
    })
  ).toMatchObject({ pendingContainerCount: 0, latestLoggedAt: null });
  expect(
    deriveHydrationEngagementState({
      day: '2026-09-16',
      remoteLog: null,
      localActions: [],
      containerActions: [action],
    })
  ).toMatchObject({ pendingContainerCount: 0, latestLoggedAt: null });
});
