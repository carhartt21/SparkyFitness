import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';

/** New content is immediately accurate/readable; a brief fade acknowledges an actual change. */
export default function ValueChangeFade({
  changeKey,
  duration = 180,
  children,
  style,
  className,
  testID,
}: {
  changeKey: string | number | boolean | null | undefined;
  duration?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  testID?: string;
}) {
  const { active, reducedMotion } = useMotionPreferences();
  const previous = useRef(changeKey);
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const changed = !Object.is(previous.current, changeKey);
    previous.current = changeKey;
    opacity.stopAnimation();
    if (!changed || changeKey == null || !active || reducedMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.72);
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    return () => opacity.stopAnimation();
  }, [changeKey, duration, active, reducedMotion, opacity]);
  return (
    <Animated.View
      testID={testID}
      className={className}
      style={[style, { opacity }]}
    >
      {children}
    </Animated.View>
  );
}
