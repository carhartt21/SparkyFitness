import React from 'react';
import { Animated, Text, View } from 'react-native';
import { useTweenedValue } from '../../hooks/useTweenedValue';
import { useCompletionPulse } from '../../hooks/useCompletionPulse';
import Svg, {
  Defs,
  G,
  LinearGradient,
  Mask,
  Path,
  Stop,
} from 'react-native-svg';
import {
  getProgressionXReveal,
  normalizeProgress,
  progressionXGeometry,
  progressionXSegmentLengths,
  type ProgressValue,
} from '@workspace/shared';

interface ProgressTrackXProps {
  progress: ProgressValue;
  label: string;
  unknownLabel: string;
  size?: number;
  light?: boolean;
  showValue?: boolean;
  /** Frame the unchanged track tightly when paired with a full-size chart. */
  fit?: 'canvas' | 'track';
}

export default function ProgressTrackX({
  progress,
  label,
  unknownLabel,
  size = 120,
  light = false,
  showValue = true,
  fit = 'canvas',
}: ProgressTrackXProps) {
  const target = normalizeProgress(progress);
  const visibleProgress = useTweenedValue(target, 480);
  const completionOpacity = useCompletionPulse(target, visibleProgress);
  const visible = getProgressionXReveal(visibleProgress);
  const valueText = target == null ? unknownLabel : `${Math.round(target)}%`;
  const baseline = light
    ? progressionXGeometry.baselineLight
    : progressionXGeometry.baselineDark;
  const appearance = visibleProgress == null ? 0.62 : 1;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${label}: ${valueText}`}
    >
      <View style={{ width: size, height: size }}>
        <Svg
          width={size}
          height={size}
          // Crop only the reference canvas padding; paths/reveal stay canonical.
          viewBox={
            fit === 'track' ? '52 52 216 216' : progressionXGeometry.viewBox
          }
          accessible={false}
        >
          <Defs>
            {progressionXGeometry.segments.map((segment, index) => (
              <React.Fragment key={segment.id}>
                <LinearGradient
                  id={`progress-x-gradient-${index}`}
                  x1={segment.gradient.x1}
                  y1={segment.gradient.y1}
                  x2={segment.gradient.x2}
                  y2={segment.gradient.y2}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={segment.gradient.from} />
                  <Stop offset="1" stopColor={segment.gradient.to} />
                </LinearGradient>
                <Mask
                  id={`progress-x-mask-${index}`}
                  x="0"
                  y="0"
                  width="320"
                  height="320"
                  maskUnits="userSpaceOnUse"
                >
                  <Path
                    d={segment.guide}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={segment.revealWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${visible[index] ?? 0} ${(progressionXSegmentLengths[index] ?? 0) + 1}`}
                  />
                </Mask>
              </React.Fragment>
            ))}
          </Defs>
          <G opacity={appearance}>
            {progressionXGeometry.segments.map((segment) =>
              segment.kind === 'stroke' ? (
                <React.Fragment key={`base-${segment.id}`}>
                  <Path
                    d={segment.path}
                    fill="none"
                    stroke={baseline}
                    strokeWidth={segment.strokeWidth}
                    strokeLinecap={
                      'linecap' in segment && segment.linecap === 'butt'
                        ? 'butt'
                        : 'round'
                    }
                    strokeLinejoin="round"
                  />
                  {'taperPath' in segment && (
                    <Path d={segment.taperPath} fill={baseline} />
                  )}
                </React.Fragment>
              ) : (
                <Path
                  key={`base-${segment.id}`}
                  d={segment.path}
                  fill={baseline}
                />
              )
            )}
            {visibleProgress != null &&
              progressionXGeometry.segments.map((segment, index) => {
                if ((visible[index] ?? 0) <= 0) return null;
                const fill = `url(#progress-x-gradient-${index})`;
                const mask =
                  visibleProgress >= 100
                    ? undefined
                    : `url(#progress-x-mask-${index})`;
                return segment.kind === 'stroke' ? (
                  <G key={`active-${segment.id}`} mask={mask}>
                    <Path
                      d={segment.path}
                      fill="none"
                      stroke={fill}
                      strokeWidth={segment.strokeWidth}
                      strokeLinecap={
                        'linecap' in segment && segment.linecap === 'butt'
                          ? 'butt'
                          : 'round'
                      }
                      strokeLinejoin="round"
                    />
                    {'taperPath' in segment && (
                      <Path d={segment.taperPath} fill={fill} />
                    )}
                  </G>
                ) : (
                  <Path
                    key={`active-${segment.id}`}
                    d={segment.path}
                    fill={fill}
                    mask={mask}
                  />
                );
              })}
          </G>
        </Svg>
        <Animated.View
          pointerEvents="none"
          accessible={false}
          style={{ position: 'absolute', inset: 0, opacity: completionOpacity }}
        >
          <Svg
            width={size}
            height={size}
            viewBox={
              fit === 'track' ? '52 52 216 216' : progressionXGeometry.viewBox
            }
            accessible={false}
          >
            <Defs>
              {progressionXGeometry.segments.map((segment, index) => (
                <LinearGradient
                  key={segment.id}
                  id={`pulse-x-gradient-${index}`}
                  x1={segment.gradient.x1}
                  y1={segment.gradient.y1}
                  x2={segment.gradient.x2}
                  y2={segment.gradient.y2}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={segment.gradient.from} />
                  <Stop offset="1" stopColor={segment.gradient.to} />
                </LinearGradient>
              ))}
            </Defs>
            {progressionXGeometry.segments.map((segment, index) => (
              <Path
                key={segment.id}
                d={segment.path}
                fill={
                  segment.kind === 'stroke'
                    ? 'none'
                    : `url(#pulse-x-gradient-${index})`
                }
                stroke={`url(#pulse-x-gradient-${index})`}
                strokeWidth={
                  segment.kind === 'stroke' ? segment.strokeWidth + 5 : 5
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={light ? 0.1 : 0.18}
              />
            ))}
          </Svg>
        </Animated.View>
      </View>
      {showValue && (
        <Text className="text-center text-text-secondary text-xs">
          {valueText}
        </Text>
      )}
    </View>
  );
}
