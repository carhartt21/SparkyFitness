import React from 'react';
import { Image } from 'expo-image';
import { act, fireEvent, render } from '@testing-library/react-native';
import SafeImage from '../../src/components/SafeImage';

const source = {
  uri: 'https://server/uploads/exercises/demo/0.gif',
  headers: {},
};

describe('SafeImage autoplay', () => {
  it('holds animated formats on their first frame by default', () => {
    // Regression: animated GIF exercise images used to loop inside list
    // thumbnails everywhere SafeImage is used, because expo-image autoplays
    // unless told otherwise.
    const { UNSAFE_getByType } = render(
      <SafeImage source={source} style={{ width: 42, height: 42 }} />
    );

    expect(UNSAFE_getByType(Image).props.autoplay).toBe(false);
  });

  it('plays animated formats when the caller opts in', () => {
    const { UNSAFE_getByType } = render(
      <SafeImage source={source} style={{ width: 42, height: 42 }} autoplay />
    );

    expect(UNSAFE_getByType(Image).props.autoplay).toBe(true);
  });
});

describe('SafeImage terminal failure', () => {
  it('notifies once after retries so callers can disable the photo viewer', () => {
    jest.useFakeTimers();
    try {
      const onTerminalError = jest.fn();
      const view = render(
        <SafeImage
          source={source}
          style={{ width: 42, height: 42 }}
          onTerminalError={onTerminalError}
        />
      );
      for (const delay of [1500, 3000]) {
        fireEvent(view.UNSAFE_getByType(Image), 'onError');
        act(() => jest.advanceTimersByTime(delay));
      }
      fireEvent(view.UNSAFE_getByType(Image), 'onError');
      expect(onTerminalError).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
