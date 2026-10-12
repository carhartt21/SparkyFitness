import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import MealTypeTimeWheel from '../../src/components/MealTypeTimeWheel';
import TimeWheel from '../../src/components/TimeWheel';
import { setWheelTime } from '../helpers/timeWheel';

function ControlledWheel({
  initial = '17:30',
  minuteInterval = 1,
}: {
  initial?: string;
  minuteInterval?: 1 | 15;
}) {
  const [value, onChange] = React.useState(initial);
  return (
    <TimeWheel
      value={value}
      onChange={onChange}
      minuteInterval={minuteInterval}
      testID="wheel"
    />
  );
}

describe('shared phone clock wheels', () => {
  afterEach(() => jest.restoreAllMocks());
  it('retains the full-width contract and exposes independent 24-hour adjustable controls', () => {
    const screen = render(
      <MealTypeTimeWheel value="23:59" onChange={jest.fn()} testID="wheel" />
    );
    expect(screen.getByTestId('wheel').props.style).toMatchObject({
      width: '100%',
      alignSelf: 'stretch',
    });
    expect(
      screen.getByLabelText('Hours').props.accessibilityValue
    ).toMatchObject({ now: 23, min: 0, max: 23, text: '23' });
    expect(screen.getByLabelText('Minutes').props.accessibilityValue.now).toBe(
      59
    );
  });
  it('changes hours and minutes to a canonical HH:mm without crossing the clock boundaries', () => {
    const screen = render(<ControlledWheel />);
    setWheelTime(screen.getByLabelText, '00:00');
    fireEvent(screen.getByLabelText('Hours'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(screen.getByLabelText('Hours').props.accessibilityValue.now).toBe(0);
    setWheelTime(screen.getByLabelText, '23:59');
    fireEvent(screen.getByLabelText('Minutes'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(screen.getByLabelText('Minutes').props.accessibilityValue.now).toBe(
      59
    );
  });
  it('preserves an off-grid minute and steps to neighboring quarter hours', () => {
    const screen = render(
      <ControlledWheel initial="14:49" minuteInterval={15} />
    );
    const adjust = (actionName: string) =>
      fireEvent(screen.getByLabelText('Minutes'), 'accessibilityAction', {
        nativeEvent: { actionName },
      });
    expect(screen.getByLabelText('Minutes').props.accessibilityValue.now).toBe(
      49
    );
    adjust('decrement');
    expect(screen.getByLabelText('Minutes').props.accessibilityValue.now).toBe(
      45
    );
    adjust('decrement');
    expect(screen.getByLabelText('Minutes').props.accessibilityValue.now).toBe(
      30
    );
  });
  it('does not re-seed an unset wheel on unrelated rerenders', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 12, 7, 8));
    const onChange = jest.fn();
    const screen = render(<TimeWheel value={null} onChange={onChange} />);
    act(() => jest.setSystemTime(new Date(2026, 9, 12, 8, 9)));
    screen.rerender(<TimeWheel value={null} onChange={onChange} />);
    expect(screen.getByLabelText('Hours').props.accessibilityValue.now).toBe(7);
    expect(screen.getByLabelText('Minutes').props.accessibilityValue.now).toBe(
      8
    );
    expect(onChange).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
