import { useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  type View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

/** Keeps a focused note above the keyboard and any floating save bar. */
export function useKeepNoteVisible(bottomReserve = 12) {
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const noteRef = useRef<View>(null);
  const obstructionRef = useRef<View>(null);
  const focused = useRef(false);
  const scrollOffset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const manualScroll = useRef(false);
  const generation = useRef(0);
  const cancelCorrection = useCallback(() => {
    generation.current += 1;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const ensureVisible = useCallback(() => {
    if (
      !focused.current ||
      keyboardTop.current === null ||
      manualScroll.current
    )
      return;
    cancelCorrection();
    const scheduledGeneration = generation.current;
    const isCurrent = () =>
      scheduledGeneration === generation.current &&
      focused.current &&
      keyboardTop.current !== null &&
      !manualScroll.current;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const top = keyboardTop.current;
      if (!isCurrent() || top === null) return;
      const moveAbove = (boundary: number) => {
        noteRef.current?.measureInWindow((_x, y, _width, height) => {
          if (!isCurrent()) return;
          const hiddenBy = y + height - boundary;
          if (hiddenBy <= 0) return;
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollOffset.current + hiddenBy + 12),
            animated: false,
          });
        });
      };
      // Modal windows and keyboard prediction bars can use different screen
      // offsets. Measure a floating footer in the same window as the note.
      if (obstructionRef.current) {
        obstructionRef.current.measureInWindow((_x, top) => moveAbove(top));
      } else {
        moveAbove(top - bottomReserve);
      }
    });
  }, [bottomReserve, cancelCorrection]);

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
      cancelCorrection();
    });
    return () => {
      shown.remove();
      frameChanged.remove();
      hidden.remove();
      cancelCorrection();
    };
  }, [ensureVisible, cancelCorrection]);

  return {
    scrollRef,
    noteRef,
    obstructionRef,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
      ensureVisible();
    },
    onScrollBeginDrag: () => {
      manualScroll.current = true;
      cancelCorrection();
    },
    onFocus: () => {
      focused.current = true;
      manualScroll.current = false;
      keyboardTop.current = Keyboard.metrics()?.screenY ?? keyboardTop.current;
      ensureVisible();
    },
    // A multiline input can grow after its first focus. Re-check after its
    // layout updates so the lower lines do not slide under the keyboard.
    onNoteLayout: ensureVisible,
    // A growing note changes the scrollable content height; recheck when that
    // happens so the focused field stays visible above the keyboard.
    onContentSizeChange: ensureVisible,
    onDraftChange: () => {
      manualScroll.current = false;
      ensureVisible();
    },
    onBlur: () => {
      focused.current = false;
      cancelCorrection();
    },
  };
}
