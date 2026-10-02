import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { useGlowTheme } from './ui/glow';
import { useTweenedValue } from '../hooks/useTweenedValue';

const START_DEG = 135;
const SWEEP_DEG = 270;
const EDGE_CLEARANCE = 1;
/** The fill sits inside the track instead of covering it edge to edge. */
export const GAUGE_FILL_NARROWING = 4;
/**
 * Soft glow: a few thin halos around the fill, each wider and fainter than
 * the last, so the light falls off gradually instead of ending in one
 * hard-edged band. `extra` is added to the fill width.
 */
export const GAUGE_GLOW_LAYERS = [
  { extra: 2, opacity: 0.16 },
  { extra: 5, opacity: 0.08 },
  { extra: 9, opacity: 0.035 },
] as const;
const GLOW_MAX_EXTRA = GAUGE_GLOW_LAYERS[GAUGE_GLOW_LAYERS.length - 1].extra;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG path for a clockwise arc of `sweep` degrees starting at 135°. */
export function gaugeArcPath(
  size: number,
  stroke: number,
  sweep: number,
  inset = 0
) {
  const r = Math.max(0, (size - stroke) / 2 - inset);
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
  /** Optional neutral baseline when paired with another progress visual. */
  trackColor?: string;
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
  trackColor,
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
  const fillWidth = Math.max(4, strokeWidth - GAUGE_FILL_NARROWING);
  // Keep the widest halo inside the viewport plus a point for antialiasing;
  // otherwise its outer edge is cut into a flat vertical line on iOS.
  const haloOverhang = glowing
    ? Math.max(0, (fillWidth + GLOW_MAX_EXTRA - strokeWidth) / 2)
    : 0;
  const inset = EDGE_CLEARANCE + haloOverhang;
  const trackPath = gaugeArcPath(size, strokeWidth, SWEEP_DEG, inset);
  const fillPath = gaugeArcPath(size, strokeWidth, SWEEP_DEG * fill, inset);

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
        stroke={trackColor ?? track}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      {fill > 0 ? (
        <>
          {glowing
            ? // Widest and faintest first, so the brightest halo sits on top.
              [...GAUGE_GLOW_LAYERS]
                .reverse()
                .map((layer) => (
                  <Path
                    key={layer.extra}
                    testID="energy-gauge-glow"
                    d={fillPath}
                    stroke="url(#energyGauge)"
                    strokeOpacity={layer.opacity}
                    strokeWidth={fillWidth + layer.extra}
                    strokeLinecap="round"
                    fill="none"
                  />
                ))
            : null}
          <Path
            testID="energy-gauge-fill"
            d={fillPath}
            stroke="url(#energyGauge)"
            strokeWidth={fillWidth}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : null}
    </Svg>
  );
}
