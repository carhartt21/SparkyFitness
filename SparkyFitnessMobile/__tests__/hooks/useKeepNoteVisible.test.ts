import { act, renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { useKeepNoteVisible } from '../../src/hooks/useKeepNoteVisible';

describe('useKeepNoteVisible', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the measured native scroll target when a note is covered', () => {
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
      scrollResponderScrollNativeHandleToKeyboard: scrollToKeyboard,
    } as any;
    const note = {
      measureInWindow: (callback: (...args: number[]) => void) =>
        callback(0, 550, 390, 100),
    };
    result.current.noteRef.current = note as any;

    act(() => result.current.onFocus());

    expect(scrollToKeyboard).toHaveBeenCalledWith(note, 108, true);
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
      scrollResponderScrollNativeHandleToKeyboard: scrollToKeyboard,
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
    expect(scrollToKeyboard).toHaveBeenCalledWith(
      result.current.noteRef.current,
      108,
      true
    );
  });
});
