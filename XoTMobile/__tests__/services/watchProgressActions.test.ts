import AsyncStorage from '@react-native-async-storage/async-storage';
import { completeWatchProgress } from '../../src/services/watchProgressActions';
import {
  getDailyProgress,
  listHabits,
  logHabit,
  setMealDayStatus,
} from '../../src/services/api/dailyTrackingApi';
import { isCurrentWatchActionScope } from '../../src/services/watchActionScope';
import type {
  DailyProgress,
  DailyProgressItem,
  Habit,
} from '@workspace/shared';

jest.mock('../../src/services/api/dailyTrackingApi');
jest.mock('../../src/services/watchActionScope');
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: async () => ({
    serverConfigId: 'server',
    userId: 'user',
  }),
}));
jest.mock('../../src/utils/dateUtils', () => ({
  getTodayDate: () => '2026-10-02',
}));
const read = jest.mocked(getDailyProgress);
const habits = jest.mocked(listHabits);
const write = jest.mocked(logHabit);
const mealWrite = jest.mocked(setMealDayStatus);
const scope = jest.mocked(isCurrentWatchActionScope);
const action = {
  clientId: 'd760a056-7cb3-407b-a0f2-072a881b988b',
  scope: '["server","user"]',
  entryDate: '2026-10-02',
  itemId: 'habit:synthetic',
  capturedAt: '2026-10-02T08:00:00Z',
  expectedRecordedAt: null,
};
const item: DailyProgressItem = {
  id: action.itemId,
  domain: 'habit',
  label: 'Synthetic habit',
  date: action.entryDate,
  applicable: true,
  state: 'pending',
  reference_id: '38759a72-0971-4d61-aa6d-21df0d6862ef',
  recorded_at: null,
  reason: 'not_recorded',
};
const habit = {
  id: item.reference_id,
  habit_type: 'completion',
  active: true,
  category: 'habit',
} as Habit;
function snapshot(row: DailyProgressItem = item) {
  read.mockResolvedValue({
    date: action.entryDate,
    items: [row],
  } as DailyProgress);
}
beforeEach(async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-02T09:00:00Z'));
  jest.clearAllMocks();
  read.mockReset();
  habits.mockReset();
  write.mockReset();
  mealWrite.mockReset();
  scope.mockReset();
  await AsyncStorage.clear();
  scope.mockResolvedValue(true);
  snapshot();
  habits.mockResolvedValue([habit]);
  write.mockResolvedValue(null);
});
afterEach(() => jest.useRealTimers());
it('serializes duplicate delivery, pins identity and never replays over a later undo', async () => {
  expect(
    await Promise.all([
      completeWatchProgress(action),
      completeWatchProgress(action),
    ])
  ).toEqual([true, true]);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith(
    item.reference_id,
    { entry_date: action.entryDate, value: true },
    { serverConfigId: 'server', userId: 'user' }
  );
  snapshot({ ...item, state: 'started', recorded_at: '2026-10-02T09:01:00Z' });
  expect(await completeWatchProgress(action)).toBe(true);
  expect(write).toHaveBeenCalledTimes(1);
});
it('does not blindly retry an uncertain write and reconciles a confirmed save', async () => {
  write.mockRejectedValueOnce(new Error('response lost'));
  expect(await completeWatchProgress(action)).toBe(false);
  expect(await completeWatchProgress(action)).toBe(false);
  expect(write).toHaveBeenCalledTimes(1);
  snapshot({ ...item, state: 'complete' });
  expect(await completeWatchProgress(action)).toBe(true);
  expect(write).toHaveBeenCalledTimes(1);
});
it('retries a failed read before any write intent exists', async () => {
  read.mockRejectedValueOnce(new Error('offline'));
  expect(await completeWatchProgress(action)).toBe(false);
  expect(await completeWatchProgress(action)).toBe(true);
  expect(write).toHaveBeenCalledTimes(1);
});
it.each([
  { entryDate: '2026-10-01' },
  { clientId: 'bad' },
  { capturedAt: '2026-10-02T12:00:00Z' },
  { capturedAt: '2026-09-30T08:00:00Z' },
  { scope: '' },
])('rejects invalid, old-day and future captures: %o', async (override) => {
  expect(await completeWatchProgress({ ...action, ...override })).toBe(false);
  expect(write).not.toHaveBeenCalled();
});
it('rejects departed accounts before reads and again before writing', async () => {
  scope.mockResolvedValue(false);
  expect(await completeWatchProgress(action)).toBe(false);
  expect(read).not.toHaveBeenCalled();
  scope
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);
  expect(await completeWatchProgress(action)).toBe(false);
  expect(write).not.toHaveBeenCalled();
});
it.each([
  'supplement',
  'activity',
  'workout',
  'measurement',
  'goal',
  'checkin',
] as const)('does not fabricate %s completion', async (domain) => {
  snapshot({ ...item, domain });
  expect(await completeWatchProgress(action)).toBe(false);
  expect(write).not.toHaveBeenCalled();
  expect(mealWrite).not.toHaveBeenCalled();
});
it('rejects count habits, excluded tasks, stale source state and reused IDs with different input', async () => {
  habits.mockResolvedValue([{ ...habit, habit_type: 'count' }]);
  expect(await completeWatchProgress(action)).toBe(false);
  habits.mockResolvedValue([habit]);
  snapshot({ ...item, state: 'excluded', applicable: false });
  expect(await completeWatchProgress(action)).toBe(false);
  snapshot({ ...item, recorded_at: '2026-10-02T08:01:00Z' });
  expect(await completeWatchProgress(action)).toBe(false);
  snapshot();
  expect(await completeWatchProgress(action)).toBe(true);
  expect(await completeWatchProgress({ ...action, itemId: 'changed' })).toBe(
    false
  );
  expect(write).toHaveBeenCalledTimes(1);
});
it('sets only the explicit meal state and fails closed if receipt storage fails', async () => {
  snapshot({ ...item, domain: 'meal' });
  expect(await completeWatchProgress(action)).toBe(true);
  expect(mealWrite).toHaveBeenCalledWith(
    {
      entry_date: action.entryDate,
      meal_type_id: item.reference_id,
      status: 'complete',
    },
    { serverConfigId: 'server', userId: 'user' }
  );
  expect(write).not.toHaveBeenCalled();
  await AsyncStorage.clear();
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('disk full'));
  expect(await completeWatchProgress(action)).toBe(false);
  expect(mealWrite).toHaveBeenCalledTimes(1);
});
