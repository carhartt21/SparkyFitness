import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authorizationStatusFor,
  queryWorkoutSamples,
  requestAuthorization,
  saveWorkoutSample,
} from '@kingstinct/react-native-healthkit';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { loadHealthPreference } from '../../src/services/healthkit/preferences';
import WatchConnectivity from '../../modules/watch-connectivity';
import {
  handleWatchWorkoutHealth,
  discardWatchWorkoutRecording,
  needsPhoneWorkoutEnergy,
  queueCompletedWorkoutExport,
  retryPendingWorkoutExports,
} from '../../src/services/workoutHealthExport.ios';

jest.mock('../../modules/watch-connectivity', () => ({
  __esModule: true,
  default: { sendWorkoutHealthCommand: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/healthkit/preferences', () => ({
  loadHealthPreference: jest.fn(),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

const identity = { serverConfigId: 'server-1', userId: 'user-1' };
const workout = {
  sessionId: 'session-1',
  startedAt: Date.parse('2026-09-25T08:00:00Z'),
  finishedAt: Date.parse('2026-09-25T08:45:00Z'),
  completedSetCount: 3,
  sourceServerConfigId: 'server-1',
  activeEnergyKcal: 175,
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (getActiveNutritionIdentity as jest.Mock).mockResolvedValue(identity);
  (loadHealthPreference as jest.Mock).mockResolvedValue(true);
  (authorizationStatusFor as jest.Mock).mockReturnValue(2);
  (queryWorkoutSamples as jest.Mock).mockResolvedValue([]);
  (saveWorkoutSample as jest.Mock).mockResolvedValue({ uuid: 'health-1' });
});

test('exports one workout after a completed session and ignores a repeated finish', async () => {
  await queueCompletedWorkoutExport(workout);
  await queueCompletedWorkoutExport({
    ...workout,
    finishedAt: workout.finishedAt + 1000,
  });
  expect(saveWorkoutSample).toHaveBeenCalledTimes(1);
  expect(saveWorkoutSample).toHaveBeenCalledWith(
    expect.any(Number),
    [
      expect.objectContaining({
        quantityType: 'HKQuantityTypeIdentifierActiveEnergyBurned',
        unit: 'kcal',
        quantity: 175,
        metadata: expect.objectContaining({ HKWasUserEntered: true }),
      }),
    ],
    new Date(workout.startedAt),
    new Date(workout.finishedAt),
    { energyBurned: 175 },
    expect.objectContaining({
      HKSyncVersion: 1,
      HKWorkoutBrandName: 'X on Track',
    })
  );
});

test('retries a failed save and recognizes a workout already saved before the app stopped', async () => {
  (saveWorkoutSample as jest.Mock).mockRejectedValueOnce(
    new Error('Health unavailable')
  );
  await expect(queueCompletedWorkoutExport(workout)).rejects.toThrow(
    'Health unavailable'
  );
  expect(saveWorkoutSample).toHaveBeenCalledTimes(1);
  (queryWorkoutSamples as jest.Mock).mockResolvedValueOnce([
    { uuid: 'health-1' },
  ]);
  (authorizationStatusFor as jest.Mock).mockReturnValue(2);
  await retryPendingWorkoutExports();
  expect(saveWorkoutSample).toHaveBeenCalledTimes(1);
  await retryPendingWorkoutExports();
  expect(queryWorkoutSamples).toHaveBeenCalledTimes(3);
});

test('keeps a pending workout when HealthKit write permission is missing', async () => {
  (authorizationStatusFor as jest.Mock).mockReturnValue(1);
  await expect(queueCompletedWorkoutExport(workout)).rejects.toThrow(
    'workout write permission is not enabled'
  );
  expect(saveWorkoutSample).not.toHaveBeenCalled();
  (authorizationStatusFor as jest.Mock).mockReturnValue(2);
  await retryPendingWorkoutExports();
  expect(saveWorkoutSample).toHaveBeenCalledTimes(1);
});

test('does not export without opt-in or when the active account changes', async () => {
  (loadHealthPreference as jest.Mock).mockResolvedValueOnce(false);
  await queueCompletedWorkoutExport(workout);
  expect(saveWorkoutSample).not.toHaveBeenCalled();
  (getActiveNutritionIdentity as jest.Mock).mockResolvedValueOnce({
    serverConfigId: 'server-2',
    userId: 'user-1',
  });
  await expect(queueCompletedWorkoutExport(workout)).rejects.toThrow(
    'different server'
  );
  expect(saveWorkoutSample).not.toHaveBeenCalled();
});

const scope = JSON.stringify(['server-1', 'user-1']);
const syncId = 'com.cg.phi.workout.server-1.user-1.session-1';
const active = {
  sessionId: workout.sessionId,
  startedAt: workout.startedAt,
  sourceServerConfigId: 'server-1',
};
const request = {
  type: 'workoutHealth' as const,
  sessionId: workout.sessionId,
  scope,
  syncId: '',
  phase: 'request' as const,
};

it.each([undefined, 0, -1, NaN, Infinity])(
  'never manufactures energy for %s',
  async (activeEnergyKcal) => {
    expect(
      await queueCompletedWorkoutExport({ ...workout, activeEnergyKcal })
    ).toBe('skipped');
    expect(saveWorkoutSample).not.toHaveBeenCalled();
  }
);

it('requires energy permission as well as workout permission', async () => {
  (authorizationStatusFor as jest.Mock).mockImplementation((type) =>
    type === 'HKWorkoutTypeIdentifier' ? 2 : 1
  );
  await expect(queueCompletedWorkoutExport(workout)).rejects.toThrow(
    'permission'
  );
  expect(saveWorkoutSample).not.toHaveBeenCalled();
});

it('recognizes the legacy metadata key without writing another workout', async () => {
  (queryWorkoutSamples as jest.Mock)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ uuid: 'legacy' }]);
  await queueCompletedWorkoutExport(workout);
  expect(queryWorkoutSamples).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      filter: {
        metadata: expect.objectContaining({
          withMetadataKey: 'HKSyncIdentifier',
        }),
      },
    })
  );
  expect(saveWorkoutSample).not.toHaveBeenCalled();
});

it('reserves the Watch writer before transport and never falls back while offline', async () => {
  const send = WatchConnectivity!.sendWorkoutHealthCommand as jest.Mock;
  send.mockImplementationOnce(async () => {
    const records = await AsyncStorage.multiGet(
      await AsyncStorage.getAllKeys()
    );
    expect(
      records.some(([, value]) => value?.includes('"status":"watch"'))
    ).toBe(true);
    throw new Error('Offline');
  });
  await expect(handleWatchWorkoutHealth(request, active)).rejects.toThrow(
    'Offline'
  );
  send.mockResolvedValue(undefined);
  expect(await needsPhoneWorkoutEnergy(workout.sessionId)).toBe(false);
  expect(await queueCompletedWorkoutExport(workout)).toBe('watch-pending');
  expect(saveWorkoutSample).not.toHaveBeenCalled();
  await retryPendingWorkoutExports();
  expect(send).toHaveBeenLastCalledWith(
    expect.objectContaining({
      action: 'finish',
      finishedAt: workout.finishedAt,
      save: true,
    })
  );
});

it('deduplicates finish and receipt; late failures cannot undo a confirmed save', async () => {
  await handleWatchWorkoutHealth(request, active);
  await queueCompletedWorkoutExport(workout);
  await handleWatchWorkoutHealth(
    { ...request, syncId, phase: 'saved', workoutUuid: 'watch-health-1' },
    active
  );
  await handleWatchWorkoutHealth(
    { ...request, syncId, phase: 'failed' },
    active
  );
  await discardWatchWorkoutRecording(workout.sessionId);
  expect(
    await queueCompletedWorkoutExport({
      ...workout,
      finishedAt: workout.finishedAt + 999,
    })
  ).toBe('saved');
  expect(saveWorkoutSample).not.toHaveBeenCalled();
  expect(WatchConnectivity!.sendWorkoutHealthCommand).toHaveBeenLastCalledWith(
    expect.objectContaining({
      action: 'ack',
      ackPhase: 'saved',
      finishedAt: workout.finishedAt,
    })
  );
});

it('discards a cleared workout or no completed sets, without a Health write', async () => {
  await handleWatchWorkoutHealth(request, active);
  await discardWatchWorkoutRecording(workout.sessionId);
  expect(WatchConnectivity!.sendWorkoutHealthCommand).toHaveBeenLastCalledWith(
    expect.objectContaining({ action: 'discard', save: false })
  );
  expect(saveWorkoutSample).not.toHaveBeenCalled();
});

it('does not discard a normal finish when the active store is cleared', async () => {
  await handleWatchWorkoutHealth(request, active);
  await queueCompletedWorkoutExport(workout);
  const send = WatchConnectivity!.sendWorkoutHealthCommand as jest.Mock;
  send.mockClear();
  await discardWatchWorkoutRecording(workout.sessionId);
  expect(send).not.toHaveBeenCalled();
});

it.each(['wrong scope', 'wrong session', 'not enabled', 'already phone-owned'])(
  'rejects a Watch claim: %s',
  async (reason) => {
    if (reason === 'not enabled')
      (loadHealthPreference as jest.Mock).mockResolvedValue(false);
    if (reason === 'already phone-owned')
      await queueCompletedWorkoutExport(workout);
    await handleWatchWorkoutHealth(
      {
        ...request,
        scope: reason === 'wrong scope' ? '["server-2","user-1"]' : scope,
      },
      {
        ...active,
        sessionId: reason === 'wrong session' ? 'other' : active.sessionId,
      }
    );
    expect(
      WatchConnectivity!.sendWorkoutHealthCommand
    ).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'start' }));
  }
);

it("never accepts an unreserved receipt or replays another account's command", async () => {
  await handleWatchWorkoutHealth(
    { ...request, syncId, phase: 'saved' },
    active
  );
  expect(WatchConnectivity!.sendWorkoutHealthCommand).not.toHaveBeenCalled();
  await handleWatchWorkoutHealth(request, active);
  (getActiveNutritionIdentity as jest.Mock).mockResolvedValue({
    serverConfigId: 'server-1',
    userId: 'user-2',
  });
  (WatchConnectivity!.sendWorkoutHealthCommand as jest.Mock).mockClear();
  await retryPendingWorkoutExports();
  expect(WatchConnectivity!.sendWorkoutHealthCommand).not.toHaveBeenCalled();
});

it('does not export old pending records without known energy', async () => {
  await AsyncStorage.setItem(
    '@XOnTrack/workout-health-export/v1/server-1/user-1/legacy',
    JSON.stringify({
      status: 'pending',
      syncId: 'legacy',
      workout: { ...workout, activeEnergyKcal: undefined },
    })
  );
  await retryPendingWorkoutExports();
  expect(saveWorkoutSample).not.toHaveBeenCalled();
});

it('closes a skipped export so delayed Watch requests cannot start it', async () => {
  await queueCompletedWorkoutExport({
    ...workout,
    activeEnergyKcal: undefined,
  });
  await handleWatchWorkoutHealth(request, active);
  expect(WatchConnectivity!.sendWorkoutHealthCommand).toHaveBeenLastCalledWith(
    expect.objectContaining({ action: 'reject' })
  );
});

it('discards Watch recording when no sets were completed or export was revoked', async () => {
  await handleWatchWorkoutHealth(request, active);
  (loadHealthPreference as jest.Mock).mockResolvedValue(false);
  await queueCompletedWorkoutExport({ ...workout, completedSetCount: 0 });
  expect(WatchConnectivity!.sendWorkoutHealthCommand).toHaveBeenLastCalledWith(
    expect.objectContaining({ action: 'discard', save: false })
  );
  expect(saveWorkoutSample).not.toHaveBeenCalled();
});

it('retains a successful locked-Watch save without needing its UUID', async () => {
  await handleWatchWorkoutHealth(request, active);
  await queueCompletedWorkoutExport(workout);
  await handleWatchWorkoutHealth(
    { ...request, syncId, phase: 'saved' },
    active
  );
  expect(await queueCompletedWorkoutExport(workout)).toBe('saved');
  expect(saveWorkoutSample).not.toHaveBeenCalled();
});

it('reports an unconfirmed Watch save rather than a successful phone fallback', async () => {
  await handleWatchWorkoutHealth(request, active);
  await handleWatchWorkoutHealth(
    { ...request, syncId, phase: 'failed' },
    active
  );
  expect(await queueCompletedWorkoutExport(workout)).toBe('watch-unavailable');
  expect(saveWorkoutSample).not.toHaveBeenCalled();
});

it('requests the added active-energy permission for an upgraded phone-only exporter', async () => {
  let authorized = false;
  (authorizationStatusFor as jest.Mock).mockImplementation((type) =>
    type === 'HKWorkoutTypeIdentifier' || authorized ? 2 : 1
  );
  (requestAuthorization as jest.Mock).mockImplementationOnce(async () => {
    authorized = true;
    return true;
  });
  await queueCompletedWorkoutExport(workout);
  expect(requestAuthorization).toHaveBeenCalledWith({
    toRead: [],
    toShare: [
      'HKWorkoutTypeIdentifier',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
    ],
  });
  expect(saveWorkoutSample).toHaveBeenCalledTimes(1);
});

it('does not resend old terminal receipts on every foreground refresh', async () => {
  await handleWatchWorkoutHealth(request, active);
  await queueCompletedWorkoutExport(workout);
  await handleWatchWorkoutHealth(
    { ...request, syncId, phase: 'saved' },
    active
  );
  (WatchConnectivity!.sendWorkoutHealthCommand as jest.Mock).mockClear();
  await retryPendingWorkoutExports();
  expect(WatchConnectivity!.sendWorkoutHealthCommand).not.toHaveBeenCalled();
});

test('uses flexibility for mobility and retains exactly-once retries', async () => {
  const mobility = {
    ...workout,
    sessionId: 'mobility:session',
    activityKind: 'mobility' as const,
    sourceUserId: identity.userId,
  };
  await queueCompletedWorkoutExport(mobility);
  await queueCompletedWorkoutExport(mobility);
  expect(saveWorkoutSample).toHaveBeenCalledTimes(1);
  expect(saveWorkoutSample).toHaveBeenCalledWith(
    62,
    expect.any(Array),
    expect.any(Date),
    expect.any(Date),
    { energyBurned: 175 },
    expect.objectContaining({ XOnTrackWritebackVersion: 1 })
  );
});

test('rejects a mobility export belonging to another account', async () => {
  await expect(
    queueCompletedWorkoutExport({ ...workout, sourceUserId: 'other-user' })
  ).rejects.toThrow('different account');
  expect(saveWorkoutSample).not.toHaveBeenCalled();
});
