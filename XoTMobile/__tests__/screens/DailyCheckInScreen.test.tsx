import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useAppPreferencesStore,
  __resetAppPreferencesStoreForTests,
} from '../../src/stores/appPreferencesStore';
import DailyCheckInScreen from '../../src/screens/DailyCheckInScreen';
import {
  useDailyCheckin,
  useHealthContextPeriods,
  useSaveDailyCheckin,
} from '../../src/hooks/useDailyTracking';

type ScreenProps = React.ComponentProps<typeof DailyCheckInScreen>;

const beforeRemoveListeners = new Set<() => void>();
const goBack = jest.fn(() => {
  for (const listener of beforeRemoveListeners) listener();
});
const navigation = {
  goBack,
  navigate: jest.fn(),
  addListener: jest.fn((_event: string, listener: () => void) => {
    beforeRemoveListeners.add(listener);
    return () => beforeRemoveListeners.delete(listener);
  }),
} as unknown as ScreenProps['navigation'];
const route = {
  key: 'DailyCheckIn-1',
  name: 'DailyCheckIn',
  params: { date: '2026-09-28' },
} as unknown as ScreenProps['route'];

jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(async () => ({
    serverConfigId: 'tag-server',
    userId: 'tag-user',
  })),
  subscribeNutritionIdentity: () => () => {},
}));

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
    __resetAppPreferencesStoreForTests();
    beforeRemoveListeners.clear();
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

  it('keeps a created tag when deselected and on reopening without saving it as an answer', async () => {
    const screen = renderScreen();
    await waitFor(() =>
      expect(useAppPreferencesStore.persist.hasHydrated()).toBe(true)
    );
    // Allow the account identity promise to settle before tag creation.
    await waitFor(() =>
      expect(screen.getByTestId('daily-checkin-add-tag')).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId('daily-checkin-add-tag'));
    fireEvent.changeText(
      screen.getByTestId('daily-checkin-custom-tag'),
      '  Eigener Test  '
    );
    fireEvent(screen.getByTestId('daily-checkin-custom-tag'), 'endEditing');
    await waitFor(() =>
      expect(screen.getByTestId('daily-checkin-tag-Eigener Test')).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId('daily-checkin-tag-Eigener Test'));
    expect(
      screen.getByTestId('daily-checkin-tag-Eigener Test').props
        .accessibilityState.checked
    ).toBe(false);
    fireEvent.press(screen.getByTestId('daily-checkin-overall-4'));
    fireEvent.press(screen.getByTestId('daily-checkin-complete'));
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalled());
    expect(save.mutateAsync.mock.calls[0][0].tags).toEqual([]);
    screen.unmount();
    const reopened = renderScreen();
    await waitFor(() =>
      expect(
        reopened.getByTestId('daily-checkin-tag-Eigener Test')
      ).toBeTruthy()
    );
    fireEvent.press(reopened.getByTestId('daily-checkin-tag-Eigener Test'));
    expect(
      reopened.getByTestId('daily-checkin-tag-Eigener Test').props
        .accessibilityState.checked
    ).toBe(true);
  });

  it('uses the native submitted text when the final keystroke has not rendered yet', async () => {
    const screen = renderScreen();
    await waitFor(() =>
      expect(screen.getByTestId('daily-checkin-add-tag')).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId('daily-checkin-add-tag'));
    fireEvent.changeText(
      screen.getByTestId('daily-checkin-custom-tag'),
      'Eigener Tes'
    );
    fireEvent(screen.getByTestId('daily-checkin-custom-tag'), 'endEditing', {
      nativeEvent: { text: 'Eigener Test' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('daily-checkin-tag-Eigener Test')).toBeTruthy()
    );
    expect(screen.queryByTestId('daily-checkin-tag-Eigener Tes')).toBeNull();
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
    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(save.mutate).not.toHaveBeenCalled();
  });

  it('skips without sending any answers', async () => {
    const screen = renderScreen();
    fireEvent.press(screen.getByTestId('daily-checkin-overall-2'));
    fireEvent.press(screen.getByTestId('daily-checkin-skip'));
    await waitFor(() => expect(skip.mutateAsync).toHaveBeenCalledWith());
    expect(save.mutateAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(save.mutate).not.toHaveBeenCalled();
  });

  it('retains an unfinished draft on ordinary back navigation', () => {
    const screen = renderScreen();
    fireEvent.press(screen.getByTestId('daily-checkin-overall-2'));
    goBack();
    expect(save.mutate).toHaveBeenCalledTimes(1);
    expect(save.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'draft', overall_day: 2 })
    );
  });

  it('allows retry after a failed completion without losing answers', async () => {
    save.mutateAsync.mockRejectedValueOnce(new Error('offline'));
    const screen = renderScreen();
    fireEvent.press(screen.getByTestId('daily-checkin-overall-4'));
    fireEvent.press(screen.getByTestId('daily-checkin-complete'));
    await waitFor(() => expect(save.mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(goBack).not.toHaveBeenCalled());
    fireEvent.press(screen.getByTestId('daily-checkin-complete'));
    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(save.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'completed', overall_day: 4 })
    );
    expect(save.mutate).not.toHaveBeenCalled();
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
