import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type MotionPressableProps = Omit<PressableProps, 'style'> & {
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/** Small, interruptible compression; existing pressed opacity remains in the caller's theme. */
export default function MotionPressable({
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: MotionPressableProps) {
  const { active, reducedMotion } = useMotionPreferences();
  const transform = StyleSheet.flatten(style)?.transform;
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!active || reducedMotion || disabled) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => {
      scale.stopAnimation();
      scale.setValue(1);
    };
  }, [active, reducedMotion, disabled, scale]);
  const move = (pressed: boolean) => {
    scale.stopAnimation();
    if (!active || reducedMotion || disabled) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: pressed ? 0.985 : 1,
      duration: pressed ? 100 : 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      style={[
        style,
        {
          transform:
            typeof transform === 'string'
              ? transform
              : [...(transform ?? []), { scale }],
        },
      ]}
      onPressIn={(event) => {
        move(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        move(false);
        onPressOut?.(event);
      }}
    />
  );
}
