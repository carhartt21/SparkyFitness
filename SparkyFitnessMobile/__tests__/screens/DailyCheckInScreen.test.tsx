import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DailyCheckInScreen from '../../src/screens/DailyCheckInScreen';
import {
  useDailyCheckin,
  useHealthContextPeriods,
  useSaveDailyCheckin,
} from '../../src/hooks/useDailyTracking';

type ScreenProps = React.ComponentProps<typeof DailyCheckInScreen>;

const goBack = jest.fn();
const navigation = {
  goBack,
  navigate: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
} as unknown as ScreenProps['navigation'];
const route = {
  key: 'DailyCheckIn-1',
  name: 'DailyCheckIn',
  params: { date: '2026-09-28' },
} as unknown as ScreenProps['route'];

jest.mock('../../src/hooks', () => ({
  useServerConnection: () => ({ isConnected: true, isLoading: false }),
}));
jest.mock('../../src/hooks/useDailyTracking', () => ({
  useDailyCheckin: jest.fn(),
  useHealthContextPeriods: jest.fn(),
  useSaveDailyCheckin: jest.fn(),
}));
jest.mock('../../src/components/CalendarSheet', () => {
  const { forwardRef } = jest.requireActual('react');
  return { __esModule: true, default: forwardRef(() => null) };
});

const save = { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
const skip = { mutateAsync: jest.fn(), isPending: false };
const reopen = { mutate: jest.fn() };

const renderScreen = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <DailyCheckInScreen navigation={navigation} route={route} />
    </SafeAreaProvider>
  );

describe('DailyCheckInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useDailyCheckin as jest.Mock).mockReturnValue({
      data: null,
      isSuccess: true,
      isLoading: false,
      refetch: jest.fn(),
    });
    (useHealthContextPeriods as jest.Mock).mockReturnValue({ data: [] });
    (useSaveDailyCheckin as jest.Mock).mockReturnValue({ save, skip, reopen });
    save.mutateAsync.mockResolvedValue({});
    skip.mutateAsync.mockResolvedValue({});
  });

  it('refuses to complete an empty check-in', () => {
    const screen = renderScreen();
    const complete = screen.getByTestId('daily-checkin-complete');
    expect(complete.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(complete);
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it('completes with only the answers the user gave', async () => {
    const screen = renderScreen();
    fireEvent.press(screen.getByTestId('daily-checkin-overall-4'));
    fireEvent.press(screen.getByTestId('daily-checkin-stress-2'));
    fireEvent.press(screen.getByTestId('daily-checkin-tag-busy_day'));
    fireEvent.press(screen.getByTestId('daily-checkin-complete'));
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'completed',
        overall_day: 4,
        stress: 2,
        energy: null,
        sleep_quality: null,
        tags: ['busy_day'],
        note: null,
        question_version: 1,
      })
    );
  });

  it('clears an answer when it is tapped again', async () => {
    const screen = renderScreen();
    fireEvent.press(screen.getByTestId('daily-checkin-energy-3'));
    fireEvent.press(screen.getByTestId('daily-checkin-energy-3'));
    fireEvent.press(screen.getByTestId('daily-checkin-overall-5'));
    fireEvent.press(screen.getByTestId('daily-checkin-complete'));
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].energy).toBeNull();
  });

  it('skips without sending any answers', async () => {
    const screen = renderScreen();
    fireEvent.press(screen.getByTestId('daily-checkin-overall-2'));
    fireEvent.press(screen.getByTestId('daily-checkin-skip'));
    await waitFor(() => expect(skip.mutateAsync).toHaveBeenCalledWith());
    expect(save.mutateAsync).not.toHaveBeenCalled();
  });

  it('offers to reopen a skipped day', () => {
    (useDailyCheckin as jest.Mock).mockReturnValue({
      data: {
        id: 'c',
        entry_date: '2026-09-28',
        state: 'skipped',
        question_version: 1,
        overall_day: null,
        energy: null,
        stress: null,
        sleep_quality: null,
        nutrition_on_track: null,
        activity: null,
        note: null,
        tags: [],
        completed_at: null,
        skipped_at: 't',
        updated_at: 't',
      },
      isSuccess: true,
      isLoading: false,
      refetch: jest.fn(),
    });
    const screen = renderScreen();
    fireEvent.press(screen.getByTestId('daily-checkin-reopen'));
    expect(reopen.mutate).toHaveBeenCalled();
  });

  it('shows active context without changing anything', () => {
    (useHealthContextPeriods as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'p',
          kind: 'injury',
          start_date: '2026-09-20',
          end_date: null,
          note: null,
          body_area: 'Knee',
          limitation: null,
          pause_discretionary_reminders: true,
          updated_at: 't',
        },
      ],
    });
    const screen = renderScreen();
    expect(screen.getByTestId('daily-checkin-context')).toBeTruthy();
    expect(screen.getByText(/Knee/)).toBeTruthy();
  });
});
