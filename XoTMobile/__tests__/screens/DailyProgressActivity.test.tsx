import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DailyProgressScreen from '../../src/screens/DailyProgressScreen';
const mockMutate = jest.fn();
const mockRefetch = jest.fn();
const mockOpen = jest.fn();
let mockState = 'pending';
let mockRevision = 5;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({ preferences: {} }),
}));
jest.mock('../../src/hooks', () => ({
  useServerConnection: () => ({ isConnected: true }),
}));
jest.mock('../../src/hooks/useProjectedDailyProgress', () => ({
  useProjectedDailyProgress: () => ({
    progress: {
      date: '2026-10-02',
      percent: null,
      applicable: 0,
      completed: 0,
      coverage: { activity: { applicable: 0, completed: 0 } },
      items: [
        {
          id: 'workout:1:2:2026-10-02',
          domain: 'activity',
          activity_type: 'running',
          label: 'running',
          date: '2026-10-02',
          state: mockState,
          applicable: false,
          optional: true,
          reference_id: 'plan',
          reason: 'optional',
        },
      ],
    },
    refetch: mockRefetch,
  }),
}));
jest.mock('../../src/hooks/useActivityPlanning', () => ({
  useActivityPlanning: () => ({
    query: {
      data: {
        occurrences: [
          {
            id: 'workout:1:2:2026-10-02',
            source: 'workout',
            state: mockState,
            revision: mockRevision,
          },
        ],
      },
      refetch: mockRefetch,
    },
    mutation: { mutateAsync: mockMutate, isPending: false },
  }),
}));
jest.mock('../../src/hooks/useProgressActions', () => ({
  PROGRESS_DOMAIN_ORDER: ['activity'],
  useProgressActions: () => ({
    itemLabel: () => 'Running',
    openItem: mockOpen,
  }),
}));
jest.mock('../../src/components/tracking/TrackingScreen', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});
jest.mock('../../src/components/WeeklyActivityOverview', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/components/brand/ProgressTrackX', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('uniwind', () => ({
  useCSSVariable: (keys: string[]) => keys.map(() => '#aabbcc'),
}));
const props = {
  route: {
    name: 'DailyProgress',
    key: 'goals',
    params: { date: '2026-10-02' },
  },
  navigation: { goBack: jest.fn(), navigate: jest.fn() },
};
beforeEach(() => {
  jest.clearAllMocks();
  mockState = 'pending';
  mockRevision = 5;
  mockMutate.mockResolvedValue({});
});
it('exposes revisioned skip and undo beside an optional goal without changing recording navigation', async () => {
  const view = render(<DailyProgressScreen {...props} />);
  expect(view.getByText('Optional')).toBeTruthy();
  expect(view.getByText(/No counted tasks/)).toBeTruthy();
  expect(view.queryByText(/Nothing is scheduled/)).toBeNull();
  const action = view.getByTestId(
    'daily-progress-resolve-workout:1:2:2026-10-02'
  );
  fireEvent.press(action);
  await waitFor(() =>
    expect(mockMutate).toHaveBeenCalledWith({
      occurrence_id: 'workout:1:2:2026-10-02',
      expected_revision: 5,
      action: 'skip',
    })
  );
  mockState = 'excluded';
  mockRevision = 6;
  view.rerender(<DailyProgressScreen {...props} />);
  fireEvent.press(
    view.getByTestId('daily-progress-resolve-workout:1:2:2026-10-02')
  );
  await waitFor(() =>
    expect(mockMutate).toHaveBeenLastCalledWith({
      occurrence_id: 'workout:1:2:2026-10-02',
      expected_revision: 6,
      action: 'undo',
    })
  );
  fireEvent.press(
    view.getByTestId('daily-progress-item-workout:1:2:2026-10-02')
  );
  expect(mockOpen).toHaveBeenCalled();
});
it('shows an actionable refresh explanation after a conflict and never fabricates completion', async () => {
  mockMutate.mockRejectedValueOnce(new Error('revision conflict'));
  const view = render(<DailyProgressScreen {...props} />);
  fireEvent.press(
    view.getByTestId('daily-progress-resolve-workout:1:2:2026-10-02')
  );
  await waitFor(() =>
    expect(
      view.getByText(
        'The status could not be saved. Refresh goals and try again.'
      )
    ).toBeTruthy()
  );
  expect(view.queryByText('Complete')).toBeNull();
});
