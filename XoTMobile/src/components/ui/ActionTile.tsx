import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import Icon, { type IconName } from '../Icon';
import { glowSurfaceStyle, useGlowTheme, withAlpha } from './glow';

interface ActionTileProps {
  label: string;
  sublabel?: string;
  icon: IconName;
  /** Hex theme color that tints the border, glow, fill and icon. */
  color: string;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Neon quick-action tile (Log Food, Log Water, Scan, …). */
export default function ActionTile({
  label,
  sublabel,
  icon,
  color,
  onPress,
  testID,
  accessibilityLabel,
  style,
}: ActionTileProps) {
  const glowing = useGlowTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (sublabel ? `${label} ${sublabel}` : label)
      }
      className="min-h-[84px] items-center justify-center rounded-2xl border px-1 py-3 active:opacity-80"
      style={[
        { backgroundColor: withAlpha(color, glowing ? 0.07 : 0.06) },
        glowSurfaceStyle(color, glowing, 'strong'),
        style,
      ]}
    >
      <Icon name={icon} size={28} color={color} />
      <Text
        className="mt-2 text-center text-[13px] font-semibold text-text-primary"
        maxFontSizeMultiplier={1.6}
      >
        {label}
      </Text>
      {sublabel ? (
        <Text
          className="text-center text-[11px] text-text-secondary"
          maxFontSizeMultiplier={1.6}
        >
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}
