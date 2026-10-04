import { useEffect, useRef, useState } from 'react';
import { useMotionPreferences } from './useMotionPreferences';

/**
 * Eases a displayed value toward `target` after the underlying value
 * changes. It starts from what is currently shown, so rapid edits retarget
 * smoothly and decreases animate too. The first render shows the value as is
 * (no replay on navigation), an unchanged value never animates (so a server
 * reconciliation that agrees with the local projection is silent), and
 * Reduce Motion jumps straight to the value. Visual only: callers keep
 * showing exact numbers in text.
 */
export function useTweenedValue(target: number, durationMs?: number): number;
export function useTweenedValue(
  target: number | null,
  durationMs?: number
): number | null;
export function useTweenedValue(
  target: number | null,
  durationMs = 450
): number | null {
  const { active, reducedMotion } = useMotionPreferences();
  const safeTarget =
    target == null ? null : Number.isFinite(target) ? target : 0;
  const [value, setValue] = useState(safeTarget);
  const shown = useRef(safeTarget);
  // Unknown values never animate from an invented zero. Hidden changes settle
  // immediately, without a delayed replay when returning to the screen.
  const snap =
    !active ||
    reducedMotion ||
    safeTarget == null ||
    value == null ||
    durationMs <= 0;
  if (snap && value !== safeTarget) setValue(safeTarget);

  useEffect(() => {
    const from = shown.current;
    if (
      !active ||
      reducedMotion ||
      safeTarget == null ||
      from == null ||
      durationMs <= 0 ||
      from === safeTarget
    ) {
      shown.current = safeTarget;
      return;
    }
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const progress = Math.min(1, (Date.now() - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      // The last frame lands exactly on the value, free of rounding drift.
      const next =
        progress >= 1 ? safeTarget : from + (safeTarget - from) * eased;
      shown.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [safeTarget, active, reducedMotion, durationMs]);

  return snap ? safeTarget : value;
}
