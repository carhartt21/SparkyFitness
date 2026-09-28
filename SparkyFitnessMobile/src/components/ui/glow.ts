import type { ViewStyle } from 'react-native';
import { useUniwind } from 'uniwind';

// Partial `uniwind` test doubles may omit useUniwind; those render the
// non-glow (light) path instead of crashing.
const readTheme: () => string =
  typeof useUniwind === 'function' ? () => useUniwind().theme : () => 'light';

/** Dark and AMOLED render neon glows; light mode uses soft shadows instead. */
export function useGlowTheme(): boolean {
  const theme = readTheme();
  return theme === 'dark' || theme === 'amoled';
}

const HEX = /^#([0-9a-f]{6})$/i;

/** `#rrggbb` + two-digit alpha; non-hex input falls back to transparent. */
export function withAlpha(color: string | undefined, alpha: number): string {
  if (!color || !HEX.test(color)) return 'transparent';
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${a}`;
}

export type GlowIntensity = 'none' | 'soft' | 'strong';

/**
 * Border, outer glow and inner wash for a surface tinted by `color`. Shared by
 * cards, tiles and buttons so the neon treatment stays consistent.
 */
export function glowSurfaceStyle(
  color: string | undefined,
  glowing: boolean,
  intensity: GlowIntensity = 'soft'
): ViewStyle {
  if (!color || !HEX.test(color)) return {};
  if (!glowing) {
    return {
      borderColor: withAlpha(color, 0.35),
      boxShadow: '0px 2px 8px 0px #0000000f',
    };
  }
  const blur = intensity === 'strong' ? 18 : 12;
  const alpha = intensity === 'none' ? 0 : intensity === 'strong' ? 0.45 : 0.28;
  return {
    borderColor: withAlpha(color, intensity === 'strong' ? 0.85 : 0.5),
    boxShadow:
      intensity === 'none'
        ? undefined
        : `0px 0px ${blur}px 0px ${withAlpha(color, alpha)}`,
    experimental_backgroundImage: `linear-gradient(160deg, ${withAlpha(
      color,
      intensity === 'strong' ? 0.18 : 0.1
    )} 0%, ${withAlpha(color, 0)} 60%)`,
  };
}
