import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useTweenedValue } from '../../src/hooks/useTweenedValue';

describe('useTweenedValue', () => {
  let now = 0;
  let frames: FrameRequestCallback[] = [];
  const flush = (ms: number) => {
    now += ms;
    const pending = frames;
    frames = [];
    pending.forEach((frame) => frame(now));
  };

  beforeEach(() => {
    now = 0;
    frames = [];
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {
      frames = [];
    });
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows the first value without animating', () => {
    const { result } = renderHook(() => useTweenedValue(0.4));
    expect(result.current).toBe(0.4);
    expect(frames).toHaveLength(0);
  });

  it('eases from the shown value and lands exactly on the new value', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useTweenedValue(value, 400),
      { initialProps: { value: 0.2 } }
    );
    await act(async () => rerender({ value: 0.6 }));
    act(() => flush(200));
    expect(result.current).toBeGreaterThan(0.2);
    expect(result.current).toBeLessThan(0.6);
    act(() => flush(400));
    expect(result.current).toBe(0.6);
  });

  it('retargets from mid-flight on rapid changes, including decreases', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useTweenedValue(value, 400),
      { initialProps: { value: 0 } }
    );
    await act(async () => rerender({ value: 1 }));
    act(() => flush(200));
    const midway = result.current;
    await act(async () => rerender({ value: 0.3 }));
    act(() => flush(10));
    // Continues from where it was, not from 0 or 1.
    expect(Math.abs(result.current - midway)).toBeLessThan(0.2);
    act(() => flush(500));
    expect(result.current).toBe(0.3);
  });

  it('does not animate when a re-render carries the same value', async () => {
    const { rerender } = renderHook(({ value }) => useTweenedValue(value), {
      initialProps: { value: 0.5 },
    });
    await act(async () => rerender({ value: 0.5 }));
    expect(frames).toHaveLength(0);
  });
});
