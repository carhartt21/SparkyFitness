import React from 'react';
import { fireEvent, render, renderHook } from '@testing-library/react-native';
import type { Habit, DailyProgressItem } from '@workspace/shared';
import { useDiaryScheduledEntries } from '../../src/hooks/useDiaryScheduledEntries';
const mockProgress = jest.fn();
const mockHabit = jest.fn();
const mockOpen = jest.fn();
jest.mock('../../src/hooks/useProjectedDailyProgress', () => ({
  useProjectedDailyProgress: () => ({
    progress: { items: mockProgress() },
    isError: false,
    refetch: jest.fn(),
  }),
}));
jest.mock('../../src/hooks/useActivityPlanning', () => ({
  useActivityPlanning: () => ({
    query: {
      data: { occurrences: [], workout_plans: [] },
      isError: false,
      refetch: jest.fn(),
    },
  }),
}));
jest.mock('../../src/hooks/useProgressActions', () => ({
  useProgressActions: () => ({
    itemLabel: (item: { id: string }) => item.id,
    openItem: mockOpen,
  }),
}));
jest.mock('../../src/hooks/useDailyTracking', () => ({
  useLogHabit: () => ({ isPending: false, isError: false, mutate: mockHabit }),
}));
jest.mock('../../src/hooks/useMedications', () => ({
  useLogDose: () => ({ entryForDue: () => undefined, logDose: jest.fn() }),
}));
jest.mock('../../src/utils/dateUtils', () => ({
  getTodayDate: () => '2026-10-05',
}));
const habit = {
  id: 'h',
  habit_type: 'completion',
  reminder_time: '09:30',
} as Habit;
const item = (overrides: Partial<DailyProgressItem> = {}) =>
  ({
    id: 'habit:h',
    domain: 'habit',
    reference_id: 'h',
    state: 'pending',
    recorded_at: null,
    ...overrides,
  }) as DailyProgressItem;
const hook = (day = '2026-10-05', habits = [habit]) =>
  renderHook(() =>
    useDiaryScheduledEntries(
      day,
      true,
      'Europe/Berlin',
      habits,
      [],
      [],
      jest.fn()
    )
  ).result.current;
beforeEach(() => {
  jest.clearAllMocks();
  mockProgress.mockReturnValue([item()]);
});
it('positions a configured habit by its reminder time and records only an explicit tap', () => {
  const result = hook();
  expect(result.entries[0].clock).toBe('09:30');
  expect(mockHabit).not.toHaveBeenCalled();
  const control = render(<>{result.entries[0].accessory}</>);
  fireEvent.press(control.getByRole('checkbox'));
  expect(mockHabit).toHaveBeenCalledWith({
    habitId: 'h',
    body: { entry_date: '2026-10-05', value: true },
  });
});
it('shows future plans without confirming future intake or habit completion', () => {
  const result = hook('2026-10-06');
  const control = render(<>{result.entries[0].accessory}</>);
  fireEvent.press(control.getByRole('checkbox'));
  expect(mockHabit).not.toHaveBeenCalled();
  expect(control.getByRole('checkbox').props.accessibilityState.disabled).toBe(
    true
  );
});
it('shows only actual recorded habit/check-in items on past days, without invented occurrence time for backfills', () => {
  mockProgress.mockReturnValue([
    item(),
    item({
      id: 'habit:recorded',
      recorded_at: '2026-10-05T08:00:00Z',
      state: 'complete',
    }),
    item({ id: 'planned-workout', domain: 'workout' }),
  ]);
  const result = hook('2026-10-04');
  expect(result.entries.map((row) => row.id)).toEqual(['task:habit:recorded']);
  expect(result.entries[0].timestamp).toBeNull();
});
it('shows the recorded 24-hour local time when a past occurrence has a same-day timestamp', () => {
  mockProgress.mockReturnValue([
    item({ recorded_at: '2026-10-04T18:45:00Z', state: 'complete' }),
  ]);
  expect(hook('2026-10-04').entries[0].clock).toBe('20:45');
});
it('takes count-based habits to real quantity entry instead of fabricating a completion count', () => {
  const result = hook('2026-10-05', [
    { ...habit, habit_type: 'count' } as Habit,
  ]);
  expect(result.entries[0].accessory).toBeUndefined();
  const control = render(<>{result.entries[0].content}</>);
  fireEvent.press(control.getByRole('button'));
  expect(mockOpen).toHaveBeenCalledWith(item());
  expect(mockHabit).not.toHaveBeenCalled();
});
it('avoids duplicating recorded workouts or pending goals/meal/intake placeholders', () => {
  mockProgress.mockReturnValue([
    item({ domain: 'workout', state: 'complete' }),
    item({ domain: 'meal' }),
    item({ domain: 'supplement' }),
    item({ domain: 'goal' }),
  ]);
  expect(hook().entries).toEqual([]);
});
