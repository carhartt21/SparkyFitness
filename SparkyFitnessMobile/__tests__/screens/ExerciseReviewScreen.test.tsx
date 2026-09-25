import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import ExerciseReviewScreen from '../../src/screens/ExerciseReviewScreen';
import { fetchDailySummary } from '../../src/services/api/dailySummaryApi';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));
jest.mock('../../src/hooks', () => ({
  useServerConnection: () => ({ isConnected: true, isLoading: false }),
  usePreferences: () => ({ preferences: {} }),
}));
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => null,
}));
jest.mock('../../src/services/api/dailySummaryApi', () => ({
  fetchDailySummary: jest.fn(),
}));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));

const bucket = {
  sessions: 1,
  exerciseEntries: 1,
  distanceMeters: 0,
  durationMinutes: 0,
  liftedVolumeKg: 0,
  reps: 0,
  inferredEntries: 0,
};
const period = {
  startDate: '2026-09-21',
  endDate: '2026-09-25',
  overall: bucket,
  running: { ...bucket, sessions: 0, exerciseEntries: 0 },
  cycling: { ...bucket, sessions: 0, exerciseEntries: 0 },
  strength: bucket,
  other: { ...bucket, sessions: 0, exerciseEntries: 0 },
};
const navigation = { navigate: jest.fn() };

const renderScreen = () =>
  render(
    <ExerciseReviewScreen
      navigation={
        navigation as unknown as React.ComponentProps<
          typeof ExerciseReviewScreen
        >['navigation']
      }
      route={
        { key: 'review', name: 'ExerciseReview' } as React.ComponentProps<
          typeof ExerciseReviewScreen
        >['route']
      }
    />
  );

describe('ExerciseReviewScreen source links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useQuery as jest.Mock).mockReturnValue({
      data: {
        current: period,
        previous: period,
        adherence: {
          current: {
            startDate: '2026-09-21',
            endDate: '2026-09-25',
            elapsedDays: 4,
            coveredDays: 3,
            eligibleScheduledSessions: 2,
            attendedScheduledSessions: 1,
            adherencePercent: 50,
          },
          previous: {
            startDate: '2026-09-14',
            endDate: '2026-09-20',
            elapsedDays: 7,
            coveredDays: 7,
            eligibleScheduledSessions: 2,
            attendedScheduledSessions: 2,
            adherencePercent: 100,
          },
        },
        trend: [
          {
            startDate: '2026-09-21',
            endDate: '2026-09-21',
            running: { ...bucket, distanceMeters: 5000 },
            cycling: { ...bucket, sessions: 0, exerciseEntries: 0 },
            strength: { ...bucket, liftedVolumeKg: 800 },
          },
        ],
        sources: [
          {
            id: 'workout-1',
            type: 'preset',
            entryDate: '2026-09-23',
            name: 'Full Body',
            source: 'hevy',
          },
          {
            id: 'run-1',
            type: 'individual',
            entryDate: '2026-09-22',
            name: 'Morning Run',
            source: 'Garmin',
          },
        ],
      },
      isPending: false,
      isRefetching: false,
      isError: false,
      refetch: jest.fn(),
    });
    (fetchDailySummary as jest.Mock).mockImplementation(
      async (date: string) => ({
        exerciseSessions:
          date === '2026-09-23'
            ? [{ id: 'workout-1', type: 'preset', name: 'Full Body' }]
            : [{ id: 'run-1', type: 'individual', name: 'Morning Run' }],
      })
    );
  });

  it('opens the exact grouped workout from its source row', async () => {
    const screen = renderScreen();
    fireEvent.press(screen.getByText('Full Body'));

    await waitFor(() => {
      expect(fetchDailySummary).toHaveBeenCalledWith('2026-09-23');
      expect(navigation.navigate).toHaveBeenCalledWith('WorkoutDetail', {
        session: expect.objectContaining({ id: 'workout-1' }),
      });
    });
  });

  it('opens the exact individual activity from its source row', async () => {
    const screen = renderScreen();
    fireEvent.press(screen.getByText('Morning Run'));

    await waitFor(() => {
      expect(fetchDailySummary).toHaveBeenCalledWith('2026-09-22');
      expect(navigation.navigate).toHaveBeenCalledWith('ActivityDetail', {
        session: expect.objectContaining({ id: 'run-1' }),
      });
    });
  });

  it('shows recorded distance and strength volume in the sport trend', () => {
    const screen = renderScreen();
    expect(screen.getByText('Sport trends')).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: 'Distance' }));
    expect(screen.getByLabelText(/Distance 5 km/)).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: 'Strength' }));
    fireEvent.press(screen.getByRole('tab', { name: 'Lifted volume' }));
    expect(screen.getByLabelText(/Lifted volume 800 kg/)).toBeTruthy();
  });

  it('shows the attended plan slots and historical coverage', () => {
    const screen = renderScreen();
    expect(screen.getByText('1 of 2 attended')).toBeTruthy();
    expect(screen.getByText('50% of scheduled slots')).toBeTruthy();
    expect(
      screen.getByText(
        'Plan history is known for 3 of 4 elapsed days in this period.'
      )
    ).toBeTruthy();
  });
});
