import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Habit } from '@workspace/shared';
import HabitsScreen from '../../src/screens/HabitsScreen';
import {
  useHabits,
  useHabitLogs,
  useLogHabit,
} from '../../src/hooks/useDailyTracking';
jest.mock('../../src/hooks', () => ({
  useServerConnection: () => ({ isConnected: true }),
  usePreferences: () => ({ preferences: {} }),
}));
jest.mock('../../src/hooks/useDailyTracking', () => ({
  useHabits: jest.fn(),
  useHabitLogs: jest.fn(),
  useLogHabit: jest.fn(),
  useDailyTrackingPreferences: () => ({ data: {} }),
}));
jest.mock('../../src/components/CalendarSheet', () => ({
  __esModule: true,
  default: jest.requireActual('react').forwardRef(() => null),
}));
jest.mock('../../src/components/brand/ProgressTrackX', () => () => null);
const habit = (id: string): Habit => ({
  id,
  name: `Synthetic ${id}`,
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
});
type Props = React.ComponentProps<typeof HabitsScreen>;
const mutate = jest.fn();
const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
} as unknown as Props['navigation'];
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, bottom: 34, left: 0, right: 0 },
    }}
  >
    {children}
  </SafeAreaProvider>
);
const route = (params: Props['route']['params']): Props['route'] => ({
  key: 'synthetic-habits',
  name: 'Habits',
  params,
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useHabits).mockReturnValue({
    data: [habit('a'), habit('b')],
    isLoading: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useHabits>);
  jest
    .mocked(useHabitLogs)
    .mockReturnValue({ data: [], refetch: jest.fn() } as unknown as ReturnType<
      typeof useHabitLogs
    >);
  jest
    .mocked(useLogHabit)
    .mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<
      typeof useLogHabit
    >);
});
it('opens all rows from a focused shortcut, shows a read-only cue and does not record completion', () => {
  const v = render(
    <HabitsScreen
      navigation={navigation}
      route={route({ date: '2030-02-01', habitId: 'a' })}
    />,
    { wrapper }
  );
  expect(v.getByTestId('habit-row-a')).toBeTruthy();
  expect(v.getByTestId('habit-row-b')).toBeTruthy();
  expect(v.getByTestId('entry-focus-context')).toBeTruthy();
  expect(v.queryByText('Show all')).toBeNull();
  expect(mutate).not.toHaveBeenCalled();
  fireEvent.press(v.getByTestId('habit-done-b'));
  expect(mutate).toHaveBeenCalledWith(
    { habitId: 'b', body: { entry_date: '2030-02-01', value: true } },
    expect.any(Object)
  );
});
it('does not hide rows for missing focus and updates mounted route context without a mutation', () => {
  const v = render(
    <HabitsScreen
      navigation={navigation}
      route={route({ date: '2030-02-01', habitId: 'missing' })}
    />,
    { wrapper }
  );
  expect(v.queryByTestId('entry-focus-context')).toBeNull();
  expect(v.getByTestId('habit-row-b')).toBeTruthy();
  v.rerender(
    <HabitsScreen
      navigation={navigation}
      route={route({ date: '2030-02-02', habitId: 'b' })}
    />
  );
  expect(v.getByText('Selected: Synthetic b')).toBeTruthy();
  expect(mutate).not.toHaveBeenCalled();
});
