import { useId } from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Defs, FeGaussianBlur, Filter, Path } from 'react-native-svg';
import geometry from '../../../assets/brand/dashboard-wordmark.geometry.json';

/**
 * Approved E8 lettering, authored from the real Space Grotesk 700 glyphs.
 * This static brand asset avoids font-loading shifts. The owning header supplies
 * its localized accessible name; the decorative paths stay out of that tree.
 */
export default function DashboardWordmark() {
  const { fontScale } = useWindowDimensions();
  const glowId = `dashboard-wordmark-glow-${useId().replace(/:/g, '')}`;
  const scale = Math.min(fontScale, 1.4);
  const strokeWidth = geometry.fontSize * 0.028;

  return (
    <Svg
      testID="dashboard-wordmark"
      width="100%"
      height={geometry.height * scale}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      preserveAspectRatio="xMinYMid meet"
      style={{ overflow: 'visible' }}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Defs>
        <Filter id={glowId} x="-10%" y="-70%" width="120%" height="240%">
          <FeGaussianBlur stdDeviation={6} />
        </Filter>
      </Defs>
      <Path
        d={geometry.path}
        fill="none"
        stroke="#14e89a"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        opacity={0.52}
        filter={`url(#${glowId})`}
      />
      <Path
        d={geometry.path}
        fill="none"
        stroke="#ddf4e8"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
