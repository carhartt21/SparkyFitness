import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { useManualDoseLogging } from '../../src/hooks/useManualDoseLogging';
import type { DueDose } from '../../src/utils/medications';
const mockLog = jest.fn();
const mockToggle = jest.fn();
const mockPrn = jest.fn();
const mockPresent = jest.fn();
let mockConfirm: (time: string) => void | boolean;
let mockExisting: { status: string } | undefined;
jest.mock('../../src/hooks/useMedications', () => ({
  useLogDose: () => ({
    entryForDue: () => mockExisting,
    logDose: mockLog,
    toggleTaken: mockToggle,
    logPrn: mockPrn,
    isPending: false,
  }),
}));
jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({ preferences: { timezone: 'Europe/Berlin' } }),
}));
jest.mock('../../src/components/TimeSheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: React.forwardRef(
      (props: { onSelectTime: typeof mockConfirm }, ref) => {
        React.useEffect(() => {
          mockConfirm = props.onSelectTime;
        }, [props.onSelectTime]);
        React.useImperativeHandle(ref, () => ({ present: mockPresent }));
        return null;
      }
    ),
  };
});
const dose = {
  medication: { id: 'supp', is_supplement: true },
  schedule: { id: 'slot' },
} as DueDose;
function useMountedLogging() {
  const logging = useManualDoseLogging('2026-10-08', []);
  React.useEffect(() => {
    /* Hook result is rendered by a separate host below. */
  }, []);
  return logging;
}
function Host({
  logging,
}: {
  logging: ReturnType<typeof useManualDoseLogging>;
}) {
  return <>{logging.timeSheet}</>;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockExisting = undefined;
});
it('opens at fresh current account time, writes nothing on cancel and confirms only once', () => {
  const { result } = renderHook(useMountedLogging);
  const { render } =
    require('@testing-library/react-native') as typeof import('@testing-library/react-native');
  render(<Host logging={result.current} />);
  act(() => result.current.logDose(dose, 'taken'));
  expect(mockPresent).toHaveBeenCalledWith(
    expect.stringMatching(/^\d{2}:\d{2}$/)
  );
  expect(mockLog).not.toHaveBeenCalled();
  act(() => mockConfirm('08:15'));
  expect(mockLog).toHaveBeenCalledWith(
    dose,
    'taken',
    '2026-10-08T06:15:00.000Z'
  );
  act(() => mockConfirm('08:15'));
  expect(mockLog).toHaveBeenCalledTimes(1);
});
it('keeps medication quick actions, skipped doses and recorded-dose undo immediate', () => {
  const { result } = renderHook(useMountedLogging);
  const medication = {
    ...dose,
    medication: { ...dose.medication, is_supplement: false },
  };
  act(() => result.current.logDose(medication, 'taken'));
  expect(mockLog).toHaveBeenCalledWith(medication, 'taken');
  act(() => result.current.logDose(dose, 'skipped'));
  expect(mockLog).toHaveBeenCalledWith(dose, 'skipped');
  mockExisting = { status: 'taken' };
  act(() => result.current.toggleTaken(dose));
  expect(mockToggle).toHaveBeenCalledWith(dose);
  expect(mockPresent).not.toHaveBeenCalled();
});
