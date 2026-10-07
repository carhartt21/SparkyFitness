import { useEffect, useRef } from 'react';
import type {
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

export function useFoodDragScroll(editing: boolean) {
  const scrollRef = useRef<ScrollView>(null);
  const position = useRef<number | null>(null);
  const offset = useRef(0);
  const bounds = useRef({ top: 0, bottom: 0 });
  useEffect(() => {
    if (!editing) return;
    const timer = setInterval(() => {
      const y = position.current;
      if (y === null) return;
      const step =
        y < bounds.current.top + 72
          ? -12
          : y > bounds.current.bottom - 72
            ? 12
            : 0;
      if (step) {
        offset.current = Math.max(0, offset.current + step);
        scrollRef.current?.scrollTo({ y: offset.current, animated: false });
      }
    }, 50);
    return () => {
      clearInterval(timer);
      position.current = null;
    };
  }, [editing]);
  return {
    scrollRef,
    onLayout: () =>
      scrollRef.current
        ?.getNativeScrollRef()
        ?.measureInWindow((_, y, __, height) => {
          bounds.current = { top: y, bottom: y + height };
        }),
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = event.nativeEvent.contentOffset.y;
    },
    onDragPosition: (y: number | null) => {
      position.current = y;
    },
  };
}
