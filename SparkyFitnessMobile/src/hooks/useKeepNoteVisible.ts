import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, type View } from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

/** Keeps a focused note above the keyboard and any floating save bar. */
export function useKeepNoteVisible(bottomReserve = 12) {
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const noteRef = useRef<View>(null);
  const focused = useRef(false);
  const keyboardTop = useRef<number | null>(null);
  const frame = useRef<number | null>(null);

  const ensureVisible = useCallback(() => {
    if (!focused.current || keyboardTop.current === null) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      // Measure the field after the keyboard-aware view reserves space, then
      // move only by the amount it overlaps the keyboard or floating save bar.
      noteRef.current?.measureInWindow((_x, y, _width, height) => {
        if (!focused.current || keyboardTop.current === null) return;
        const hiddenBy = y + height - (keyboardTop.current - bottomReserve);
        if (hiddenBy <= 0) return;
        // The keyboard controller can scroll on the UI thread before onScroll
        // reaches JS. Its current offset is therefore not safe to reuse for an
        // absolute scrollTo target. React Native measures this view in the
        // ScrollView's content coordinates and computes the target natively.
        if (noteRef.current) {
          scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
            noteRef.current,
            bottomReserve + 12,
            true
          );
        }
      });
    });
  }, [bottomReserve]);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      ensureVisible();
    });
    const frameChanged = Keyboard.addListener(
      'keyboardDidChangeFrame',
      (event) => {
        keyboardTop.current = event.endCoordinates.screenY;
        ensureVisible();
      }
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
    });
    return () => {
      shown.remove();
      frameChanged.remove();
      hidden.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [ensureVisible]);

  return {
    scrollRef,
    noteRef,
    onFocus: () => {
      focused.current = true;
      keyboardTop.current = Keyboard.metrics()?.screenY ?? keyboardTop.current;
      ensureVisible();
    },
    // A multiline input can grow after its first focus. Re-check after its
    // layout updates so the lower lines do not slide under the keyboard.
    onNoteLayout: ensureVisible,
    // A growing note changes the scrollable content height; recheck when that
    // happens so the focused field stays visible above the keyboard.
    onContentSizeChange: ensureVisible,
    onDraftChange: ensureVisible,
    onBlur: () => {
      focused.current = false;
    },
  };
}
