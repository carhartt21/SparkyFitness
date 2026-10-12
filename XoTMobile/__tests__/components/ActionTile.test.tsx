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
