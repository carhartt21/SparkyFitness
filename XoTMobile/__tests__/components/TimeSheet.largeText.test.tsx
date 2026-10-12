import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { setWheelTime } from '../helpers/timeWheel';
import TimeSheet, { type TimeSheetRef } from '../../src/components/TimeSheet';

jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({ preferences: { time_format: 'h:mm A' } }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BottomSheetModal: React.forwardRef<
      TimeSheetRef,
      React.PropsWithChildren<{ accessible?: boolean }>
    >(({ children, accessible }, ref) => {
      React.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: jest.fn(),
      }));
      return (
        <View testID="time-modal" accessible={accessible}>
          {children}
        </View>
      );
    }),
    BottomSheetView: ({ children }: React.PropsWithChildren) => (
      <View>{children}</View>
    ),
    BottomSheetScrollView: ({ children }: React.PropsWithChildren) => (
      <View>{children}</View>
    ),
  };
});

afterEach(() => jest.restoreAllMocks());

it('uses independently labelled hour/minute selectors at enlarged text and commits a valid 24-hour time', () => {
  jest
    .spyOn(
      jest.requireActual<typeof import('react-native')>('react-native'),
      'useWindowDimensions'
    )
    .mockReturnValue({ width: 430, height: 932, scale: 3, fontScale: 3 });
  const ref = React.createRef<TimeSheetRef>();
  const onSelect = jest.fn();
  const screen = render(
    <TimeSheet
      ref={ref}
      value="07:30"
      onSelectTime={onSelect}
      commitOn="done"
      timeFormat="HH:mm"
    />
  );
  act(() => ref.current?.present());
  expect(screen.queryByTestId('date-picker')).toBeNull();
  expect(screen.getByLabelText('Hours').props.accessibilityValue.now).toBe(7);
  expect(screen.getByLabelText('Minutes').props.accessibilityValue.now).toBe(
    30
  );
  expect(screen.getByTestId('time-modal').props.accessible).toBe(false);
  setWheelTime(screen.getByLabelText, '23:59');
  expect(screen.getByLabelText('Hours').props.accessibilityValue.now).toBe(23);
  expect(screen.getByLabelText('Minutes').props.accessibilityValue.now).toBe(
    59
  );
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Done'));
  expect(onSelect).toHaveBeenCalledWith('23:59');
});
