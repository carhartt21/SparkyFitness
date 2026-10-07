import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import DailyTrainingScreen from '../../src/screens/DailyTrainingScreen';
import TrainingSummaryCard from '../../src/components/TrainingSummaryCard';
const mockDailyRetry = jest.fn(),
  mockMobilityRetry = jest.fn(),
  mockPlanningRetry = jest.fn();
let mockFailed = true;
jest.mock('../../src/hooks', () => ({
  useServerConnection: () => ({ isConnected: true }),
}));
jest.mock('../../src/hooks/useDailyTraining', () => ({
  useDailyTraining: () => ({
    daily: {
      summary: {},
      isLoading: false,
      isError: false,
      refetch: mockDailyRetry,
    },
    mobility: {
      sessions: [],
      isLoading: false,
      isError: mockFailed,
      refetch: mockMobilityRetry,
    },
    planning: {
      query: {
        data: { workout_plans: [] },
        isSuccess: true,
        isError: false,
        refetch: mockPlanningRetry,
      },
    },
    sessions: [],
    planned: [],
    count: 2,
    minutes: 30,
    timezone: 'Europe/Berlin',
    distanceUnit: 'km',
  }),
}));
jest.mock('../../src/components/DailyDetailScreen', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) => <View>{children}</View>,
  };
});
jest.mock('../../src/components/MobilityDiarySection', () => ({
  __esModule: true,
  default: () => null,
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockFailed = true;
});
it('withholds exact combined Home totals when mobility cannot be read', () => {
  const view = render(
    <TrainingSummaryCard date="2026-10-07" enabled onPress={jest.fn()} />
  );
  expect(
    view.getByText('Some training data could not be refreshed.')
  ).toBeTruthy();
  expect(view.queryByText(/2 sessions/)).toBeNull();
  mockFailed = false;
  view.rerender(
    <TrainingSummaryCard date="2026-10-07" enabled onPress={jest.fn()} />
  );
  expect(view.getByText('2 sessions · 30 min')).toBeTruthy();
});
it('retries the failed mobility read from the daily summary, rather than just refreshing nutrition', () => {
  const view = render(
    <DailyTrainingScreen
      navigation={{ navigate: jest.fn() } as never}
      route={{ params: { date: '2026-10-07' } } as never}
    />
  );
  expect(view.queryByTestId('daily-training-summary')).toBeNull();
  fireEvent.press(view.getAllByText('Retry')[0]);
  expect(mockMobilityRetry).toHaveBeenCalledTimes(1);
  expect(mockDailyRetry).toHaveBeenCalledTimes(1);
});
