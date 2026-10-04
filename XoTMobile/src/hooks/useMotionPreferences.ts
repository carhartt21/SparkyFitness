import {
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';

/** Presentation-only motion follows native preferences, screen focus and foreground state. */
export function useMotionPreferences() {
  const initialReducedMotion = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    // Reanimated provides a synchronous startup value; query again because a
    // component may mount after the system preference changed during this run.
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted && !preferenceChanged) setReducedMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        preferenceChanged = true;
        setReducedMotion(enabled);
      }
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  const subscribeFocus = useCallback(
    (onChange: () => void) => {
      const focus = navigation?.addListener('focus', onChange);
      const blur = navigation?.addListener('blur', onChange);
      return () => {
        focus?.();
        blur?.();
      };
    },
    [navigation]
  );
  const readFocus = useCallback(
    () => navigation?.isFocused() ?? true,
    [navigation]
  );
  const focused = useSyncExternalStore(subscribeFocus, readFocus, readFocus);
  const foreground = useSyncExternalStore(
    subscribeAppState,
    readForeground,
    readForeground
  );
  return { active: focused && foreground, reducedMotion };
}

function subscribeAppState(onChange: () => void) {
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
}
function readForeground() {
  return AppState.currentState == null || AppState.currentState === 'active';
}
