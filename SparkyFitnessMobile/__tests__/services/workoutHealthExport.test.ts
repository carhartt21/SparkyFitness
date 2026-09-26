import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authorizationStatusFor,
  queryWorkoutSamples,
  saveWorkoutSample,
} from '@kingstinct/react-native-healthkit';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { loadHealthPreference } from '../../src/services/healthkit/preferences';
import {
  queueCompletedWorkoutExport,
  retryPendingWorkoutExports,
} from '../../src/services/workoutHealthExport.ios';

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
    [],
    new Date(workout.startedAt),
    new Date(workout.finishedAt),
    undefined,
    expect.objectContaining({
      HKMetadataKeySyncVersion: 1,
      HKMetadataKeyWorkoutBrandName: 'X on Track',
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
  await retryPendingWorkoutExports();
  expect(saveWorkoutSample).toHaveBeenCalledTimes(1);
  await retryPendingWorkoutExports();
  expect(queryWorkoutSamples).toHaveBeenCalledTimes(2);
});

test('keeps a pending workout when HealthKit write permission is missing', async () => {
  (authorizationStatusFor as jest.Mock).mockReturnValueOnce(1);
  await expect(queueCompletedWorkoutExport(workout)).rejects.toThrow(
    'workout write permission is not enabled'
  );
  expect(saveWorkoutSample).not.toHaveBeenCalled();
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
