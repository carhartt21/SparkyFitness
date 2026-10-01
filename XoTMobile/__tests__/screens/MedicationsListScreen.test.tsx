import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MedicationsListScreen from '../../src/screens/MedicationsListScreen';
import { useMedications } from '../../src/hooks/useMedications';
import type { MedicationDetail, MedicationSchedule } from '@workspace/shared';
import type { RootStackScreenProps } from '../../src/types/navigation';

type ScreenProps = RootStackScreenProps<'MedicationsList'>;

jest.mock('../../src/hooks/useMedications', () => ({
  useMedications: jest.fn(),
}));

jest.mock('../../src/components/Icon', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }: { name: string }) => <View testID={`icon-${name}`} />,
  };
});

jest.mock('../../src/components/BottomSheetPicker', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    __esModule: true,
    default: ({
      options,
      onSelect,
    }: {
      options: { label: string; value: string }[];
      onSelect: (value: string) => void;
    }) => (
      <View>
        {options.map((option) => (
          <Pressable
            key={option.value}
            testID={`category-${option.value}`}
            onPress={() => onSelect(option.value)}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

jest.mock('uniwind', () => ({
  useCSSVariable: (keys: string | string[]) =>
    Array.isArray(keys) ? keys.map(() => '#111827') : '#111827',
}));

const mockNavigation = {
  setOptions: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
  dispatch: jest.fn(),
} as unknown as ScreenProps['navigation'];
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

const mockUseMedications = useMedications as jest.MockedFunction<
  typeof useMedications
>;

function buildSchedule(
  overrides: Partial<MedicationSchedule> = {}
): MedicationSchedule {
  return {
    id: 'sched-1',
    medication_id: 'med-1',
    schedule_type_id: 'daily',
    time_of_day: '08:00',
    dose_amount: null,
    days_of_week: null,
    interval_days: null,
    day_of_month: null,
    cycle_on_days: null,
    cycle_off_days: null,
    prn_reason: null,
    prn_max_per_day: null,
    with_meal: null,
    start_date: '2026-07-01',
    end_date: null,
    active: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function buildMedication(
  overrides: Partial<MedicationDetail> = {}
): MedicationDetail {
  return {
    id: 'med-1',
    user_id: 'user-1',
    name: 'Lisinopril',
    display_name: null,
    type_id: 'pill',
    route_id: null,
    strength_value: 10,
    strength_unit: 'mg',
    dose_amount: 1,
    dose_unit: 'tablet',
    reason_text: null,
    effectiveness_rating: null,
    color: null,
    icon: null,
    photo_path: null,
    is_active: true,
    is_quick: false,
    is_glp1: false,
    notes: null,
    source: 'manual',
    custom_fields: {},
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    schedules: [buildSchedule()],
    ...overrides,
  };
}

function setupScreen(medications: MedicationDetail[]) {
  mockUseMedications.mockReturnValue({
    data: medications,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useMedications>);

  const route = {
    key: 'MedicationsList-test',
    name: 'MedicationsList',
    params: undefined,
  } as ScreenProps['route'];

  const insets = { top: 0, left: 0, right: 0, bottom: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return render(
    <SafeAreaProvider initialMetrics={{ insets, frame }}>
      <MedicationsListScreen route={route} navigation={mockNavigation} />
    </SafeAreaProvider>
  );
}

describe('MedicationsListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists active medications with a dose and schedule summary', () => {
    const screen = setupScreen([buildMedication()]);

    expect(screen.getByText('Lisinopril')).toBeTruthy();
    expect(screen.getByText('1 tablet · Daily at 08:00')).toBeTruthy();
    expect(screen.queryByText(/Inactive/)).toBeNull();
  });

  it('opens the detail screen when a row is tapped', () => {
    const screen = setupScreen([buildMedication()]);

    fireEvent.press(screen.getByText('Lisinopril'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MedicationDetail', {
      medicationId: 'med-1',
    });
  });

  it('collapses inactive medications behind a disclosure row', () => {
    const screen = setupScreen([
      buildMedication(),
      buildMedication({ id: 'med-2', name: 'Old Med', is_active: false }),
      buildMedication({ id: 'med-3', name: 'Older Med', is_active: false }),
    ]);

    expect(screen.getByText('Inactive (2)')).toBeTruthy();
    expect(screen.queryByText('Old Med')).toBeNull();

    fireEvent.press(screen.getByText('Inactive (2)'));
    expect(screen.getByText('Old Med')).toBeTruthy();
    expect(screen.getByText('Older Med')).toBeTruthy();

    fireEvent.press(screen.getByText('Inactive (2)'));
    expect(screen.queryByText('Old Med')).toBeNull();
  });

  it('still shows the disclosure row when every medication is inactive', () => {
    const screen = setupScreen([buildMedication({ is_active: false })]);

    expect(screen.queryByText('No medications or supplements yet')).toBeNull();
    expect(screen.getByText('Inactive (1)')).toBeTruthy();

    fireEvent.press(screen.getByText('Inactive (1)'));
    expect(screen.getByText('Lisinopril')).toBeTruthy();
  });

  it('shows the empty state with a working add button when there are no medications', () => {
    const screen = setupScreen([]);

    expect(screen.getByText('No medications or supplements yet')).toBeTruthy();
    fireEvent.press(screen.getByText('Add Medication'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MedicationForm', {});
  });

  it('filters by the saved category rather than item names and creates supplements from that view', () => {
    const screen = setupScreen([
      buildMedication({
        id: 'ordinary',
        name: 'Vitamin D',
        is_supplement: false,
      }),
      buildMedication({
        id: 'supplement',
        name: 'Recorded supplement',
        is_supplement: true,
      }),
    ]);
    fireEvent.press(screen.getByTestId('category-supplements'));
    expect(screen.queryByText('Vitamin D')).toBeNull();
    expect(screen.getByText('Recorded supplement')).toBeTruthy();
    fireEvent.press(screen.getByTestId('category-medications'));
    expect(screen.getByText('Vitamin D')).toBeTruthy();
    expect(screen.queryByText('Recorded supplement')).toBeNull();
    fireEvent.press(screen.getByTestId('category-all'));
    expect(screen.getByText('Recorded supplement')).toBeTruthy();
  });

  it('offers supplement creation in an empty supplement category', () => {
    const screen = setupScreen([buildMedication()]);
    fireEvent.press(screen.getByTestId('category-supplements'));
    expect(screen.getByText('No items in this category')).toBeTruthy();
    fireEvent.press(screen.getByText('Add supplement'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MedicationForm', {
      supplement: true,
    });
  });

  it('offers a retry that refetches on error', () => {
    const refetch = jest.fn();
    mockUseMedications.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useMedications>);

    const route = {
      key: 'MedicationsList-test',
      name: 'MedicationsList',
      params: undefined,
    } as ScreenProps['route'];
    const screen = render(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
          frame: { x: 0, y: 0, width: 390, height: 844 },
        }}
      >
        <MedicationsListScreen route={route} navigation={mockNavigation} />
      </SafeAreaProvider>
    );

    expect(
      screen.getByText('Could not load medications and supplements.')
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });
});
