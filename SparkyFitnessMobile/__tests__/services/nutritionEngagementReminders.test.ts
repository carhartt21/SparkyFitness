import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { reconcileNutritionEngagementReminders } from '../../src/services/nutritionEngagementReminders';
import { initNutritionEngagementResponses } from '../../src/services/nutritionEngagementReminders';
import { hasNotificationPermission } from '../../src/services/notifications';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { getTodayDate } from '../../src/utils/dateUtils';
import type { ReminderCandidate } from '../../src/services/healthEngagementPolicy';

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
  NUTRITION_CAPTURE_ACTION: 'engagement-take-photo',
  NUTRITION_CAPTURE_CATEGORY: 'engagement-nutrition-capture',
  NUTRITION_REVIEW_ACTION: 'engagement-review-photos',
  NUTRITION_REVIEW_CATEGORY: 'engagement-nutrition-review',
}));

const identity = { serverConfigId: 'server-A', userId: 'user-A' };
const tomorrow = Date.now() + 86_400_000;
const candidate: ReminderCandidate = {
  id: 'nutrition:capture:2026-09-24:selected',
  domain: 'nutrition',
  kind: 'capture',
  preferredAt: tomorrow,
  earliestAt: tomorrow,
  expiresAt: tomorrow + 3_600_000,
  flexibilityMinutes: 0,
};

beforeEach(() => {
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

it('schedules one scoped capture request and leaves other reminder families intact', async () => {
  await reconcileNutritionEngagementReminders({
    identity,
    enabled: true,
    candidates: [candidate],
  });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  const request = jest.mocked(Notifications.scheduleNotificationAsync).mock
    .calls[0][0];
  expect(request.identifier).toContain('server-A:user-A');
  expect(request.content.data).toMatchObject({
    serverConfigId: 'server-A',
    userId: 'user-A',
    candidateId: candidate.id,
  });
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
});

it('schedules a distinct review prompt without recording or changing the capture action', async () => {
  await reconcileNutritionEngagementReminders({
    identity,
    enabled: true,
    candidates: [
      { ...candidate, id: 'nutrition:review:2026-09-24', kind: 'review' },
    ],
  });
  const request = jest.mocked(Notifications.scheduleNotificationAsync).mock
    .calls[0][0];
  expect(request.content.categoryIdentifier).toBe(
    'engagement-nutrition-review'
  );
  expect(request.content.data?.candidateId).toBe('nutrition:review:2026-09-24');
});

it('cancels an obsolete nutrition prompt but never a medication request', async () => {
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([
      { identifier: 'engagement:nutrition:old', content: { data: {} } },
      { identifier: 'med_2026-09-23_schedule', content: { data: {} } },
    ] as Awaited<
      ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
    >);
  await reconcileNutritionEngagementReminders({
    identity,
    enabled: true,
    candidates: [],
  });
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(
    1
  );
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'engagement:nutrition:old'
  );
});

it('does not reschedule an unchanged request on repeated reconciliation', async () => {
  const identifier = `engagement:nutrition:server-A:user-A:${candidate.id}`;
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([
      { identifier, content: { data: { scheduledAt: candidate.preferredAt } } },
    ] as Awaited<
      ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
    >);
  await reconcileNutritionEngagementReminders({
    identity,
    enabled: true,
    candidates: [candidate],
  });
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('dismisses only obsolete delivered nutrition prompts after local capture', async () => {
  jest
    .mocked(Notifications.getPresentedNotificationsAsync)
    .mockResolvedValue([
      { request: { identifier: 'engagement:nutrition:old' } },
      { request: { identifier: 'med_2026-09-23_schedule' } },
    ] as Awaited<
      ReturnType<typeof Notifications.getPresentedNotificationsAsync>
    >);
  await reconcileNutritionEngagementReminders({
    identity,
    enabled: true,
    candidates: [],
  });
  expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(
    'engagement:nutrition:old'
  );
});

it('rejects cross-account responses and deduplicates repeated camera actions', async () => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  initNutritionEngagementResponses();
  const listener = jest.mocked(
    Notifications.addNotificationResponseReceivedListener
  ).mock.calls[0][0];
  const response = {
    actionIdentifier: 'engagement-take-photo',
    notification: {
      request: {
        identifier: 'engagement:nutrition:server-A:user-A:photo',
        content: {
          data: {
            version: 1,
            serverConfigId: identity.serverConfigId,
            userId: identity.userId,
            candidateId: `nutrition:capture:${getTodayDate()}:selected`,
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
  await Promise.resolve();
  expect(Linking.openURL).not.toHaveBeenCalled();
  listener(response);
  listener(response);
  await Promise.resolve();
  await Promise.resolve();
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  expect(Linking.openURL).toHaveBeenCalledWith(
    'sparkyfitnessmobile://meal-photo'
  );
  listener({
    ...response,
    actionIdentifier: 'engagement-review-photos',
    notification: {
      ...response.notification,
      request: {
        ...response.notification.request,
        identifier: 'engagement:nutrition:server-A:user-A:review',
        content: {
          ...response.notification.request.content,
          data: {
            ...response.notification.request.content.data,
            candidateId: `nutrition:review:${getTodayDate()}`,
          },
        },
      },
    },
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(Linking.openURL).toHaveBeenCalledWith('sparkyfitnessmobile://diary');
});
