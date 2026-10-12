import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import TimeSheet, { type TimeSheetRef } from '../../src/components/TimeSheet';
import { setWheelTime } from '../helpers/timeWheel';

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BottomSheetModal: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: jest.fn(),
      }));
      return <View testID="bottom-sheet-modal">{props.children}</View>;
    }),
    BottomSheetView: ({ children }: any) => <View>{children}</View>,
  };
});

describe('TimeSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(
        jest.requireActual<typeof import('react-native')>('react-native'),
        'useWindowDimensions'
      )
      .mockReturnValue({
        width: 390,
        height: 844,
        scale: 3,
        fontScale: 1,
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses 24-hour presentation (use12Hours=false) when preferences set time_format to HH:mm', () => {
    const queries = render(
      <TimeSheet value="13:30" onSelectTime={jest.fn()} />
    );
    expect(queries.getByLabelText('Hours').props.accessibilityValue.now).toBe(
      13
    );
  });

  it('uses 24-hour presentation for legacy 12-hour preferences', () => {
    const queries = render(
      <TimeSheet value="13:30" onSelectTime={jest.fn()} />
    );
    expect(queries.getByLabelText('Hours').props.accessibilityValue.now).toBe(
      13
    );
  });

  it('explicit timeFormat prop overrides preferences', () => {
    const queries = render(
      <TimeSheet value="13:30" onSelectTime={jest.fn()} timeFormat="HH:mm" />
    );
    expect(queries.getByLabelText('Hours').props.accessibilityValue.now).toBe(
      13
    );
  });

  it('calls onSelectTime when time changes and Done is clicked', () => {
    const onSelectTime = jest.fn();
    const ref = React.createRef<TimeSheetRef>();
    const queries = render(
      <TimeSheet ref={ref} value="13:30" onSelectTime={onSelectTime} />
    );

    act(() => {
      ref.current?.present();
    });

    setWheelTime(queries.getByLabelText, '14:45');

    expect(onSelectTime).toHaveBeenCalledWith('14:45');

    const doneButton = queries.getByText('Done');
    fireEvent.press(doneButton);

    expect(onSelectTime).toHaveBeenLastCalledWith('14:45');
  });

  it("with commitOn='done', reports only the final time when Done is pressed", () => {
    const onSelectTime = jest.fn();
    const ref = React.createRef<TimeSheetRef>();
    const queries = render(
      <TimeSheet
        ref={ref}
        value="13:30"
        onSelectTime={onSelectTime}
        commitOn="done"
      />
    );

    act(() => {
      ref.current?.present();
    });

    setWheelTime(queries.getByLabelText, '23:00');
    setWheelTime(queries.getByLabelText, '14:45');

    expect(onSelectTime).not.toHaveBeenCalled();

    fireEvent.press(queries.getByText('Done'));

    expect(onSelectTime).toHaveBeenCalledTimes(1);
    expect(onSelectTime).toHaveBeenCalledWith('14:45');
  });
});

describe('quarter-hour intake time confirmation', () => {
  it('offers quarter hours without rounding the current default and preserves a fresh open seed', () => {
    const onSelect = jest.fn();
    const ref = React.createRef<TimeSheetRef>();
    const screen = render(
      <TimeSheet
        ref={ref}
        value=""
        minuteInterval={15}
        showNow
        commitOn="done"
        onSelectTime={onSelect}
      />
    );
    act(() => ref.current?.present('14:49'));
    expect(screen.getByLabelText('Minutes').props.accessibilityValue.now).toBe(
      49
    );
    expect(onSelect).not.toHaveBeenCalled();

    setWheelTime(screen.getByLabelText, '14:15');
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Done'));
    expect(onSelect).toHaveBeenCalledWith('14:15');
    act(() => ref.current?.present('15:07'));
    expect(screen.getByLabelText('Minutes').props.accessibilityValue.now).toBe(
      7
    );
  });
});

it('keeps a rejected time open, preserves the initial value until Done, and uses exact Now', () => {
  const onSelect = jest.fn(() => false);
  const ref = React.createRef<TimeSheetRef>();
  const screen = render(
    <TimeSheet
      ref={ref}
      value="08:00"
      onSelectTime={onSelect}
      commitOn="done"
      showNow
      getCurrentTime={() => '14:49'}
      minuteInterval={15}
      errorMessage="Invalid time"
    />
  );
  act(() => ref.current?.present());
  fireEvent.press(screen.getByText('Now'));
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Done'));
  expect(onSelect).toHaveBeenCalledWith('14:49');
  expect(screen.getByRole('alert')).toBeTruthy();
});
