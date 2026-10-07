import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ActivityPlanningResponse } from '@workspace/shared';
import WeeklyActivityOverview from '../../src/components/WeeklyActivityOverview';
import { useActivityPlanning } from '../../src/hooks/useActivityPlanning';
jest.mock('../../src/hooks/useActivityPlanning');
jest.mock('../../src/localization', () => ({
  ...jest.requireActual<typeof import('../../src/localization')>(
    '../../src/localization'
  ),
  useAppLocale: () => 'en',
}));
jest.mock('../../src/components/ui/Button', () => {
  const {
    Text,
    Pressable,
  }: typeof import('react-native') = require('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
const load = jest.mocked(useActivityPlanning);
const mutate = jest.fn().mockResolvedValue({});
const refetch = jest.fn();
const data: ActivityPlanningResponse = {
  start_date: '2026-09-28',
  end_date: '2026-10-04',
  timezone: 'UTC',
  occurrences: [
    {
      id: 'workout:1:2:2026-10-01',
      date: '2026-10-01',
      source: 'workout',
      source_id: '1',
      assignment_id: 2,
      revision: 0,
      label: 'Evening walk',
      plan_label: 'Movement',
      activity_type: 'walking',
      state: 'pending',
      reason: 'not_recorded',
      recorded_at: null,
      evidence_ids: [],
      expected_sets: 1,
      completed_sets: 0,
    },
  ],
  records: [],
  summary: [],
  workout_plans: [],
  note: '',
};
const result = () =>
  ({
    query: {
      data,
      isPending: false,
      isError: false,
      isFetching: false,
      refetch,
    },
    mutation: { isPending: false, mutateAsync: mutate },
  }) as unknown as ReturnType<typeof useActivityPlanning>;
beforeEach(() => {
  jest.clearAllMocks();
  load.mockReturnValue(result());
});
it('uses the selected week and makes revision checked decisions', async () => {
  const open = jest.fn();
  const view = render(
    <WeeklyActivityOverview date="2026-10-01" enabled onOpen={open} />
  );
  expect(load).toHaveBeenCalledWith('2026-09-28', '2026-10-04', true);
  fireEvent.press(view.getByText('Next week'));
  expect(load).toHaveBeenLastCalledWith('2026-10-05', '2026-10-11', true);
  fireEvent.press(view.getByText('Skip activity'));
  await waitFor(() =>
    expect(mutate).toHaveBeenCalledWith({
      occurrence_id: data.occurrences[0].id,
      expected_revision: 0,
      action: 'skip',
    })
  );
  fireEvent.press(view.getByText('Open Diary'));
  expect(open).toHaveBeenCalledWith('workout', '2026-10-01');
});
it('keeps failures visible and offers retry', () => {
  load.mockReturnValue({
    ...result(),
    query: { ...result().query, isError: true },
  } as ReturnType<typeof useActivityPlanning>);
  const view = render(
    <WeeklyActivityOverview date="2026-10-01" enabled onOpen={jest.fn()} />
  );
  expect(
    view.getByText('Activities could not be loaded. Try again.')
  ).toBeTruthy();
  fireEvent.press(view.getByText('Try again'));
  expect(refetch).toHaveBeenCalled();
});
it('shows single-session progress below the planned target instead of implying no workout was logged', () => {
  const response = result();
  load.mockReturnValue({
    ...response,
    query: {
      ...response.query,
      data: {
        ...data,
        occurrences: [
          {
            ...data.occurrences[0],
            state: 'started',
            reason: 'partial_activity_targets',
            target_progress: {
              duration_minutes: 35.3,
              target_duration_minutes: 45,
              distance_km: null,
              target_distance_km: null,
            },
          },
        ],
      },
    },
  } as ReturnType<typeof useActivityPlanning>);
  const view = render(
    <WeeklyActivityOverview date="2026-10-01" enabled onOpen={jest.fn()} />
  );
  expect(view.getByText('Movement · Partly confirmed')).toBeTruthy();
  expect(view.getByText('35.3 of 45 min')).toBeTruthy();
});
