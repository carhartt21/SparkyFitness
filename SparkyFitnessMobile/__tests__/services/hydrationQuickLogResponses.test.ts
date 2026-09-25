import * as Notifications from 'expo-notifications';
import {
  handleHydrationQuickLogResponse,
  initHydrationQuickLogResponses,
} from '../../src/services/hydrationQuickLogResponses';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import {
  enqueueManualWaterAction,
  listNutritionActions,
} from '../../src/services/nutritionActionOutbox';
import { dismissDeliveredNotification } from '../../src/services/notifications';
import { getTodayDate } from '../../src/utils/dateUtils';

jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
}));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionOutbox', () => ({
  enqueueManualWaterAction: jest.fn(),
  listNutritionActions: jest.fn(),
}));
jest.mock('../../src/services/notifications', () => ({
  HYDRATION_QUICK_LOG_ACTION: 'hydration-log-250ml',
  HYDRATION_QUICK_LOG_CATEGORY: 'hydration-quick-log',
  dismissDeliveredNotification: jest.fn(),
}));
jest.mock('../../src/utils/dateUtils', () => ({
  getTodayDate: jest.fn(),
}));

const identity = { serverConfigId: 'server-A', userId: 'user-A' };
const today = '2026-09-24';
const operationId = 'cfd1c894-124e-4c2b-8987-9f1084b22ef4';

function response(
  changes: Record<string, unknown> = {},
  actionIdentifier = 'hydration-log-250ml'
): Notifications.NotificationResponse {
  return {
    actionIdentifier,
    notification: {
      request: {
        identifier: 'water-reminder-1',
        content: {
          categoryIdentifier: 'hydration-quick-log',
          data: {
            version: 1,
            ...identity,
            entryDate: today,
            clientOperationId: operationId,
            waterMl: 250,
            ...changes,
          },
        },
      },
    },
  } as Notifications.NotificationResponse;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getTodayDate).mockReturnValue(today);
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  jest.mocked(listNutritionActions).mockResolvedValue([]);
  jest.mocked(enqueueManualWaterAction).mockResolvedValue({} as never);
  jest.mocked(dismissDeliveredNotification).mockResolvedValue();
});

it('persists one account-scoped 250 ml action with the notification operation ID', async () => {
  await handleHydrationQuickLogResponse(response());
  expect(enqueueManualWaterAction).toHaveBeenCalledWith(
    expect.objectContaining({
      ...identity,
      entryDate: today,
      waterMl: 250,
      clientOperationId: operationId,
    })
  );
  expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
  expect(dismissDeliveredNotification).toHaveBeenCalledWith('water-reminder-1');

  await handleHydrationQuickLogResponse(response());
  expect(enqueueManualWaterAction).toHaveBeenCalledTimes(1);
});

it('rejects a stale day, another account, and a default notification tap', async () => {
  await handleHydrationQuickLogResponse(response({ entryDate: '2026-09-23' }));
  await handleHydrationQuickLogResponse(response({ userId: 'user-B' }));
  await handleHydrationQuickLogResponse(response({}, 'default'));
  expect(enqueueManualWaterAction).not.toHaveBeenCalled();
});

it('recognizes an already persisted operation after a process restart', async () => {
  const secondOperation = 'ad87db50-2f04-48ba-9294-9611661422dd';
  jest.mocked(listNutritionActions).mockResolvedValue([
    {
      type: 'logManualWater',
      clientOperationId: secondOperation,
      payload: { entry_date: today, water_ml: 250 },
    } as never,
  ]);
  await handleHydrationQuickLogResponse(
    response({ clientOperationId: secondOperation })
  );
  expect(enqueueManualWaterAction).not.toHaveBeenCalled();
  expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
});

it('registers one listener', () => {
  initHydrationQuickLogResponses();
  initHydrationQuickLogResponses();
  expect(
    Notifications.addNotificationResponseReceivedListener
  ).toHaveBeenCalledTimes(1);
});
