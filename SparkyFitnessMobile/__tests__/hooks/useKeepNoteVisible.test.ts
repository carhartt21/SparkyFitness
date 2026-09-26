import { act, renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { useKeepNoteVisible } from '../../src/hooks/useKeepNoteVisible';

describe('useKeepNoteVisible', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reserves the floating action area above the keyboard for the whole note', () => {
    jest.spyOn(Keyboard, 'metrics').mockReturnValue({
      screenY: 600,
      screenX: 0,
      width: 390,
      height: 250,
    });
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const scrollToKeyboard = jest.fn();
    const { result } = renderHook(() => useKeepNoteVisible(96));
    result.current.scrollRef.current = {
      scrollTo: scrollToKeyboard,
    } as any;
    const note = {
      measureInWindow: (callback: (...args: number[]) => void) =>
        callback(0, 550, 390, 100),
    };
    result.current.noteRef.current = note as any;

    act(() => result.current.onFocus());

    expect(scrollToKeyboard).toHaveBeenCalledWith({ y: 158, animated: false });
  });

  it('rechecks the note after a keyboard that opens later than input focus', () => {
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
    const listeners = new Map<string, (event: any) => void>();
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, callback) => {
      listeners.set(name, callback);
      return { remove: jest.fn() };
    });
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const scrollToKeyboard = jest.fn();
    const { result } = renderHook(() => useKeepNoteVisible(96));
    result.current.scrollRef.current = {
      scrollTo: scrollToKeyboard,
    } as any;
    result.current.noteRef.current = {
      measureInWindow: (callback: (...args: number[]) => void) =>
        callback(0, 550, 390, 100),
    } as any;

    act(() => result.current.onFocus());
    expect(scrollToKeyboard).not.toHaveBeenCalled();

    act(() =>
      listeners.get('keyboardDidShow')?.({ endCoordinates: { screenY: 600 } })
    );
    expect(scrollToKeyboard).toHaveBeenCalledWith({ y: 158, animated: false });
  });
  it('uses the measured footer boundary and current scroll offset in a modal', () => {
    jest
      .spyOn(Keyboard, 'metrics')
      .mockReturnValue({ screenY: 650, screenX: 0, width: 390, height: 194 });
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const scrollTo = jest.fn();
    const { result } = renderHook(() => useKeepNoteVisible(96));
    result.current.scrollRef.current = { scrollTo } as NonNullable<
      typeof result.current.scrollRef.current
    >;
    result.current.noteRef.current = {
      measureInWindow: (callback) => callback(0, 420, 390, 144),
    } as NonNullable<typeof result.current.noteRef.current>;
    result.current.obstructionRef.current = {
      measureInWindow: (callback) => callback(0, 500, 390, 90),
    } as NonNullable<typeof result.current.obstructionRef.current>;
    act(() =>
      result.current.onScroll({
        nativeEvent: { contentOffset: { x: 0, y: 200 } },
      } as Parameters<typeof result.current.onScroll>[0])
    );
    act(() => result.current.onFocus());
    expect(scrollTo).toHaveBeenCalledWith({ y: 276, animated: false });
    scrollTo.mockClear();
    act(() => result.current.onBlur());
    act(() => result.current.onNoteLayout());
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it.each(['hide', 'blur', 'drag'] as const)(
    'cancels pending corrections on %s',
    (reason) => {
      jest
        .spyOn(Keyboard, 'metrics')
        .mockReturnValue({ screenY: 600, screenX: 0, width: 390, height: 244 });
      const listeners = new Map<string, (event: never) => void>();
      jest
        .spyOn(Keyboard, 'addListener')
        .mockImplementation((name, callback) => {
          listeners.set(name, callback);
          return { remove: jest.fn() };
        });
      const frames: FrameRequestCallback[] = [];
      jest
        .spyOn(global, 'requestAnimationFrame')
        .mockImplementation((callback) => {
          frames.push(callback);
          return frames.length;
        });
      jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
      const { result } = renderHook(() => useKeepNoteVisible());
      const scrollTo = jest.fn();
      let measurement:
        | ((x: number, y: number, width: number, height: number) => void)
        | undefined;
      result.current.scrollRef.current = { scrollTo } as NonNullable<
        typeof result.current.scrollRef.current
      >;
      result.current.noteRef.current = {
        measureInWindow: (callback) => {
          measurement = callback;
        },
      } as NonNullable<typeof result.current.noteRef.current>;
      act(() => result.current.onFocus());
      act(() => frames[0](0));
      act(() => result.current.onDraftChange());
      act(() => {
        if (reason === 'hide') listeners.get('keyboardDidHide')?.({} as never);
        else if (reason === 'blur') result.current.onBlur();
        else result.current.onScrollBeginDrag();
      });
      // Both a pending native measurement and an already queued frame are stale.
      act(() => measurement?.(0, 550, 390, 100));
      act(() => frames[1](0));
      act(() =>
        result.current.onScroll({
          nativeEvent: { contentOffset: { x: 0, y: 300 } },
        } as Parameters<typeof result.current.onScroll>[0])
      );
      expect(scrollTo).not.toHaveBeenCalled();
      expect(frames).toHaveLength(2);
      if (reason === 'drag') {
        act(() => result.current.onDraftChange());
        act(() => frames[2](0));
        act(() => measurement?.(0, 550, 390, 100));
        expect(scrollTo).toHaveBeenCalledWith({ y: 374, animated: false });
      }
    }
  );
});
