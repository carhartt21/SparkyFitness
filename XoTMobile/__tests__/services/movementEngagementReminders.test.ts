import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import {
  initMovementEngagementResponses,
  reconcileMovementEngagementReminders,
} from '../../src/services/movementEngagementReminders';
import { hasNotificationPermission } from '../../src/services/notifications';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { getTodayDate } from '../../src/utils/dateUtils';
import type { ReminderCandidate } from '../../src/services/healthEngagementPolicy';
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
jest.mock('../../src/services/notifications', () => ({
  hasNotificationPermission: jest.fn(),
}));

const identity = { serverConfigId: 'server-A', userId: 'user-A' };
const tomorrow = Date.now() + 86_400_000;
const candidate: ReminderCandidate = {
  id: 'movement:break:future',
  domain: 'movement',
  kind: 'move',
  preferredAt: tomorrow,
  earliestAt: tomorrow,
  expiresAt: tomorrow + 3_600_000,
  flexibilityMinutes: 0,
};

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
});

it('schedules only movement candidates under the account-scoped namespace', async () => {
  await reconcileMovementEngagementReminders({
    identity,
    enabled: true,
    candidates: [
      candidate,
      {
        ...candidate,
        id: 'nutrition:capture:future',
        domain: 'nutrition',
        kind: 'capture',
      },
    ],
  });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  const request = jest.mocked(Notifications.scheduleNotificationAsync).mock
    .calls[0][0];
  expect(request.identifier).toBe(
    `engagement:movement:server-A:user-A:${candidate.id}`
  );
  expect(request.content.data).toMatchObject({
    serverConfigId: 'server-A',
    userId: 'user-A',
    candidateId: candidate.id,
  });
});

it('cancels obsolete movement prompts without touching nutrition or medication', async () => {
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([
      { identifier: 'engagement:movement:old', content: { data: {} } },
      { identifier: 'engagement:nutrition:old', content: { data: {} } },
      { identifier: 'medication:old', content: { data: {} } },
    ] as Awaited<
      ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
    >);
  await reconcileMovementEngagementReminders({
    identity,
    enabled: false,
    candidates: [],
  });
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(
    1
  );
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'engagement:movement:old'
  );
});

it('opens the timer once for a current same-account tap and rejects stale or cross-account taps', async () => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  initMovementEngagementResponses();
  const listener = jest.mocked(
    Notifications.addNotificationResponseReceivedListener
  ).mock.calls[0][0];
  const response = {
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: {
      request: {
        identifier: 'engagement:movement:server-A:user-A:today',
        content: {
          data: {
            version: 1,
            serverConfigId: identity.serverConfigId,
            userId: identity.userId,
            candidateId: `movement:break:${getTodayDate()}`,
          },
        },
      },
    },
  } as Notifications.NotificationResponse;
  listener({
    ...response,
    notification: {
      ...response.notification,
      request: {
        ...response.notification.request,
        content: {
          ...response.notification.request.content,
          data: {
            ...response.notification.request.content.data,
            userId: 'user-B',
          },
        },
      },
    },
  });
  listener({
    ...response,
    notification: {
      ...response.notification,
      request: {
        ...response.notification.request,
        content: {
          ...response.notification.request.content,
          data: {
            ...response.notification.request.content.data,
            candidateId: 'movement:break:old',
          },
        },
      },
    },
  });
  await Promise.resolve();
  expect(Linking.openURL).not.toHaveBeenCalled();
  listener(response);
  listener(response);
  await Promise.resolve();
  await Promise.resolve();
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  expect(Linking.openURL).toHaveBeenCalledWith(
    'sparkyfitnessmobile://movement-break'
  );
});
