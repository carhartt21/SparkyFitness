import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import MealStatusControl from '../../src/components/tracking/MealStatusControl';

jest.mock('../../src/components/ActionSheet', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return React.forwardRef(
    (
      { items }: { items: { key: string; onPress: () => void }[] },
      ref: React.Ref<unknown>
    ) => {
      const [visible, setVisible] = React.useState(false);
      React.useImperativeHandle(ref, () => ({
        present: () => setVisible(true),
      }));
      return visible
        ? items.map((item) => (
            <Pressable
              key={item.key}
              testID={`status-option-${item.key}`}
              onPress={item.onPress}
            >
              <Text>{item.key}</Text>
            </Pressable>
          ))
        : null;
    }
  );
});

describe('MealStatusControl', () => {
  it.each([
    ['pending', 'complete'],
    ['complete', 'incomplete'],
    ['incomplete', 'skipped'],
    ['skipped', null],
  ] as const)('cycles %s to %s on a tap', (state, next) => {
    const onChange = jest.fn();
    const view = render(
      <MealStatusControl
        mealLabel="Breakfast"
        state={state}
        onChange={onChange}
      />
    );

    fireEvent.press(view.getByTestId('meal-status-control'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(next);
  });

  it('opens direct status choices on long press without cycling', () => {
    const onChange = jest.fn();
    const view = render(
      <MealStatusControl
        mealLabel="Breakfast"
        state="complete"
        onChange={onChange}
      />
    );

    fireEvent(view.getByTestId('meal-status-control'), 'longPress');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId('status-option-skipped'));
    expect(onChange).toHaveBeenCalledWith('skipped');
    expect(view.getByTestId('status-option-clear')).toBeTruthy();
  });

  it('disables status changes while a save is pending', () => {
    const onChange = jest.fn();
    const view = render(
      <MealStatusControl
        mealLabel="Breakfast"
        state="pending"
        onChange={onChange}
        busy
      />
    );
    const control = view.getByTestId('meal-status-control');
    expect(control.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(control);
    expect(onChange).not.toHaveBeenCalled();
  });
});
