import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { useGlowTheme } from './ui/glow';
import { useTweenedValue } from '../hooks/useTweenedValue';

const START_DEG = 135;
const SWEEP_DEG = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG path for a clockwise arc of `sweep` degrees starting at 135°. */
export function gaugeArcPath(size: number, stroke: number, sweep: number) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const clamped = Math.min(Math.max(sweep, 0), SWEEP_DEG);
  const start = polar(c, c, r, START_DEG);
  const end = polar(c, c, r, START_DEG + clamped);
  const largeArc = clamped > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

interface EnergyGaugeProps {
  /** 0–1; values above 1 fill the whole arc. */
  progress: number;
  size: number;
  strokeWidth: number;
}

/**
 * 270° energy arc from the reference. The gradient runs along the arc's
 * geometry (red → yellow → green) and describes distance along the path,
 * not a health judgement. Decorative: the card states the numbers in text.
 */
export default function EnergyGauge({
  progress,
  size,
  strokeWidth,
}: EnergyGaugeProps) {
  const glowing = useGlowTheme();
  const [track, red, yellow, green] = useCSSVariable([
    '--color-energy-track',
    '--color-neon-red',
    '--color-neon-yellow',
    '--color-neon-green',
  ]) as [string, string, string, string];
  const target = Number.isFinite(progress)
    ? Math.min(Math.max(progress, 0), 1)
    : 0;
  const fill = useTweenedValue(target);
  const trackPath = gaugeArcPath(size, strokeWidth, SWEEP_DEG);
  const fillPath = gaugeArcPath(size, strokeWidth, SWEEP_DEG * fill);

  return (
    <Svg
      width={size}
      height={size}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient
          id="energyGauge"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={String(size)}
          y2="0"
        >
          <Stop offset="0" stopColor={red} />
          <Stop offset="0.5" stopColor={yellow} />
          <Stop offset="1" stopColor={green} />
        </LinearGradient>
      </Defs>
      <Path
        d={trackPath}
        stroke={track}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      {fill > 0 ? (
        <>
          {glowing ? (
            <Path
              d={fillPath}
              stroke="url(#energyGauge)"
              strokeOpacity={0.22}
              strokeWidth={strokeWidth + 10}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}
          <Path
            testID="energy-gauge-fill"
            d={fillPath}
            stroke="url(#energyGauge)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : null}
    </Svg>
  );
}
