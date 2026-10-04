import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useMotionPreferences } from './useMotionPreferences';

/** One separate halo after an observed, visible transition to completion.
 * Mounting complete, restoring unknown data, and returning to a screen stay quiet. */
export function useCompletionPulse(
  target: number | null,
  rendered: number | null
) {
  const { active, reducedMotion } = useMotionPreferences();
  const previous = useRef(target);
  const pending = useRef(false);
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (previous.current !== target) {
      pending.current =
        previous.current != null && previous.current < 100 && target === 100;
      previous.current = target;
    }
    if (!active || reducedMotion || target !== 100) {
      pending.current = false;
      opacity.stopAnimation();
      opacity.setValue(0);
      return;
    }
    if (!pending.current || rendered !== 100) return;
    pending.current = false;
    opacity.stopAnimation();
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [target, rendered, active, reducedMotion, opacity]);
  useEffect(() => () => opacity.stopAnimation(), [opacity]);
  return opacity;
}
