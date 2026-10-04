import {
  ActivityIndicator,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from '../Icon';
import { glowSurfaceStyle, useGlowTheme, withAlpha } from './glow';
import MotionPressable from './MotionPressable';

type NeonButtonVariant = 'primary' | 'outline' | 'subtle';

/** Keeps user-generated and translated labels from making a button wider than its card. */
export const MAX_VISIBLE_BUTTON_LABEL_LENGTH = 32;

export const limitVisibleButtonLabel = (label: string): string => {
  const characters = Array.from(label);
  return characters.length > MAX_VISIBLE_BUTTON_LABEL_LENGTH
    ? `${characters.slice(0, MAX_VISIBLE_BUTTON_LABEL_LENGTH - 1).join('')}…`
    : label;
};

interface NeonButtonProps {
  label: string;
  onPress?: () => void;
  variant?: NeonButtonVariant;
  icon?: IconName;
  /** Hex color for outline/subtle variants; defaults to the accent. */
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The shared capsule button from the reference: a filled neon primary, a
 * glowing outline and a quiet subtle variant. Minimum 44-pt touch height.
 */
export default function NeonButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  color,
  disabled = false,
  loading = false,
  size = 'md',
  accessibilityLabel,
  accessibilityHint,
  testID,
  className = '',
  style,
}: NeonButtonProps) {
  const glowing = useGlowTheme();
  const [accent, accentText, textPrimary] = useCSSVariable([
    '--color-accent-primary',
    '--color-accent-text',
    '--color-text-primary',
  ]) as [string, string, string];
  const tint = color ?? accent;
  const inactive = disabled || loading;
  const visibleLabel = limitVisibleButtonLabel(label);

  const variantStyle: ViewStyle =
    variant === 'primary'
      ? {
          backgroundColor: tint,
          borderColor: tint,
          boxShadow: glowing
            ? `0px 0px 16px 0px ${withAlpha(tint, 0.55)}`
            : '0px 2px 6px 0px #00000026',
        }
      : variant === 'outline'
        ? {
            backgroundColor: withAlpha(tint, glowing ? 0.08 : 0.06),
            ...glowSurfaceStyle(tint, glowing, 'soft'),
            experimental_backgroundImage: undefined,
          }
        : {};
  const labelColor =
    variant === 'primary'
      ? accentText
      : variant === 'outline'
        ? textPrimary
        : tint;

  return (
    <MotionPressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={`${size === 'sm' ? 'min-h-11 px-4' : 'min-h-12 px-5'} flex-row items-center justify-center gap-2 rounded-full border ${
        variant === 'subtle' ? 'border-border-subtle bg-raised' : ''
      } ${inactive ? 'opacity-50' : 'active:opacity-80'} ${className}`}
      style={[variantStyle, { maxWidth: '100%', minWidth: 0 }, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <View className="min-w-0 shrink flex-row items-center gap-2">
          {icon ? (
            <Icon
              name={icon}
              size={size === 'sm' ? 16 : 18}
              color={variant === 'outline' ? tint : labelColor}
            />
          ) : null}
          <Text
            className={`${size === 'sm' ? 'text-sm' : 'text-base'} min-w-0 shrink font-semibold`}
            style={{ color: labelColor }}
            numberOfLines={1}
            ellipsizeMode="tail"
            adjustsFontSizeToFit
            minimumFontScale={0.9}
            maxFontSizeMultiplier={1.6}
          >
            {visibleLabel}
          </Text>
        </View>
      )}
    </MotionPressable>
  );
}
