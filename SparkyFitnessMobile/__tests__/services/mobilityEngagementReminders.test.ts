import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import {
  initMobilityEngagementResponses,
  reconcileMobilityEngagementReminders,
} from '../../src/services/mobilityEngagementReminders';
import { getMobilityState } from '../../src/services/mobilityRoutineStore';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { hasNotificationPermission } from '../../src/services/notifications';
import { getTodayDate } from '../../src/utils/dateUtils';
import { __resetDiscretionaryPromptLedgerForTests } from '../../src/services/discretionaryPromptLedger';

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: 'default',
}));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/mobilityRoutineStore', () => ({
  getMobilityState: jest.fn(),
}));
jest.mock('../../src/services/notifications', () => ({
  hasNotificationPermission: jest.fn(),
}));

const identity = { serverConfigId: 'server-A', userId: 'user-A' };
const routineId = '11111111-1111-4111-8111-111111111111';
const candidateId = `movement:mobility:${getTodayDate()}:${routineId}`;
const tomorrow = Date.now() + 86_400_000;

beforeEach(async () => {
  __resetDiscretionaryPromptLedgerForTests();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.mocked(hasNotificationPermission).mockResolvedValue(true);
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([]);
  jest
    .mocked(Notifications.getPresentedNotificationsAsync)
    .mockResolvedValue([]);
  jest
    .mocked(Notifications.scheduleNotificationAsync)
    .mockResolvedValue('scheduled');
  jest
    .mocked(Notifications.cancelScheduledNotificationAsync)
    .mockResolvedValue();
  jest.mocked(Notifications.dismissNotificationAsync).mockResolvedValue();
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  jest.mocked(getMobilityState).mockResolvedValue({
    version: 1,
    routines: [{ id: routineId, reminderTime: '15:00' }],
    activeSession: null,
    history: [],
  } as Awaited<ReturnType<typeof getMobilityState>>);
});

it('schedules only mobility candidates in its own namespace', async () => {
  await reconcileMobilityEngagementReminders({
    identity,
    enabled: true,
    candidates: [
      {
        id: candidateId,
        kind: 'mobility',
        domain: 'movement',
        preferredAt: tomorrow,
        earliestAt: tomorrow,
        expiresAt: tomorrow + 3_600_000,
        flexibilityMinutes: 0,
      },
    ],
  });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  const request = jest.mocked(Notifications.scheduleNotificationAsync).mock
    .calls[0][0];
  expect(request.identifier).toBe(
    `engagement:mobility:server-A:user-A:${candidateId}`
  );
  expect(request.content.data).toMatchObject({
    serverConfigId: 'server-A',
    userId: 'user-A',
    candidateId,
  });
});

it('opens only a current same-account saved routine and never records it', async () => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  initMobilityEngagementResponses();
  const listener = jest.mocked(
    Notifications.addNotificationResponseReceivedListener
  ).mock.calls[0][0];
  const response = {
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: {
      request: {
        identifier: `engagement:mobility:server-A:user-A:${candidateId}`,
        content: { data: { version: 1, ...identity, candidateId } },
      },
    },
  } as Notifications.NotificationResponse;
  listener({
    ...response,
    notification: {
      request: {
        ...response.notification.request,
        content: {
          data: {
            version: 1,
            ...identity,
            candidateId: 'movement:mobility:old:stale',
          },
        },
      },
    },
  } as Notifications.NotificationResponse);
  await Promise.resolve();
  expect(Linking.openURL).not.toHaveBeenCalled();
  listener(response);
  listener(response);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  expect(Linking.openURL).toHaveBeenCalledWith(
    'sparkyfitnessmobile://guided-mobility'
  );
  expect(getMobilityState).toHaveBeenCalledWith(identity);
});
