import { renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { useCompletionPulse } from '../../src/hooks/useCompletionPulse';

let mockMotion = { active: true, reducedMotion: false };
jest.mock('../../src/hooks/useMotionPreferences', () => ({
  useMotionPreferences: () => mockMotion,
}));

describe('completion feedback', () => {
  const start = jest.fn();
  beforeEach(() => {
    mockMotion = { active: true, reducedMotion: false };
    start.mockClear();
    jest
      .spyOn(Animated, 'sequence')
      .mockImplementation(() => ({ start, stop: jest.fn(), reset: jest.fn() }));
  });
  afterEach(() => jest.restoreAllMocks());
  const renderPulse = (
    target: number | null,
    rendered: number | null = target
  ) =>
    renderHook(
      (props: { target: number | null; rendered: number | null }) =>
        useCompletionPulse(props.target, props.rendered),
      { initialProps: { target, rendered } }
    );

  it('waits for the endpoint, pulses once, and stays quiet on unchanged renders', () => {
    const { rerender } = renderPulse(99);
    rerender({ target: 100, rendered: 99.5 });
    expect(start).not.toHaveBeenCalled();
    rerender({ target: 100, rendered: 100 });
    expect(start).toHaveBeenCalledTimes(1);
    rerender({ target: 100, rendered: 100 });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it.each([100, null])(
    'never celebrates mounting or resolving unknown progress (%s)',
    (initial) => {
      const { rerender } = renderPulse(initial);
      rerender({ target: 100, rendered: 100 });
      expect(start).not.toHaveBeenCalled();
    }
  );

  it('cancels a pending completion on a real decrease', () => {
    const { rerender } = renderPulse(99);
    rerender({ target: 100, rendered: 99.5 });
    rerender({ target: 57, rendered: 100 });
    rerender({ target: 57, rendered: 57 });
    expect(start).not.toHaveBeenCalled();
  });

  it.each(['hidden', 'reduced'] as const)(
    'does not defer a completion while %s',
    (mode) => {
      const { rerender } = renderPulse(99);
      if (mode === 'hidden') mockMotion.active = false;
      else mockMotion.reducedMotion = true;
      rerender({ target: 100, rendered: 100 });
      mockMotion = { active: true, reducedMotion: false };
      rerender({ target: 100, rendered: 100 });
      expect(start).not.toHaveBeenCalled();
    }
  );

  it('clears a running halo when corrected, and stops on unmount', () => {
    const { result, rerender, unmount } = renderPulse(99);
    const stop = jest.spyOn(result.current, 'stopAnimation');
    const reset = jest.spyOn(result.current, 'setValue');
    rerender({ target: 100, rendered: 100 });
    stop.mockClear();
    reset.mockClear();
    rerender({ target: 80, rendered: 100 });
    expect(stop).toHaveBeenCalled();
    expect(reset).toHaveBeenCalledWith(0);
    stop.mockClear();
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
