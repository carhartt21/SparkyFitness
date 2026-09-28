import React from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native';
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
}

export default function ProgressTrackX({
  progress,
  label,
  unknownLabel,
  size = 120,
  light = false,
  showValue = true,
}: ProgressTrackXProps) {
  const target = normalizeProgress(progress);
  const animated = React.useRef(new Animated.Value(target ?? 0)).current;
  const currentValue = React.useRef(target ?? 0);
  const [rendered, setRendered] = React.useState<number | null>(target);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  React.useEffect(() => {
    const listener = animated.addListener(({ value }) => {
      currentValue.current = value;
      setRendered(value);
    });
    return () => animated.removeListener(listener);
  }, [animated]);

  React.useEffect(() => {
    animated.stopAnimation((value) => {
      currentValue.current = value;
      if (target == null) {
        animated.setValue(0);
        currentValue.current = 0;
        setRendered(null);
        return;
      }
      if (reduceMotion) {
        animated.setValue(target);
        setRendered(target);
        return;
      }
      animated.setValue(currentValue.current);
      Animated.timing(animated, {
        toValue: target,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
    return () => animated.stopAnimation();
  }, [animated, target, reduceMotion]);

  const visibleProgress = target == null ? null : (rendered ?? 0);
  const visible = getProgressionXReveal(visibleProgress);
  const valueText =
    visibleProgress == null ? unknownLabel : `${Math.round(visibleProgress)}%`;
  const baseline = light
    ? progressionXGeometry.baselineLight
    : progressionXGeometry.baselineDark;
  const appearance = visibleProgress == null ? 0.62 : 1;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${label}: ${valueText}`}
    >
      <Svg
        width={size}
        height={size}
        viewBox={progressionXGeometry.viewBox}
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
                  strokeLinecap="round"
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
                    strokeLinecap="round"
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
      {showValue && (
        <Text className="text-center text-text-secondary text-xs">
          {valueText}
        </Text>
      )}
    </View>
  );
}
