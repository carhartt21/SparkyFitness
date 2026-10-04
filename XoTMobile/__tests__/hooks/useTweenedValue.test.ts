import { act, renderHook } from '@testing-library/react-native';
import { useTweenedValue } from '../../src/hooks/useTweenedValue';
let mockMotion = { active: true, reducedMotion: false };
jest.mock('../../src/hooks/useMotionPreferences', () => ({
  useMotionPreferences: () => mockMotion,
}));

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
    mockMotion = { active: true, reducedMotion: false };
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

  it('settles a hidden change without replaying when focus returns', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useTweenedValue(value),
      { initialProps: { value: 0.2 } }
    );
    rerender({ value: 0.8 });
    act(() => flush(100));
    mockMotion.active = false;
    rerender({ value: 0.8 });
    expect(result.current).toBe(0.8);
    expect(frames).toHaveLength(0);
    rerender({ value: 0.6 });
    mockMotion.active = true;
    rerender({ value: 0.6 });
    expect(result.current).toBe(0.6);
    expect(frames).toHaveLength(0);
  });

  it('immediately settles in-flight motion when Reduce Motion is enabled', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useTweenedValue(value),
      { initialProps: { value: 0.2 } }
    );
    rerender({ value: 0.8 });
    mockMotion.reducedMotion = true;
    rerender({ value: 0.8 });
    expect(result.current).toBe(0.8);
    expect(frames).toHaveLength(0);
    mockMotion.reducedMotion = false;
    rerender({ value: 0.8 });
    expect(result.current).toBe(0.8);
    expect(frames).toHaveLength(0);
  });

  it('shows unknown distinctly and does not invent a zero-to-known transition', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number | null }) => useTweenedValue(value),
      { initialProps: { value: null } }
    );
    expect(result.current).toBeNull();
    rerender({ value: 57 });
    expect(result.current).toBe(57);
    expect(frames).toHaveLength(0);
    rerender({ value: null });
    expect(result.current).toBeNull();
    rerender({ value: 0 });
    expect(result.current).toBe(0);
    expect(frames).toHaveLength(0);
  });

  it('cancels pending frames on unmount', () => {
    const { rerender, unmount } = renderHook(
      ({ value }) => useTweenedValue(value),
      { initialProps: { value: 0 } }
    );
    rerender({ value: 1 });
    expect(frames).toHaveLength(1);
    unmount();
    expect(frames).toHaveLength(0);
  });
});
