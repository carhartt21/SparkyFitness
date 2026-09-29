import Svg, { Circle, Path } from 'react-native-svg';

/** Mouth curve per overall-day value, 1 = very difficult … 5 = great. */
const MOUTHS: Record<number, string> = {
  1: 'M8 17.5 Q12 13.5 16 17.5',
  2: 'M8.5 16.5 Q12 14.5 15.5 16.5',
  3: 'M8.5 15.5 L15.5 15.5',
  4: 'M8 14.5 Q12 18 16 14.5',
  5: 'M7.5 13.5 Q12 19.5 16.5 13.5 Z',
};

/** Outline face for the overall-day options; decorative (labelled by its button). */
export default function CheckinFace({
  value,
  color,
  size = 36,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const great = value === 5;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle
        cx={12}
        cy={12}
        r={10}
        stroke={color}
        strokeWidth={1.6}
        fill="none"
      />
      <Circle cx={8.8} cy={9.5} r={1.2} fill={color} />
      <Circle cx={15.2} cy={9.5} r={1.2} fill={color} />
      <Path
        d={MOUTHS[value] ?? MOUTHS[3]}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill={great ? color : 'none'}
      />
    </Svg>
  );
}
