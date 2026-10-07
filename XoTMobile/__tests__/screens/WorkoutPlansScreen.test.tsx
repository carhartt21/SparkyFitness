import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import WorkoutPlansScreen from '../../src/screens/WorkoutPlansScreen';
import type { WorkoutPlanTemplate } from '../../src/types/workoutPlans';

const mockStart = jest.fn();
let mockConnected = true;
const plan: WorkoutPlanTemplate = {
  id: '41',
  user_id: 'owner',
  plan_name: 'Week',
  start_date: '2026-10-01',
  is_active: true,
  schedule_type: 'weekly',
  assignments: [
    {
      id: '102',
      template_id: '41',
      day_of_week: 3,
      sort_order: 0,
      activity_type: 'strength',
      sets: [],
    },
    {
      id: '103',
      template_id: '41',
      day_of_week: 3,
      sort_order: 1,
      activity_type: 'rest',
      sets: [],
    },
  ],
};
jest.mock('../../src/hooks', () => ({
  useServerConnection: () => ({ isConnected: mockConnected }),
}));
jest.mock('../../src/hooks/useWorkoutPlans', () => ({
  useWorkoutPlans: () => ({
    data: [plan],
    refetch: jest.fn(),
    remove: { isPending: false },
  }),
}));
jest.mock('../../src/hooks/useStartWorkoutPlanAssignment', () => ({
  useStartWorkoutPlanAssignment: () => mockStart,
}));
jest.mock('../../src/components/WeeklyTrainingItinerary', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/components/DailyDetailScreen', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) => <View>{children}</View>,
  };
});

const renderScreen = () =>
  render(
    <WorkoutPlansScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{ params: { date: '2026-10-07' } } as never}
    />
  );
beforeEach(() => {
  jest.clearAllMocks();
  mockConnected = true;
  mockStart.mockResolvedValue(undefined);
});

it('offers live routine start and separate activity logging, but no action for rest', async () => {
  const view = renderScreen();
  await act(async () => {
    fireEvent.press(view.getByText('Start routine'));
  });
  expect(mockStart).toHaveBeenLastCalledWith(
    plan,
    plan.assignments?.[0],
    'routine'
  );
  await act(async () => {
    fireEvent.press(view.getByText('Log activity'));
  });
  expect(mockStart).toHaveBeenLastCalledWith(
    plan,
    plan.assignments?.[0],
    'activity'
  );
  expect(view.queryByTestId('weekly-routine-start-103')).toBeNull();
});

it('blocks both actions when disconnected', () => {
  mockConnected = false;
  const view = renderScreen();
  fireEvent.press(view.getByText('Start routine'));
  fireEvent.press(view.getByText('Log activity'));
  expect(mockStart).not.toHaveBeenCalled();
});

it('prevents a second start or log while the first action is pending', async () => {
  let release: (() => void) | undefined;
  mockStart.mockReturnValue(
    new Promise<void>((resolve) => {
      release = resolve;
    })
  );
  const view = renderScreen();
  fireEvent.press(view.getByTestId('weekly-routine-start-102'));
  fireEvent.press(view.getByTestId('weekly-routine-start-102'));
  fireEvent.press(view.getByTestId('weekly-activity-log-102'));
  expect(mockStart).toHaveBeenCalledTimes(1);
  await act(async () => release?.());
});
