let mockUuidIndex = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    `00000000-0000-4000-8000-${String(++mockUuidIndex).padStart(12, '0')}`,
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '../../src/services/api/errors';
import { apiFetch } from '../../src/services/api/apiClient';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { reconcileNutritionEngagementReminders } from '../../src/services/nutritionEngagementReminders';
import {
  disableThisNotificationDevice,
  flushNotificationDeviceOff,
  notificationDeviceOffPending,
  enableRemoteEngagement,
  renewRemoteEngagementDevice,
  refreshRemoteEngagement,
  patchRemoteEngagement,
  readCachedRemoteEngagement,
} from '../../src/services/remoteEngagement';
jest.mock('../../src/services/api/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { easConfig: { projectId: 'synthetic-project' } },
}));
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({
    data: 'ExpoPushToken[synthetic]',
  })),
}));
jest.mock('../../src/services/nutritionEngagementReminders', () => ({
  reconcileNutritionEngagementReminders: jest.fn(async () => undefined),
}));
jest.mock('../../src/services/movementEngagementReminders', () => ({
  reconcileMovementEngagementReminders: jest.fn(async () => undefined),
}));
jest.mock('../../src/services/mobilityEngagementReminders', () => ({
  reconcileMobilityEngagementReminders: jest.fn(async () => undefined),
}));
jest.mock('../../src/services/trackingEngagementReminders', () => ({
  reconcileTrackingEngagementReminders: jest.fn(async () => undefined),
}));
jest.mock('../../src/hooks/useHydrationReminder', () => ({
  cancelWaterReminders: jest.fn(async () => undefined),
}));
const identity = {
  serverConfigId: 'synthetic-server',
  userId: 'synthetic-user',
};
const settings = {
  schema_version: 2,
  schedule_initialized: true,
  revision: 1,
  remote_enabled: false,
  quiet_start: '22:00',
  quiet_end: '08:00',
  hydration_enabled: true,
  meal_capture_enabled: true,
  meal_review_enabled: true,
  movement_break_enabled: true,
  mobility_enabled: true,
  daily_limit: 3,
  hydration_interval_hours: 2,
  hydration_start: '08:00',
  hydration_end: '22:00',
  meal_capture_start: '11:00',
  meal_capture_end: '14:00',
  meal_capture_time: '12:30',
  meal_review_time: '20:00',
  movement_break_time: '15:00',
};
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  jest.mocked(reconcileNutritionEngagementReminders).mockResolvedValue();
  jest
    .mocked(apiFetch)
    .mockImplementation(async (request) =>
      request.endpoint.includes('/settings') ? settings : undefined
    );
});
it('prepares a local-owned device, cancels local alerts, then enables remote delivery', async () => {
  await enableRemoteEngagement(identity, settings);
  const calls = jest.mocked(apiFetch).mock.calls.map(([request]) => request);
  const devices = calls.filter((request) =>
    request.endpoint.endsWith('/devices')
  );
  expect(
    devices.map(
      (request) => (request.body as { delivery_owner: string }).delivery_owner
    )
  ).toEqual(['local', 'remote']);
  const cancellation = jest.mocked(reconcileNutritionEngagementReminders).mock
    .invocationCallOrder[0];
  expect(jest.mocked(apiFetch).mock.invocationCallOrder[0]).toBeLessThan(
    cancellation
  );
  expect(cancellation).toBeLessThan(
    jest.mocked(apiFetch).mock.invocationCallOrder[calls.length - 1]
  );
});
it('never confirms remote ownership if local cancellation fails', async () => {
  jest
    .mocked(reconcileNutritionEngagementReminders)
    .mockRejectedValueOnce(new Error('cancel failed'));
  await expect(renewRemoteEngagementDevice(identity)).rejects.toThrow(
    'cancel failed'
  );
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(jest.mocked(apiFetch).mock.calls[0][0].body).toMatchObject({
    delivery_owner: 'local',
  });
});
it('persists an account-scoped device-off marker until the same-device delete succeeds', async () => {
  jest.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
  await expect(disableThisNotificationDevice(identity)).rejects.toThrow(
    'offline'
  );
  expect(await notificationDeviceOffPending(identity)).toBe(true);
  expect(
    await notificationDeviceOffPending({ ...identity, userId: 'other' })
  ).toBe(false);
  await flushNotificationDeviceOff(identity);
  expect(await notificationDeviceOffPending(identity)).toBe(false);
  expect(jest.mocked(apiFetch).mock.calls[1][0].method).toBe('DELETE');
  expect(jest.mocked(apiFetch).mock.calls[1][0].endpoint).toBe(
    jest.mocked(apiFetch).mock.calls[0][0].endpoint
  );
});
it('uploads existing phone schedule settings only during the first v2 upgrade', async () => {
  jest
    .mocked(apiFetch)
    .mockResolvedValueOnce({ ...settings, schedule_initialized: false })
    .mockResolvedValueOnce({ ...settings, revision: 2 });
  await refreshRemoteEngagement(identity);
  expect(jest.mocked(apiFetch).mock.calls[1][0]).toMatchObject({
    method: 'PATCH',
    body: { expected_revision: 1, hydration_interval_hours: 2 },
  });
  await refreshRemoteEngagement(identity);
  expect(
    jest
      .mocked(apiFetch)
      .mock.calls.filter(([request]) => request.method === 'PATCH')
  ).toHaveLength(1);
});

it('uses a fresh revision and retries one concurrent web edit without replacing unrelated settings', async () => {
  jest
    .mocked(apiFetch)
    .mockResolvedValueOnce({ ...settings, revision: 4 })
    .mockRejectedValueOnce(new ApiError('changed elsewhere', 409))
    .mockResolvedValueOnce({ ...settings, revision: 5, daily_limit: 8 })
    .mockResolvedValueOnce({
      ...settings,
      revision: 6,
      daily_limit: 8,
      mobility_enabled: false,
    });
  const result = await patchRemoteEngagement(identity, {
    mobility_enabled: false,
  });
  const patches = jest
    .mocked(apiFetch)
    .mock.calls.filter(([req]) => req.method === 'PATCH')
    .map(([req]) => req.body);
  expect(patches).toEqual([
    { expected_revision: 4, mobility_enabled: false },
    { expected_revision: 5, mobility_enabled: false },
  ]);
  expect(result.daily_limit).toBe(8);
  expect(await readCachedRemoteEngagement(identity)).toEqual(result);
});
it('serializes first-time initialization with a simultaneous foreground refresh and settings edit', async () => {
  let remote = { ...settings, schedule_initialized: false };
  jest.mocked(apiFetch).mockImplementation(async (request) => {
    if (request.method === 'PATCH') {
      const body = request.body as {
        expected_revision: number;
        mobility_enabled?: boolean;
      };
      expect(body.expected_revision).toBe(remote.revision);
      remote = {
        ...remote,
        revision: remote.revision + 1,
        schedule_initialized: true,
        ...(body.mobility_enabled === undefined
          ? {}
          : { mobility_enabled: body.mobility_enabled }),
      };
    }
    return remote;
  });
  await Promise.all([
    refreshRemoteEngagement(identity),
    refreshRemoteEngagement(identity),
    patchRemoteEngagement(identity, { mobility_enabled: false }),
  ]);
  expect(remote).toMatchObject({
    revision: 3,
    mobility_enabled: false,
    schedule_initialized: true,
  });
  expect(
    jest
      .mocked(apiFetch)
      .mock.calls.filter(([request]) => request.method === 'PATCH')
  ).toHaveLength(2);
});
it('does not overwrite initialization performed on the web during a conflicting upgrade save', async () => {
  jest
    .mocked(apiFetch)
    .mockResolvedValueOnce({ ...settings, schedule_initialized: false })
    .mockRejectedValueOnce(new ApiError('changed elsewhere', 409))
    .mockResolvedValueOnce({
      ...settings,
      revision: 2,
      hydration_interval_hours: 12,
    });
  expect(
    (await refreshRemoteEngagement(identity)).hydration_interval_hours
  ).toBe(12);
  expect(
    jest.mocked(apiFetch).mock.calls.filter(([req]) => req.method === 'PATCH')
  ).toHaveLength(1);
});
