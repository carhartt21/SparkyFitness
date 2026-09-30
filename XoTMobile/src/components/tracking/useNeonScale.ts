import { useCSSVariable } from 'uniwind';

export interface NeonScale {
  red: string;
  orange: string;
  yellow: string;
  green: string;
  mint: string;
  cyan: string;
  violet: string;
}

/** The theme's neon tokens, resolved for inline styles and SVG strokes. */
export function useNeonScale(): NeonScale {
  const [red, orange, yellow, green, mint, cyan, violet] = useCSSVariable([
    '--color-neon-red',
    '--color-neon-orange',
    '--color-neon-yellow',
    '--color-neon-green',
    '--color-neon-mint',
    '--color-neon-cyan',
    '--color-neon-violet',
  ]) as string[];
  return { red, orange, yellow, green, mint, cyan, violet };
}

/**
 * Color for a favourable share (0 = least favourable, 1 = most). Callers
 * convert an answer with its question's polarity first, so a high stress
 * rating is never shown as green.
 */
export function colorForShare(scale: NeonScale, share: number): string {
  if (share <= 0.125) return scale.red;
  if (share <= 0.375) return scale.orange;
  if (share <= 0.625) return scale.yellow;
  if (share <= 0.875) return scale.green;
  return scale.mint;
}
