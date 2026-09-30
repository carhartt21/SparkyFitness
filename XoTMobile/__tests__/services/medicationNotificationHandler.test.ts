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
          data: { medicationId: 'm1', scheduleId: 's1', entryDate: DATE },
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
