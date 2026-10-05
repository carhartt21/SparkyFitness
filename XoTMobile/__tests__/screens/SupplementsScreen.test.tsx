import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SupplementsScreen from '../../src/screens/SupplementsScreen';
import {
  useLogDose,
  useMedicationEntries,
  useMedications,
} from '../../src/hooks/useMedications';
import { usePlannedSupplementActions } from '../../src/hooks/usePlannedSupplementActions';

type ScreenProps = React.ComponentProps<typeof SupplementsScreen>;

const navigate = jest.fn();
const navigation = {
  goBack: jest.fn(),
  navigate,
} as unknown as ScreenProps['navigation'];
const route = {
  key: 'Supplements-1',
  name: 'Supplements',
  params: { date: '2026-09-28' },
} as unknown as ScreenProps['route'];

jest.mock('../../src/hooks', () => ({
  useServerConnection: () => ({ isConnected: true, isLoading: false }),
  usePreferences: () => ({ preferences: { time_format: '24h' } }),
}));
jest.mock('../../src/hooks/useMedications', () => ({
  useMedications: jest.fn(),
  useMedicationEntries: jest.fn(),
  useLogDose: jest.fn(),
  useCreateMedicationEntry: () => ({
    isPending: false,
    mutateAsync: jest.fn(),
  }),
  useDeleteMedicationEntry: () => ({ isPending: false, mutate: jest.fn() }),
}));
jest.mock('../../src/hooks/usePlannedSupplementActions', () => ({
  usePlannedSupplementActions: jest.fn(),
}));
jest.mock('../../src/components/CalendarSheet', () => {
  const { forwardRef } = jest.requireActual('react');
  return { __esModule: true, default: forwardRef(() => null) };
});
jest.mock('../../src/components/brand/ProgressTrackX', () => () => null);
jest.mock('../../src/utils/dateUtils', () => ({
  ...jest.requireActual('../../src/utils/dateUtils'),
  getTodayDate: () => '2026-09-28',
  getDeviceTimezone: () => 'UTC',
}));

const schedule = (id: string, medicationId: string, time: string) => ({
  id,
  medication_id: medicationId,
  schedule_type_id: 'daily',
  time_of_day: time,
  start_date: '2026-01-01',
  active: true,
  with_meal: null,
});

const logDose = jest.fn();

const renderScreen = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <SupplementsScreen navigation={navigation} route={route} />
    </SafeAreaProvider>
  );

describe('SupplementsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMedicationEntries as jest.Mock).mockReturnValue({
      data: [],
      refetch: jest.fn(),
    });
    (usePlannedSupplementActions as jest.Mock).mockReturnValue({
      bySchedule: new Map(),
      storageError: false,
    });
    (useLogDose as jest.Mock).mockReturnValue({
      entryForDue: () => undefined,
      logDose,
    });
  });

  it('shows an empty state rather than 0/0 without supplements', () => {
    (useMedications as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'rx',
          name: 'Prescription X',
          is_active: true,
          is_supplement: false,
          schedules: [schedule('s-rx', 'rx', '08:00:00')],
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    const screen = renderScreen();
    expect(screen.getByTestId('supplements-empty')).toBeTruthy();
    expect(screen.queryByText('Prescription X')).toBeNull();
    expect(screen.queryByTestId('supplements-summary-count')).toBeNull();
  });

  it('groups supplements by schedule time and records taken only on tap', () => {
    (useMedications as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'd3',
          name: 'Vitamin D3',
          is_active: true,
          is_supplement: true,
          schedules: [schedule('s-d3', 'd3', '08:00:00')],
        },
        {
          id: 'mg',
          name: 'Magnesium',
          is_active: true,
          is_supplement: true,
          schedules: [schedule('s-mg', 'mg', '20:00:00')],
        },
        {
          id: 'rx',
          name: 'Prescription X',
          is_active: true,
          is_supplement: false,
          schedules: [schedule('s-rx', 'rx', '08:00:00')],
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    const screen = renderScreen();
    expect(screen.getByTestId('supplements-group-morning')).toBeTruthy();
    expect(screen.getByTestId('supplements-group-evening')).toBeTruthy();
    expect(screen.queryByText('Prescription X')).toBeNull();
    expect(
      screen.getByTestId('supplements-summary-count').props.children
    ).toEqual([0, '/', 2]);
    expect(logDose).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('supplement-take-s-d3'));
    expect(logDose).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: expect.objectContaining({ id: 's-d3' }),
      }),
      'taken'
    );
  });

  it('counts a queued local response before it syncs', () => {
    (useMedications as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'd3',
          name: 'Vitamin D3',
          is_active: true,
          is_supplement: true,
          schedules: [schedule('s-d3', 'd3', '08:00:00')],
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    (usePlannedSupplementActions as jest.Mock).mockReturnValue({
      bySchedule: new Map([
        [
          's-d3',
          {
            syncState: 'pending',
            clientOperationId: 'op',
            serverIdentity: null,
            payload: { status: 'taken' },
          },
        ],
      ]),
      storageError: false,
    });
    const screen = renderScreen();
    expect(
      screen.getByTestId('supplements-summary-count').props.children
    ).toEqual([1, '/', 1]);
  });
});
