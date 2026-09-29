import { Platform } from 'react-native';
import { canUseLiquidGlass } from '../utils/liquidGlass';

/**
 * X on Track always uses its own tab bar. The former Liquid Glass tab-bar
 * option was removed; a previously saved choice is ignored, so every device
 * gets the same navigation. Kept as a hook so call sites stay unchanged.
 */
export function useNativeIOSTabsActive(): boolean {
  return false;
}

/**
 * Native iOS stack headers are used only where the glass APIs do not exist
 * (classic iOS headers). On iOS 26+ the screen-owned headers render, matching
 * Android and the X on Track header design.
 */
export function useNativeIOSHeadersActive(): boolean {
  if (Platform.OS !== 'ios') return false;
  return !canUseLiquidGlass();
}
