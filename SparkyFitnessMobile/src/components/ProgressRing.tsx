import React, { useEffect, useRef } from 'react';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  progress: number; // 0-1 value (capped at 1 for display)
  size: number;
  strokeWidth: number;
  color: string;
  backgroundColor: string;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size,
  strokeWidth,
  color,
  backgroundColor,
}) => {
  const reducedMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const progressCapped = Math.min(Math.max(progress, 0), 1);

  const animatedProgress = useSharedValue(0);

  // Replay the 0 -> current entrance animation each time the screen regains
  // focus, then smoothly follow later progress changes (e.g. a per-second timer
  // tick) without resetting to zero. Both writes to `animatedProgress` live in
  // a single effect (React's compiler can't optimize a shared value mutated
  // across two effects); `wasFocused` distinguishes a fresh focus — which resets
  // to zero first — from an in-place value change.
  const isFocused = useIsFocused();
  const wasFocused = useRef(false);
  useEffect(() => {
    // Skip animating while blurred so a mounted-but-hidden ring (e.g. the
    // fasting/calorie ring on the Dashboard while another screen is on top)
    // doesn't schedule frames for a per-second progress tick no one can see.
    if (!isFocused) {
      wasFocused.current = false;
      return;
    }
    const justFocused = !wasFocused.current;
    wasFocused.current = true;
    if (justFocused) {
      animatedProgress.value = 0;
    }
    animatedProgress.value = withTiming(progressCapped, {
      duration: reducedMotion ? 0 : 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, progressCapped, animatedProgress, reducedMotion]);

  const circumference = 2 * Math.PI * radius;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
    opacity: animatedProgress.value > 0 ? 1 : 0,
  }));

  // SVG has no native FPS/debug overlay. Keep the same focus-aware motion
  // without a Skia canvas for this simple geometric progress indicator.
  return (
    <Svg width={size} height={size} accessible={false}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={backgroundColor}
        strokeWidth={strokeWidth}
      />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={[circumference, circumference]}
        rotation={-90}
        origin={`${center}, ${center}`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
};

export default ProgressRing;
