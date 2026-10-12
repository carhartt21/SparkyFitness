import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ActionTile from '../../src/components/ui/ActionTile';

test('keeps the full container action accessible while shortening only its visible name', () => {
  const onPress = jest.fn();
  const name = 'Meine große wiederverwendbare Wasserflasche';
  const screen = render(
    <ActionTile
      label={name}
      sublabel="250 ml"
      icon="water"
      color="#00aaff"
      onPress={onPress}
      accessibilityLabel={`Wasser erfassen: ${name}, 250 ml pro Tippen`}
    />
  );
  expect(screen.getByText(name).props.numberOfLines).toBe(1);
  expect(screen.getByText('250 ml').props.numberOfLines).toBe(1);
  fireEvent.press(
    screen.getByRole('button', {
      name: `Wasser erfassen: ${name}, 250 ml pro Tippen`,
    })
  );
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('keeps a separate hold/accessibility action from the primary tap', () => {
  const tap = jest.fn();
  const hold = jest.fn();
  const screen = render(
    <ActionTile
      label="Food"
      sublabel="Choose food"
      icon="food"
      color="#12ab78"
      onPress={tap}
      onLongPress={hold}
      longPressLabel="More options"
    />
  );
  const button = screen.getByRole('button', { name: 'Food Choose food' });
  fireEvent(button, 'longPress');
  expect(hold).toHaveBeenCalledTimes(1);
  expect(tap).not.toHaveBeenCalled();
  fireEvent(button, 'accessibilityAction', {
    nativeEvent: { actionName: 'longpress' },
  });
  expect(hold).toHaveBeenCalledTimes(2);
  fireEvent.press(button);
  expect(tap).toHaveBeenCalledTimes(1);
  expect(button.props.accessibilityHint).toBe('More options');
});
