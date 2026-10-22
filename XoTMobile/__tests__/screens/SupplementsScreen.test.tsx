jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({ preferences: { timezone: 'Europe/Berlin' } }),
}));
jest.mock('../../src/components/TimeSheet', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(
      (
        { onSelectTime }: { onSelectTime: (time: string) => void },
        ref: React.Ref<unknown>
      ) => {
        const [open, setOpen] = React.useState(false);
        React.useImperativeHandle(ref, () => ({
          present: () => setOpen(true),
          dismiss: () => setOpen(false),
        }));
        return open ? (
          <Pressable
            testID="confirm-intake"
            onPress={() => {
              onSelectTime('08:00');
              setOpen(false);
            }}
          >
            <Text>Confirm intake</Text>
          </Pressable>
        ) : null;
      }
    ),
  };
});
import React from 'react';
import { Alert, Dimensions } from 'react-native';
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

  it.each([1, 2])(
    'keeps a long German supplement name readable without shrinking at fontScale %s and preserves explicit intake/menu actions',
    (fontScale) => {
      const longName =
        'Magnesiumcitrat mit Vitamin B-Komplex zur Unterstützung der normalen Muskelfunktion nach dem abendlichen Spaziergang';
      const window = Dimensions.get('window');
      const screenSize = Dimensions.get('screen');
      Dimensions.set({
        window: { ...window, width: 390, fontScale },
        screen: { ...screenSize, width: 390, fontScale },
      });
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      try {
        (useMedications as jest.Mock).mockReturnValue({
          data: [
            {
              id: 'long',
              name: longName,
              is_active: true,
              is_supplement: true,
              schedules: [schedule('s-long', 'long', '08:00:00')],
            },
          ],
          isLoading: false,
          refetch: jest.fn(),
        });
        const screen = renderScreen();
        const name = screen.getByText(longName);
        if (fontScale >= 1.5) {
          expect(
            screen
              .getByTestId('supplement-name-block-s-long')
              .findAllByType(name.type)
          ).toHaveLength(1);
          expect(screen.getByTestId('supplement-actions-s-long')).toBeTruthy();
        } else {
          expect(screen.queryByTestId('supplement-actions-s-long')).toBeNull();
        }
        // Assert the actual native Text contract; Jest cannot measure glyph layout.
        expect(name.props.numberOfLines ?? 0).toBe(0);
        expect(name.props.allowFontScaling).not.toBe(false);
        expect(name.props.adjustsFontSizeToFit).not.toBe(true);
        expect(Dimensions.get('window').fontScale).toBe(fontScale);
        expect(logDose).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('supplement-menu-s-long'));
        expect(alert.mock.calls[0][0]).toBe(longName);
        expect(logDose).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('supplement-take-s-long'));
        expect(logDose).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('confirm-intake'));
        expect(logDose).toHaveBeenCalledTimes(1);
        expect(logDose).toHaveBeenCalledWith(
          expect.objectContaining({
            schedule: expect.objectContaining({ id: 's-long' }),
          }),
          'taken',
          expect.any(String)
        );
        screen.unmount();
      } finally {
        alert.mockRestore();
        Dimensions.set({ window, screen: screenSize });
      }
    }
  );

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
    expect(logDose).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('confirm-intake'));
    expect(logDose).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: expect.objectContaining({ id: 's-d3' }),
      }),
      'taken',
      expect.any(String)
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

  it('keeps every dated dose visible for a focused shortcut; cue is read-only and missing IDs never filter', () => {
    (useMedications as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'synthetic-a',
          name: 'Synthetic A',
          is_active: true,
          is_supplement: true,
          schedules: [schedule('synthetic-slot-a', 'synthetic-a', '08:00:00')],
        },
        {
          id: 'synthetic-b',
          name: 'Synthetic B',
          is_active: true,
          is_supplement: true,
          schedules: [schedule('synthetic-slot-b', 'synthetic-b', '20:00:00')],
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    const focused = {
      ...route,
      params: { date: '2026-09-28', scheduleId: 'synthetic-slot-a' },
    };
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
    const v = render(
      <SupplementsScreen navigation={navigation} route={focused} />,
      { wrapper }
    );
    expect(v.getByTestId('supplement-row-synthetic-slot-a')).toBeTruthy();
    expect(v.getByTestId('supplement-row-synthetic-slot-b')).toBeTruthy();
    expect(v.getByText('Selected: Synthetic A')).toBeTruthy();
    expect(logDose).not.toHaveBeenCalled();
    v.rerender(
      <SupplementsScreen
        navigation={navigation}
        route={{
          ...route,
          params: { date: '2026-09-29', scheduleId: 'missing' },
        }}
      />
    );
    expect(v.queryByTestId('entry-focus-context')).toBeNull();
    expect(v.getByTestId('supplement-row-synthetic-slot-b')).toBeTruthy();
    expect(logDose).not.toHaveBeenCalled();
  });
});
