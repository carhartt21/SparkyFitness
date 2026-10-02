import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WellnessScreen from '../../src/screens/WellnessScreen';
import { useServerConnection } from '../../src/hooks';
import * as api from '../../src/services/api/dailyTrackingApi';

jest.mock('../../src/hooks', () => ({ useServerConnection: jest.fn() }));
jest.mock('../../src/hooks/useRefetchOnFocus', () => ({
  useRefetchOnFocus: jest.fn(),
}));
jest.mock('../../src/services/api/dailyTrackingApi', () => ({
  listHabits: jest.fn(),
  listHabitLogs: jest.fn(),
  createHabit: jest.fn(),
  logHabit: jest.fn(),
  updateHabit: jest.fn(),
  deleteHabit: jest.fn(),
}));

const goBack = jest.fn();
function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })
      }
    >
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <WellnessScreen
          navigation={{ goBack } as never}
          route={{
            key: 'wellness',
            name: 'Wellness',
            params: { date: '2026-10-01' },
          }}
        />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useServerConnection).mockReturnValue({
    isConnected: true,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  jest.mocked(api.listHabits).mockResolvedValue([]);
  jest.mocked(api.listHabitLogs).mockResolvedValue([]);
});

it('opens on the selected day, changes the logging date, and returns to More', async () => {
  const screen = mount();
  await screen.findByLabelText('Log Sauna');
  expect(api.listHabitLogs).toHaveBeenCalledWith(
    '2026-09-02',
    '2026-10-01',
    undefined
  );
  fireEvent.press(screen.getByTestId('wellness-previous-day'));
  await waitFor(() =>
    expect(api.listHabitLogs).toHaveBeenCalledWith(
      '2026-09-01',
      '2026-09-30',
      undefined
    )
  );
  fireEvent.press(screen.getByTestId('wellness-back'));
  expect(goBack).toHaveBeenCalledTimes(1);
});

it('explains an unavailable connection without exposing logging controls', () => {
  jest.mocked(useServerConnection).mockReturnValue({
    isConnected: false,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  const screen = mount();
  expect(screen.getByText('Wellness needs your server')).toBeTruthy();
  expect(screen.queryByLabelText('Log Sauna')).toBeNull();
  expect(api.listHabits).not.toHaveBeenCalled();
});
