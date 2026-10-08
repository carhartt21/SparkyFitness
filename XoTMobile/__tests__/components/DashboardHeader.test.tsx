import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as Native from 'react-native';
import { useUniwind } from 'uniwind';
import Svg from 'react-native-svg';
import DashboardHeader from '../../src/components/DashboardHeader';

jest.mock('../../src/components/SyncStatusIndicator', () => () => null);

const props = {
  selectedDate: '2026-10-08',
  onSettings: jest.fn(),
  onHome: jest.fn(),
  onPreviousDay: jest.fn(),
  onNextDay: jest.fn(),
  onToday: jest.fn(),
  onDatePress: jest.fn(),
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it.each(['dark', 'amoled'])(
  'exposes the complete brand identity with decorative lettering in %s',
  (theme) => {
    jest
      .mocked(useUniwind)
      .mockReturnValue({ theme, hasAdaptiveThemes: false });
    const screen = render(<DashboardHeader {...props} />);
    expect(
      screen.getByRole('header', {
        name: 'X on Track. Keep getting better.',
      })
    ).toBeTruthy();
    expect(
      screen.getByTestId('dashboard-wordmark', { includeHiddenElements: true })
        .props.accessible
    ).toBe(false);
    fireEvent.press(screen.getByTestId('dashboard-home'));
    expect(props.onHome).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('dashboard-next-day'));
    expect(props.onNextDay).toHaveBeenCalledTimes(1);
  }
);

it('preserves native filled title text and tagline styling in light mode', () => {
  jest.mocked(useUniwind).mockReturnValue({
    theme: 'light',
    hasAdaptiveThemes: false,
  });
  const screen = render(<DashboardHeader {...props} />);
  expect(
    screen.queryByTestId('dashboard-wordmark', { includeHiddenElements: true })
  ).toBeNull();
  expect(screen.getByText('X on Track').props.maxFontSizeMultiplier).toBe(1.4);
  expect(screen.getByText('Keep getting better.').props.style).toBeUndefined();
});

it('scales the brand graphic at enlarged text while preserving the one-line tagline', () => {
  jest.mocked(useUniwind).mockReturnValue({
    theme: 'dark',
    hasAdaptiveThemes: false,
  });
  jest.spyOn(Native, 'useWindowDimensions').mockReturnValue({
    width: 320,
    height: 568,
    scale: 2,
    fontScale: 2,
  });
  const screen = render(<DashboardHeader {...props} />);
  const mark = screen.UNSAFE_getByType(Svg);
  // Native SVG fitting keeps the aspect ratio inside even a narrowed sync slot.
  expect(mark.props.width).toBe('100%');
  expect(mark.props.height).toBeCloseTo(50.4);
  expect(mark.props.preserveAspectRatio).toBe('xMinYMid meet');
  const tagline = screen.getByText('Keep getting better.');
  expect(tagline.props.numberOfLines).toBe(1);
  expect(tagline.props.ellipsizeMode).toBe('tail');
  expect(tagline.props.maxFontSizeMultiplier).toBe(1.6);
});
