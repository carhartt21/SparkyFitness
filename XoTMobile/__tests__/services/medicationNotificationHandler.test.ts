import * as Notifications from 'expo-notifications';
import { initMedicationNotificationActions } from '../../src/services/medicationNotificationHandler';
import {
  addNotificationResponseListener,
  dismissDeliveredNotification,
  MEDICATION_TAKEN_ACTION,
} from '../../src/services/notifications';
import {
  createEntry,
  listEntries,
} from '../../src/services/api/medicationsApi';
import { queryClient } from '../../src/hooks/queryClient';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { enqueuePlannedSupplementAction } from '../../src/services/nutritionActionOutbox';
import { reconcileNutritionActions } from '../../src/services/nutritionActionSync';

jest.mock('../../src/services/notifications', () => ({
  addNotificationResponseListener: jest.fn(),
  dismissDeliveredNotification: jest.fn(async () => undefined),
  MEDICATION_TAKEN_ACTION: 'MEDICATION_TAKEN',
  MEDICATION_SKIP_ACTION: 'MEDICATION_SKIP',
  SUPPLEMENT_GROUP_CATEGORY: 'supplement-reminder-group',
  SUPPLEMENT_GROUP_REVIEW_ACTION: 'supplement-group-review',
}));

jest.mock('../../src/services/api/medicationsApi', () => ({
  createEntry: jest.fn(),
  listEntries: jest.fn(),
}));

jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionOutbox', () => ({
  enqueuePlannedSupplementAction: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionSync', () => ({
  reconcileNutritionActions: jest.fn(),
}));

const DATE = '2026-08-12';

type ResponseListener = (response: unknown) => void;

function takenResponse() {
  return {
    actionIdentifier: MEDICATION_TAKEN_ACTION,
    notification: {
      request: {
        identifier: 'notif-1',
        content: {
          data: {
            medicationId: 'm1',
            scheduleId: 's1',
            entryDate: DATE,
          } as Record<string, string>,
        },
      },
    },
  };
}

/**
 * A dose marked Taken from an OS reminder never touches a React hook, so the entry
 * mutations' invalidation cannot run for it. Mobile queries have an infinite stale time,
 * so the miss is silent: the app resumes onto a dashboard that keeps showing pre-dose
 * calories until something else forces a refetch.
 */
describe('logging a dose from a notification action', () => {
  let spy: jest.SpyInstance;
  let listener: ResponseListener;

  // The handler latches on first call, so it registers exactly one listener per module
  // instance. Capture it up front rather than re-initialising per test.
  beforeAll(() => {
    initMedicationNotificationActions();
    listener = (addNotificationResponseListener as jest.Mock).mock
      .calls[0]?.[0] as ResponseListener;
    if (!listener)
      throw new Error('no notification response listener registered');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (
      Notifications.getAllScheduledNotificationsAsync as jest.Mock
    ).mockResolvedValue([]);
    (
      Notifications.getPresentedNotificationsAsync as jest.Mock
    ).mockResolvedValue([]);
    spy = jest
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation(() => undefined as never);
    (listEntries as jest.Mock).mockResolvedValue([]);
    (createEntry as jest.Mock).mockResolvedValue({ id: 'e1' });
    (getActiveNutritionIdentity as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      serverConfigId: 'server-1',
    });
    (enqueuePlannedSupplementAction as jest.Mock).mockResolvedValue({
      clientOperationId: 'op-1',
    });
    (reconcileNutritionActions as jest.Mock).mockResolvedValue({
      processed: 1,
      nextDelayMs: null,
    });
  });

  afterEach(() => spy.mockRestore());

  const fireTakenAction = async () => {
    listener(takenResponse());
    // The listener dispatches the write without awaiting it.
    await new Promise(process.nextTick);
  };

  const invalidatedKeys = () =>
    spy.mock.calls
      .map(([arg]) => (arg as { queryKey?: readonly unknown[] })?.queryKey)
      .filter(Array.isArray);

  const invalidatedPrefix = (...prefix: unknown[]) =>
    invalidatedKeys().some((key) =>
      prefix.every((segment, index) => key[index] === segment)
    );

  it('invalidates the daily summary, which carries the dose nutrition', async () => {
    await fireTakenAction();

    expect(createEntry).toHaveBeenCalledTimes(1);
    expect(invalidatedPrefix('dailySummary')).toBe(true);
  });

  it('invalidates the entry and medication lists the action also moved', async () => {
    await fireTakenAction();

    expect(invalidatedPrefix('medications', 'entries')).toBe(true);
    expect(invalidatedPrefix('medications')).toBe(true);
  });

  it.each([MEDICATION_TAKEN_ACTION, 'MEDICATION_SKIP'])(
    'clears only the same intake chain after %s, including delivered follow-ups',
    async (actionIdentifier) => {
      const ownData = {
        baseKey: 'dose-1',
        accountUserId: 'user-1',
        serverConfigId: 'server-1',
      };
      const otherData = { ...ownData, baseKey: 'dose-2' };
      const otherAccount = { ...ownData, accountUserId: 'user-2' };
      (
        Notifications.getAllScheduledNotificationsAsync as jest.Mock
      ).mockResolvedValue([
        { identifier: 'repeat-1', content: { data: ownData } },
        { identifier: 'other-dose', content: { data: otherData } },
        { identifier: 'other-account', content: { data: otherAccount } },
      ]);
      (
        Notifications.getPresentedNotificationsAsync as jest.Mock
      ).mockResolvedValue([
        {
          request: {
            identifier: 'delivered-repeat',
            content: { data: ownData },
          },
        },
        {
          request: {
            identifier: 'delivered-other',
            content: { data: otherData },
          },
        },
        {
          request: {
            identifier: 'delivered-other-account',
            content: { data: otherAccount },
          },
        },
      ]);
      const response = takenResponse();
      response.actionIdentifier = actionIdentifier;
      response.notification.request.content.data = {
        ...response.notification.request.content.data,
        ...ownData,
      };
      listener(response);
      await new Promise(process.nextTick);
      expect(createEntry).toHaveBeenCalledTimes(1);
      expect(createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          status:
            actionIdentifier === MEDICATION_TAKEN_ACTION ? 'taken' : 'skipped',
        })
      );
      expect(
        Notifications.cancelScheduledNotificationAsync
      ).toHaveBeenCalledTimes(1);
      expect(
        Notifications.cancelScheduledNotificationAsync
      ).toHaveBeenCalledWith('repeat-1');
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(
        'delivered-repeat'
      );
    }
  );

  it('stops remaining follow-ups when the intake was already recorded', async () => {
    (listEntries as jest.Mock).mockResolvedValue([
      { medication_id: 'm1', schedule_id: 's1', status: 'taken' },
    ]);
    (
      Notifications.getAllScheduledNotificationsAsync as jest.Mock
    ).mockResolvedValue([
      { identifier: 'repeat-2', content: { data: { baseKey: 'dose-1' } } },
    ]);
    const response = takenResponse();
    response.notification.request.content.data = {
      ...response.notification.request.content.data,
      baseKey: 'dose-1',
    };
    listener(response);
    await new Promise(process.nextTick);
    expect(createEntry).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'repeat-2'
    );
  });

  it('keeps a successful intake saved when native cleanup cannot be read', async () => {
    (
      Notifications.getAllScheduledNotificationsAsync as jest.Mock
    ).mockRejectedValueOnce(new Error('unavailable'));
    (
      Notifications.getPresentedNotificationsAsync as jest.Mock
    ).mockRejectedValueOnce(new Error('unavailable'));
    const response = takenResponse();
    response.notification.request.content.data = {
      ...response.notification.request.content.data,
      baseKey: 'dose-1',
    };
    listener(response);
    await new Promise(process.nextTick);
    expect(createEntry).toHaveBeenCalledTimes(1);
    expect(dismissDeliveredNotification).toHaveBeenCalledWith('notif-1');
  });

  it('durably queues a supplement action before dismissing its reminder', async () => {
    listener({
      ...takenResponse(),
      notification: {
        request: {
          identifier: 'supplement-notif',
          content: {
            data: {
              medicationId: 'm1',
              scheduleId: 's1',
              entryDate: DATE,
              isSupplement: 'true',
              accountUserId: 'user-1',
              serverConfigId: 'server-1',
            },
          },
        },
      },
    });
    await new Promise(process.nextTick);
    await new Promise(process.nextTick);
    expect(enqueuePlannedSupplementAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        medicationId: 'm1',
        scheduleId: 's1',
        status: 'taken',
      })
    );
    expect(dismissDeliveredNotification).toHaveBeenCalledWith(
      'supplement-notif'
    );
    expect(createEntry).not.toHaveBeenCalled();
    expect(reconcileNutritionActions).toHaveBeenCalled();
  });

  it('leaves a supplement reminder visible when the account changed or storage fails', async () => {
    (getActiveNutritionIdentity as jest.Mock).mockResolvedValueOnce({
      userId: 'other-user',
      serverConfigId: 'server-1',
    });
    const response = takenResponse();
    response.notification.request.content.data = {
      medicationId: 'm1',
      scheduleId: 's1',
      entryDate: DATE,
      isSupplement: 'true',
      accountUserId: 'user-1',
      serverConfigId: 'server-1',
    };
    listener(response);
    await new Promise(process.nextTick);
    expect(enqueuePlannedSupplementAction).not.toHaveBeenCalled();
    expect(dismissDeliveredNotification).not.toHaveBeenCalled();

    (enqueuePlannedSupplementAction as jest.Mock).mockRejectedValueOnce(
      new Error('storage unavailable')
    );
    listener(response);
    await new Promise(process.nextTick);
    expect(dismissDeliveredNotification).not.toHaveBeenCalled();
  });
});
