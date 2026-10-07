import {
  ActivityIndicator,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Icon, { type IconName } from '../Icon';
import MotionPressable from './MotionPressable';
import { useButtonAppearance } from './buttonTheme';

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
 * Compatibility adapter for the shared rounded-rectangle action treatment.
 * Translucent fill, restrained glow and minimum 44-pt touch height.
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
  const inactive = disabled || loading;
  const appearance = useButtonAppearance(
    variant === 'subtle' ? 'secondary' : variant,
    inactive,
    color
  );
  const visibleLabel = limitVisibleButtonLabel(label);
  const labelColor = appearance.foreground;

  return (
    <MotionPressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={`${size === 'sm' ? 'min-h-11 px-4' : 'min-h-12 px-5'} flex-row items-center justify-center gap-2 ${inactive ? 'opacity-50' : 'active:opacity-80'} ${className}`}
      style={[{ maxWidth: '100%', minWidth: 0 }, style, appearance.surface]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <View className="min-w-0 shrink flex-row items-center gap-2">
          {icon ? (
            <Icon
              name={icon}
              size={size === 'sm' ? 16 : 18}
              color={labelColor}
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
