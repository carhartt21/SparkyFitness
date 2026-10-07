import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { Habit, DailyProgressItem, HabitLog } from '@workspace/shared';
import ProgressItemAction from '../../src/components/tracking/ProgressItemAction';
let mockConnected = true;
let mockToday = '2026-10-07';
jest.mock('@workspace/shared', () => ({
  ...jest.requireActual('@workspace/shared'),
  todayInZone: jest.fn(() => mockToday),
}));
let mockHabit: Habit;
let mockLogs: HabitLog[] = [];
let mockMeals: { meal_type_id: string; state: string }[] = [];
jest.mock('../../src/utils/dateUtils', () => ({
  ...jest.requireActual('../../src/utils/dateUtils'),
  getTodayDate: () => '2026-10-07',
}));
const mockMutate = jest.fn();
jest.mock('../../src/hooks', () => ({
  useServerConnection: () => ({ isConnected: mockConnected }),
  usePreferences: () => ({ preferences: { timezone: 'Europe/Berlin' } }),
}));
jest.mock('../../src/hooks/useDailyTracking', () => ({
  useHabits: () => ({ data: [mockHabit] }),
  useHabitLogs: () => ({ data: mockLogs }),
  useLogHabit: () => ({ mutate: mockMutate, isPending: false }),
  useMealTrackingStatus: () => ({ data: { meals: mockMeals } }),
  useSetMealStatus: () => ({ mutate: mockMutate, isPending: false }),
}));
const item = {
  id: 'habit:h1',
  domain: 'habit',
  reference_id: 'h1',
  label: 'My habit',
  state: 'pending',
  recorded_at: null,
  reason: 'test',
} as DailyProgressItem;
const props = {
  item,
  date: '2026-10-03',
  label: 'My habit',
  icon: 'habit' as const,
  color: '#ffffff',
  onOpen: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
  mockConnected = true;
  mockToday = '2026-10-07';
  mockLogs = [];
  mockMeals = [];
  mockHabit = {
    id: 'h1',
    name: 'My habit',
    habit_type: 'completion',
    description: null,
    unit: null,
    target: null,
    step: null,
    days: null,
    reminder_time: null,
    active: true,
    sort_order: 0,
    icon: null,
  };
});
it('records a completion from the action circle, independently of navigation', () => {
  const view = render(<ProgressItemAction {...props} />);
  fireEvent.press(view.getByTestId('progress-action-habit:h1'));
  expect(mockMutate).toHaveBeenCalledWith(
    { habitId: 'h1', body: { entry_date: '2026-10-03', value: true } },
    expect.any(Object)
  );
  expect(props.onOpen).not.toHaveBeenCalled();
});
it('opens a count editor without inventing a target value or auto-saving', () => {
  mockHabit = { ...mockHabit, habit_type: 'count', target: 10, unit: 'reps' };
  const view = render(<ProgressItemAction {...props} />);
  fireEvent.press(view.getByTestId('progress-action-habit:h1'));
  expect(mockMutate).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByTestId('habit-amount-h1'), '13');
  fireEvent.press(view.getByTestId('habit-save-h1'));
  expect(mockMutate).toHaveBeenCalledWith(
    { habitId: 'h1', body: { entry_date: '2026-10-03', value: 13 } },
    expect.any(Object)
  );
});
it('keeps supplement intake confirmation and calculated-goal actions in their existing flows', () => {
  const view = render(
    <ProgressItemAction
      {...props}
      item={{ ...item, id: 'supplement', domain: 'supplement' }}
    />
  );
  fireEvent.press(view.getByTestId('progress-action-supplement'));
  expect(props.onOpen).toHaveBeenCalledTimes(1);
  expect(mockMutate).not.toHaveBeenCalled();
});
it('never writes a habit offline', () => {
  mockConnected = false;
  const view = render(<ProgressItemAction {...props} />);
  fireEvent.press(view.getByTestId('progress-action-habit:h1'));
  expect(props.onOpen).toHaveBeenCalled();
  expect(mockMutate).not.toHaveBeenCalled();
});

it.each(['completion', 'count'] as const)(
  'keeps future %s habits navigable without opening a recording editor or saving',
  (habit_type) => {
    mockHabit = { ...mockHabit, habit_type };
    const view = render(<ProgressItemAction {...props} date="2026-10-08" />);
    fireEvent.press(view.getByTestId('progress-action-habit:h1'));
    expect(props.onOpen).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('habit-amount-h1')).toBeNull();
    expect(mockMutate).not.toHaveBeenCalled();
  }
);
it('opens future meal details without allowing a state change', () => {
  mockMeals = [{ meal_type_id: 'm1', state: 'pending' }];
  const view = render(
    <ProgressItemAction
      {...props}
      date="2026-10-08"
      item={{ ...item, id: 'meal:m1', reference_id: 'm1', domain: 'meal' }}
    />
  );
  fireEvent.press(view.getByTestId('progress-action-meal:m1'));
  expect(props.onOpen).toHaveBeenCalledTimes(1);
  expect(mockMutate).not.toHaveBeenCalled();
});

it('guards the selected day using the account day even when the device calendar has advanced', () => {
  mockToday = '2026-10-06';
  const view = render(<ProgressItemAction {...props} date="2026-10-07" />);
  fireEvent.press(view.getByTestId('progress-action-habit:h1'));
  expect(props.onOpen).toHaveBeenCalledTimes(1);
  expect(mockMutate).not.toHaveBeenCalled();
});
