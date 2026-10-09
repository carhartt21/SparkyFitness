jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({ preferences: { timezone: 'Europe/Berlin' } }),
}));
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Medication } from '@workspace/shared';
import AdditionalSupplementIntake from '../../src/components/AdditionalSupplementIntake';
const mockSave = jest.fn();
const mockRemove = jest.fn();
jest.mock('../../src/hooks/useMedications', () => ({
  useCreateMedicationEntry: () => ({ isPending: false, mutateAsync: mockSave }),
  useDeleteMedicationEntry: () => ({ isPending: false, mutate: mockRemove }),
}));
jest.mock('../../src/utils/dateUtils', () => ({
  getTodayDate: () => '2026-10-05',
  getDeviceTimezone: () => 'Europe/Berlin',
}));
jest.mock('../../src/components/TimeSheet', () => ({
  __esModule: true,
  default: () => null,
  dateToTimeString: () => '14:25',
}));
jest.mock('../../src/components/BottomSheetPicker', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onSelect }: { onSelect: (id: string) => void }) => (
      <Pressable
        testID="choose-supplement"
        onPress={() => onSelect('electrolytes')}
      >
        <Text>Electrolytes</Text>
      </Pressable>
    ),
    PickerTrigger: () => null,
  };
});
const supplements = [
  {
    id: 'electrolytes',
    name: 'Electrolytes',
    dose_amount: 1,
    dose_unit: 'dose',
    is_supplement: true,
  },
] as Medication[];
const form = (date = '2026-10-04') => {
  const screen = render(
    <AdditionalSupplementIntake
      supplements={supplements}
      entries={[]}
      date={date}
    />
  );
  fireEvent.press(screen.getByTestId('supplements-log-extra'));
  return screen;
};
beforeEach(() => {
  jest.useFakeTimers({
    now: new Date('2026-10-05T12:25:00Z'),
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
    ],
  });
  jest.clearAllMocks();
  mockSave.mockResolvedValue({ id: 'extra' });
});
afterEach(() => jest.useRealTimers());
it('records the explicit amount and local intake time, separate from scheduled adherence', async () => {
  const screen = form();
  fireEvent.press(screen.getByTestId('choose-supplement'));
  fireEvent.changeText(screen.getByTestId('supplements-extra-amount'), '2,5');
  fireEvent.press(screen.getByTestId('supplements-extra-save'));
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith({
      medication_id: 'electrolytes',
      schedule_id: null,
      status: 'prn_taken',
      entry_date: '2026-10-04',
      taken_at: '2026-10-04T12:25:00.000Z',
      dose_amount_snapshot: 2.5,
      dose_unit_snapshot: 'dose',
      source: 'manual',
    })
  );
  expect(supplements[0].dose_amount).toBe(1);
  await waitFor(() =>
    expect(screen.queryByTestId('supplements-extra-form')).toBeNull()
  );
});
it('retains the entered amount after failure and prevents duplicate in-flight taps', async () => {
  let reject!: (error: Error) => void;
  mockSave.mockImplementation(
    () =>
      new Promise((_, rejectPromise) => {
        reject = rejectPromise;
      })
  );
  const screen = form();
  fireEvent.press(screen.getByTestId('choose-supplement'));
  fireEvent.changeText(screen.getByTestId('supplements-extra-amount'), '3');
  fireEvent.press(screen.getByTestId('supplements-extra-save'));
  fireEvent.press(screen.getByTestId('supplements-extra-save'));
  expect(mockSave).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('Offline')));
  expect(screen.getByTestId('supplements-extra-amount').props.value).toBe('3');
  expect(screen.getByRole('alert')).toBeTruthy();
});
it.each(['0', '-1', 'invalid'])(
  'does not record invalid quantity %s',
  (amount) => {
    const screen = form();
    fireEvent.press(screen.getByTestId('choose-supplement'));
    fireEvent.changeText(
      screen.getByTestId('supplements-extra-amount'),
      amount
    );
    fireEvent.press(screen.getByTestId('supplements-extra-save'));
    expect(mockSave).not.toHaveBeenCalled();
  }
);
it('does not confirm future-day intake', () => {
  const screen = form('2026-10-06');
  expect(screen.queryByTestId('supplements-extra-form')).toBeNull();
  expect(mockSave).not.toHaveBeenCalled();
});
