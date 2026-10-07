import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { ToastConfigParams } from 'react-native-toast-message';
import { toastConfig } from '../../../src/components/ui/toastConfig';

jest.mock('uniwind', () => ({
  useCSSVariable: (keys: string | string[]) =>
    Array.isArray(keys) ? keys.map(() => '#111827') : '#111827',
}));

jest.mock('../../../src/components/Icon', () => {
  const { View } = require('react-native');
  return ({ name }: { name: string }) => <View testID={`icon-${name}`} />;
});

function buildParams(
  overrides: Partial<ToastConfigParams<unknown>> = {}
): ToastConfigParams<unknown> {
  return {
    position: 'top',
    type: 'success',
    isVisible: true,
    text1: 'Lisinopril logged',
    text2: undefined,
    show: jest.fn(),
    hide: jest.fn(),
    onPress: jest.fn(),
    props: undefined,
    ...overrides,
  };
}

describe('toastConfig', () => {
  it('renders text without a tap target by default', () => {
    const screen = render(<>{toastConfig.success!(buildParams())}</>);

    expect(screen.getByText('Lisinopril logged')).toBeTruthy();
    expect(screen.getByTestId('icon-checkmark-circle')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a separate, accessible undo action without duplicating its label', () => {
    const onPress = jest.fn();
    const screen = render(
      <>
        {toastConfig.success!(
          buildParams({
            text2: 'Details about the saved entry',
            props: { onPress, actionLabel: 'Undo' },
          })
        )}
      </>
    );

    expect(screen.getByText('Details about the saved entry')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByLabelText('Undo').props.style)
    ).toMatchObject({
      minHeight: 44,
    });
    fireEvent.press(screen.getByLabelText('Undo'));
    expect(onPress).toHaveBeenCalled();
  });

  it('uses an older action toast hint as its button label', () => {
    const onPress = jest.fn();
    const screen = render(
      <>
        {toastConfig.success!(
          buildParams({ text2: 'Undo', props: { onPress } })
        )}
      </>
    );

    expect(screen.getAllByText('Undo')).toHaveLength(1);
    fireEvent.press(screen.getByLabelText('Undo'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps errors on the neutral snackbar surface with a distinct status icon', () => {
    const screen = render(
      <>{toastConfig.error!(buildParams({ text1: 'Could not save' }))}</>
    );

    expect(screen.getByTestId('icon-alert-circle')).toBeTruthy();
    expect(
      screen.getByTestId('app-snackbar').props.accessibilityLiveRegion
    ).toBe('assertive');
  });
});
