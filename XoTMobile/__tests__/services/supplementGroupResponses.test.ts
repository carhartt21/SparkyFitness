import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import {
  addNotificationResponseListener,
  SUPPLEMENT_GROUP_CATEGORY,
  SUPPLEMENT_GROUP_REVIEW_ACTION,
  MEDICATION_TAKEN_ACTION,
} from '../../src/services/notifications';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { enqueuePlannedSupplementAction } from '../../src/services/nutritionActionOutbox';
import { createEntry } from '../../src/services/api/medicationsApi';

jest.mock('../../src/services/notifications', () => ({
  addNotificationResponseListener: jest.fn(),
  SUPPLEMENT_GROUP_CATEGORY: 'supplement-reminder-group',
  SUPPLEMENT_GROUP_REVIEW_ACTION: 'supplement-group-review',
  MEDICATION_TAKEN_ACTION: 'medication-taken',
  MEDICATION_SKIP_ACTION: 'medication-skip',
}));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionOutbox', () => ({
  enqueuePlannedSupplementAction: jest.fn(),
}));
jest.mock('../../src/services/api/medicationsApi', () => ({
  createEntry: jest.fn(),
  listEntries: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionSync', () => ({
  reconcileNutritionActions: jest.fn(),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

const DAY = '2026-10-04';
const data = {
  supplementGroupVersion: '1',
  isSupplement: 'true',
  entryDate: DAY,
  accountUserId: 'user-1',
  serverConfigId: 'server-1',
  triggerAt: String(new Date(2026, 9, 4, 9).getTime()),
  memberKeys: JSON.stringify([
    `med_${DAY}_a_s1_09:00`,
    `med_${DAY}_b_s2_09:00`,
  ]),
};
function response(
  action = Notifications.DEFAULT_ACTION_IDENTIFIER,
  overrides: Record<string, unknown> = {}
): Notifications.NotificationResponse {
  return {
    actionIdentifier: action,
    notification: {
      request: {
        identifier: 'group-1',
        content: {
          categoryIdentifier: SUPPLEMENT_GROUP_CATEGORY,
          data: { ...data, ...overrides },
        },
      },
    },
  } as unknown as Notifications.NotificationResponse;
}
let setReady: (ready: boolean) => void;
function start(
  ready = true
): (response: Notifications.NotificationResponse) => void {
  jest.isolateModules(() => {
    const {
      initMedicationNotificationActions,
      setSupplementReminderNavigationReady,
    } =
      require('../../src/services/medicationNotificationHandler') as typeof import('../../src/services/medicationNotificationHandler');
    setReady = setSupplementReminderNavigationReady;
    initMedicationNotificationActions();
    setReady(ready);
  });
  return jest.mocked(addNotificationResponseListener).mock.calls[0][0];
}
const flush = () => new Promise<void>((resolve) => process.nextTick(resolve));
let open: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getActiveNutritionIdentity)
    .mockResolvedValue({ serverConfigId: 'server-1', userId: 'user-1' });
  jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(null);
  open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});
afterEach(() => open.mockRestore());

it.each([
  Notifications.DEFAULT_ACTION_IDENTIFIER,
  SUPPLEMENT_GROUP_REVIEW_ACTION,
])(
  'opens the dated supplement list for %s without logging any intake',
  async (action) => {
    start()(response(action));
    await flush();
    expect(open).toHaveBeenCalledWith(
      `sparkyfitnessmobile://supplements?date=${DAY}`
    );
    expect(createEntry).not.toHaveBeenCalled();
    expect(enqueuePlannedSupplementAction).not.toHaveBeenCalled();
  }
);
it('handles the cold-start response and clears only its own consumed response', async () => {
  jest
    .mocked(Notifications.getLastNotificationResponse)
    .mockReturnValue(response());
  const listener = start();
  listener(response());
  await flush();
  expect(open).toHaveBeenCalledTimes(1);
  expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
});
it('does not consume an unrelated cold-start response', async () => {
  jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue({
    ...response(),
    notification: { request: { identifier: 'other', content: { data: {} } } },
  } as unknown as Notifications.NotificationResponse);
  start();
  await flush();
  expect(open).not.toHaveBeenCalled();
  expect(Notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
});
it('ignores a bulk Taken action on a group', async () => {
  start()(response(MEDICATION_TAKEN_ACTION));
  await flush();
  expect(open).not.toHaveBeenCalled();
  expect(createEntry).not.toHaveBeenCalled();
  expect(enqueuePlannedSupplementAction).not.toHaveBeenCalled();
});
it.each([
  { accountUserId: 'another' },
  { serverConfigId: 'another' },
  { entryDate: '2026-02-30' },
  { memberKeys: 'invalid' },
  { memberKeys: JSON.stringify(['med_a', 'med_a']) },
  { triggerAt: 'NaN' },
])('ignores a mismatched or malformed group: %j', async (invalid) => {
  start()(response(undefined, invalid));
  await flush();
  expect(open).not.toHaveBeenCalled();
});
it('collapses concurrent listener responses and alternate taps for the same alert', async () => {
  const listener = start();
  listener(response());
  listener(response(SUPPLEMENT_GROUP_REVIEW_ACTION));
  await flush();
  listener(response());
  await flush();
  expect(open).toHaveBeenCalledTimes(1);
});
it('allows retry if opening the list fails and preserves the initial response', async () => {
  open.mockRejectedValueOnce(new Error('navigation unavailable'));
  jest
    .mocked(Notifications.getLastNotificationResponse)
    .mockReturnValue(response());
  const listener = start();
  await flush();
  expect(Notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
  listener(response());
  await flush();
  expect(open).toHaveBeenCalledTimes(2);
  expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
});

it('defers a cold-start notification until navigation is ready, without losing the response', async () => {
  jest
    .mocked(Notifications.getLastNotificationResponse)
    .mockReturnValue(response());
  start(false);
  await flush();
  expect(open).not.toHaveBeenCalled();
  expect(Notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
  setReady(true);
  await flush();
  expect(open).toHaveBeenCalledWith(
    `sparkyfitnessmobile://supplements?date=${DAY}`
  );
  expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
});
