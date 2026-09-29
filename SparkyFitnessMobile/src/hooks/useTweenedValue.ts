import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);
  return reduceMotion;
}

/**
 * Eases a displayed value toward `target` after the underlying value
 * changes. It starts from what is currently shown, so rapid edits retarget
 * smoothly and decreases animate too. The first render shows the value as is
 * (no replay on navigation), an unchanged value never animates (so a server
 * reconciliation that agrees with the local projection is silent), and
 * Reduce Motion jumps straight to the value. Visual only: callers keep
 * showing exact numbers in text.
 */
export function useTweenedValue(target: number, durationMs = 450): number {
  const reduceMotion = useReduceMotion();
  const [value, setValue] = useState(target);
  const shown = useRef(target);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const from = shown.current;
    if (reduceMotion || from === target) {
      shown.current = target;
      setValue(target);
      return;
    }
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const progress = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      // The last frame lands exactly on the value, free of rounding drift.
      const next = progress >= 1 ? target : from + (target - from) * eased;
      shown.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion, durationMs]);

  return value;
}
