import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useUniwind } from 'uniwind';
import Button from '../../src/components/ui/Button';
import NeonButton from '../../src/components/ui/NeonButton';

it('keeps both adapters on the same material despite caller overrides', () => {
  const view = render(
    <>
      <Button
        testID="ordinary"
        style={{
          borderRadius: 100,
          backgroundColor: '#ff0000',
          boxShadow: '0px 0px 30px red',
        }}
      >
        Add food
      </Button>
      <NeonButton testID="legacy" label="Record" style={{ borderRadius: 1 }} />
    </>
  );
  const ordinary = StyleSheet.flatten(view.getByTestId('ordinary').props.style);
  const legacy = StyleSheet.flatten(view.getByTestId('legacy').props.style);
  expect(ordinary.borderRadius).toBe(legacy.borderRadius);
  expect(ordinary.backgroundColor).toBe(legacy.backgroundColor);
  expect(ordinary.boxShadow).toBe(legacy.boxShadow);
  expect(ordinary.borderRadius).not.toBe(100);
  expect(ordinary.backgroundColor).not.toBe('#ff0000');
});
it('preserves selection while exposing busy and blocking the loading action', () => {
  const press = jest.fn();
  const view = render(
    <Button
      loading
      onPress={press}
      accessibilityLabel="Save"
      accessibilityState={{ selected: true }}
    >
      Save
    </Button>
  );
  const action = view.getByRole('button');
  expect(action.props.accessibilityState).toMatchObject({
    selected: true,
    disabled: true,
    busy: true,
  });
  fireEvent.press(action);
  expect(press).not.toHaveBeenCalled();
});
it('restrains dark glow and removes it while disabled', () => {
  jest
    .mocked(useUniwind)
    .mockReturnValue({ theme: 'dark', hasAdaptiveThemes: false });
  const view = render(<Button testID="action">Record</Button>);
  expect(
    StyleSheet.flatten(view.getByTestId('action').props.style).boxShadow
  ).toContain('10px');
  view.rerender(
    <Button testID="action" disabled>
      Record
    </Button>
  );
  expect(
    StyleSheet.flatten(view.getByTestId('action').props.style).boxShadow
  ).toBeUndefined();
  jest
    .mocked(useUniwind)
    .mockReturnValue({ theme: 'light', hasAdaptiveThemes: false });
});
