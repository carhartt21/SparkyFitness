import React from 'react';
import {
  View,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { glowSurfaceStyle, useGlowTheme, type GlowIntensity } from './glow';
import MotionPressable from './MotionPressable';

interface GlowCardProps {
  children: React.ReactNode;
  /** Hex theme color for the border, glow and wash; omit for a neutral card. */
  glowColor?: string;
  intensity?: GlowIntensity;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * The shared X on Track card: 16-pt corners, a hairline border and, in dark
 * themes, a colored neon glow. Pass `onPress` to make the whole card a button.
 */
export default function GlowCard({
  children,
  glowColor,
  intensity = 'soft',
  className = '',
  style,
  onPress,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: GlowCardProps) {
  const glowing = useGlowTheme();
  const surface = glowSurfaceStyle(glowColor, glowing, intensity);
  const base = `rounded-2xl border border-border-subtle bg-surface ${className}`;
  const composed: StyleProp<ViewStyle> = [
    !glowColor && glowing
      ? {
          experimental_backgroundImage:
            'linear-gradient(180deg, #ffffff0a 0%, #ffffff00 45%)',
        }
      : null,
    surface,
    style,
  ];

  if (onPress) {
    return (
      <MotionPressable
        testID={testID}
        onPress={onPress}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        className={`${base} active:opacity-80`}
        style={composed}
      >
        {children}
      </MotionPressable>
    );
  }
  return (
    <View
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      className={base}
      style={composed}
    >
      {children}
    </View>
  );
}
