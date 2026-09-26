import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readDashboardSnapshot,
  saveDashboardSnapshot,
  type DashboardSnapshot,
} from '../../src/services/dashboardSnapshot';
import { buildDailySummary } from '../../src/services/dailySummaryService';
import { summaryFixture } from '../../review/fixtures';

const owner = { serverConfigId: 'server-a', userId: 'user-a' };
const snapshot = (date = '2026-09-26'): DashboardSnapshot => ({
  version: 1,
  date,
  savedAt: Date.now(),
  summary: buildDailySummary(date, {
    ...summaryFixture,
    exerciseEntries: summaryFixture.exerciseSessions,
    waterIntake: { water_ml: summaryFixture.waterIntake },
    stepCalories: 0,
  }),
  preferences: { time_format: 'HH:mm' },
});
beforeEach(async () => {
  await AsyncStorage.clear();
});

it('restores the successful summary and units only for the same account and day', async () => {
  const value = snapshot();
  await saveDashboardSnapshot(owner, value);
  expect(await readDashboardSnapshot(owner, value.date)).toEqual(value);
  expect(
    await readDashboardSnapshot({ ...owner, userId: 'other' }, value.date)
  ).toBeNull();
  expect(
    await readDashboardSnapshot(
      { ...owner, serverConfigId: 'other' },
      value.date
    )
  ).toBeNull();
  expect(await readDashboardSnapshot(owner, '2026-09-25')).toBeNull();
});
it('retains at most seven visited days and replaces a refreshed day', async () => {
  for (let day = 10; day < 18; day++)
    await saveDashboardSnapshot(owner, snapshot(`2026-09-${day}`));
  expect(await readDashboardSnapshot(owner, '2026-09-10')).toBeNull();
  const update = snapshot('2026-09-17');
  update.summary.waterConsumed = 1700;
  await saveDashboardSnapshot(owner, update);
  expect(
    (await readDashboardSnapshot(owner, update.date))?.summary.waterConsumed
  ).toBe(1700);
});
it('does not present expired or malformed storage as an empty logged day', async () => {
  const value = snapshot();
  value.savedAt = Date.now() - 8 * 86400000;
  await saveDashboardSnapshot(owner, value);
  expect(await readDashboardSnapshot(owner, value.date)).toBeNull();
  const [key] = await AsyncStorage.getAllKeys();
  await AsyncStorage.setItem(key, '{broken');
  expect(await readDashboardSnapshot(owner, value.date)).toBeNull();
});
