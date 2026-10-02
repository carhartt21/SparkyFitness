import { act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { apiFetch } from '../../src/services/api/apiClient';
import { initRemoteEngagementResponses } from '../../src/services/remoteEngagementActions';
jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'default',
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
}));
jest.mock('../../src/services/api/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(async () => ({
    userId: 'owner',
    serverConfigId: 'server',
  })),
  subscribeNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/remoteEngagement', () => ({
  getInstallationId: jest.fn(async () => 'installation'),
}));
jest.mock('../../src/services/notifications', () => ({
  REMOTE_ENGAGEMENT_SKIP: 'skip',
  REMOTE_ENGAGEMENT_SNOOZE: 'snooze',
}));
it('opens the owner inbox for a v3 coaching tap without marking an action or diary record complete', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  initRemoteEngagementResponses();
  const handle = jest.mocked(
    Notifications.addNotificationResponseReceivedListener
  ).mock.calls[0][0];
  const response = (kind: string, userId: string) =>
    ({
      actionIdentifier: 'default',
      notification: {
        request: {
          content: {
            data: {
              remoteEngagementVersion: 3,
              kind,
              occurrenceId: '00000000-0000-4000-8000-000000000001',
              userId,
              installationId: 'installation',
            },
          },
        },
      },
    }) as Notifications.NotificationResponse;
  await act(async () => {
    handle(response('coaching_digest', 'owner'));
  });
  expect(open).toHaveBeenCalledWith('sparkyfitnessmobile://coaching');
  open.mockClear();
  await act(async () => {
    handle(response('coaching_action', 'other-owner'));
  });
  expect(open).not.toHaveBeenCalled();
  expect(apiFetch).not.toHaveBeenCalled();
  open.mockRestore();
});
