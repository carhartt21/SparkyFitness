import * as React from 'react';
import { cn } from '@/lib/utils';

export type GlowTone =
  | 'neutral'
  | 'mint'
  | 'green'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'cyan'
  | 'violet';

type GlowCardProps = React.HTMLAttributes<HTMLElement> & {
  /** Border and glow tint; omit for a plain card surface. */
  tone?: GlowTone;
  as?: 'div' | 'section' | 'article';
};

/**
 * Shared X on Track card: 16px corners and a tinted border; in dark mode a
 * restrained glow. Mirrors the mobile `GlowCard` so both apps read as one.
 */
const GlowCard = React.forwardRef<HTMLElement, GlowCardProps>(
  ({ tone, as = 'div', className, style, ...props }, ref) => {
    const Component = as as React.ElementType;
    return (
      <Component
        ref={ref}
        className={cn(
          'rounded-2xl text-card-foreground',
          tone ? 'glow-surface' : 'border border-border/70 bg-card',
          className
        )}
        style={
          tone
            ? ({
                '--glow': glowColor(tone),
                ...style,
              } as React.CSSProperties)
            : style
        }
        {...props}
      />
    );
  }
);
GlowCard.displayName = 'GlowCard';

/** Hex neon token for a tone, for icons and chart strokes. */
export const glowColor = (tone: GlowTone) =>
  tone === 'neutral' ? 'var(--card-glow)' : `var(--neon-${tone})`;

export { GlowCard };
