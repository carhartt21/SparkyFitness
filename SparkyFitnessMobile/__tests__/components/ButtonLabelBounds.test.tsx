import React from 'react';
import { render } from '@testing-library/react-native';
import Button from '../../src/components/ui/Button';
import NeonButton, {
  limitVisibleButtonLabel,
  MAX_VISIBLE_BUTTON_LABEL_LENGTH,
} from '../../src/components/ui/NeonButton';

describe('shared button label bounds', () => {
  it('caps a long visible neon label but keeps the full accessible name', () => {
    const name = 'Protein Waffeln aus Erbsen mit Meersalz und mehr';
    const screen = render(<NeonButton label={name} onPress={jest.fn()} />);
    const visible = limitVisibleButtonLabel(name);

    expect(Array.from(visible)).toHaveLength(MAX_VISIBLE_BUTTON_LABEL_LENGTH);
    expect(visible.endsWith('…')).toBe(true);
    expect(screen.getByText(visible).props.numberOfLines).toBe(1);
    expect(screen.getByRole('button').props.accessibilityLabel).toBe(name);
  });

  it('constrains ordinary button text without changing its accessible name', () => {
    const name = 'A translated action whose label needs more room';
    const screen = render(<Button onPress={jest.fn()}>{name}</Button>);

    expect(screen.getByText(name).props.numberOfLines).toBe(2);
    expect(screen.getByRole('button').props.accessibilityLabel).toBe(name);
  });
});
