import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDashboardSnapshot } from '../../src/hooks/useDashboardSnapshot';
import { buildDailySummary } from '../../src/services/dailySummaryService';
import { summaryFixture } from '../../review/fixtures';
import * as identity from '../../src/services/nutritionIdentity';

jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
  subscribeNutritionIdentity: jest.fn(() => jest.fn()),
}));
const summary = buildDailySummary('2026-09-26', {
  ...summaryFixture,
  exerciseEntries: [],
  waterIntake: { water_ml: 1000 },
  stepCalories: 0,
});
const prefs = { energy_unit: 'kcal' as const };
const getIdentity = jest.mocked(identity.getActiveNutritionIdentity);
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  getIdentity.mockResolvedValue({ serverConfigId: 'a', userId: 'one' });
});
it('restores the last successful day after remount with no live response', async () => {
  const live = renderHook(() =>
    useDashboardSnapshot(summary.date, 'a', summary, prefs, true)
  );
  await waitFor(async () =>
    expect((await AsyncStorage.getAllKeys()).length).toBe(1)
  );
  live.unmount();
  const offline = renderHook(() =>
    useDashboardSnapshot(summary.date, 'a', undefined, undefined, false)
  );
  await waitFor(() =>
    expect(offline.result.current?.summary.calorieBalance.remaining).toBe(1400)
  );
  expect(offline.result.current?.preferences.energy_unit).toBe('kcal');
});
it('clears a saved view on identity change and never re-saves the previous live account', async () => {
  const view = renderHook(() =>
    useDashboardSnapshot(summary.date, 'a', summary, prefs, true)
  );
  await waitFor(async () =>
    expect((await AsyncStorage.getAllKeys()).length).toBe(1)
  );
  getIdentity.mockResolvedValue({ serverConfigId: 'a', userId: 'two' });
  await act(async () => {
    jest.mocked(identity.subscribeNutritionIdentity).mock.calls.at(-1)?.[0]();
  });
  await waitFor(() => expect(view.result.current).toBeNull());
  expect(await AsyncStorage.getAllKeys()).toHaveLength(1);
});
it('does not expose the previous server or date while a new cache lookup is pending', async () => {
  const view = renderHook(
    ({ server, date }) =>
      useDashboardSnapshot(date, server, summary, prefs, true),
    {
      initialProps: { server: 'a', date: summary.date },
    }
  );
  await waitFor(() => expect(view.result.current).not.toBeNull());
  getIdentity.mockImplementation(() => new Promise(() => {}));
  view.rerender({ server: 'b', date: summary.date });
  expect(view.result.current).toBeNull();
  view.rerender({ server: 'a', date: '2026-09-25' });
  expect(view.result.current).toBeNull();
});
