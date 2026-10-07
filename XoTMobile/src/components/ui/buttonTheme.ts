import type { ViewStyle } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { useGlowTheme, withAlpha } from './glow';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'header'
  | 'link'
  | 'destructive';

/** One geometry for app actions; native chrome and state indicators stay native. */
export const BUTTON_CORNER_RADIUS = 12;

export function useButtonAppearance(
  variant: ButtonVariant,
  inactive = false,
  color?: string,
  neutralText = false
): { surface: ViewStyle; foreground: string } {
  const glowing = useGlowTheme();
  const [accent, foreground, raised, neutral, danger] = useCSSVariable([
    '--color-accent-primary',
    '--color-text-primary',
    '--color-surface-elevated',
    '--color-card-glow',
    '--color-destructive',
  ]) as string[];
  const tint = color ?? (variant === 'destructive' ? danger : accent);
  const quiet =
    variant === 'ghost' || variant === 'header' || variant === 'link';
  const primary = variant === 'primary';
  const outlined = variant === 'outline' || variant === 'destructive';
  const edge = primary || outlined ? tint : neutral;
  return {
    foreground:
      (quiet && !neutralText) || variant === 'destructive' ? tint : foreground,
    surface: {
      borderRadius: BUTTON_CORNER_RADIUS,
      borderWidth: quiet ? 0 : 1,
      borderColor: withAlpha(edge, primary ? 0.65 : 0.4),
      backgroundColor: quiet
        ? 'transparent'
        : primary || outlined
          ? withAlpha(tint, primary ? 0.16 : 0.07)
          : withAlpha(raised, 0.76),
      boxShadow:
        inactive || quiet
          ? undefined
          : glowing
            ? `0px 0px 10px 0px ${withAlpha(edge, primary ? 0.2 : 0.1)}`
            : '0px 2px 4px 0px #0000000a',
    },
  };
}
