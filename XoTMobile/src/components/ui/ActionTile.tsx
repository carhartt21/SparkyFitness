import { Text, type StyleProp, type ViewStyle } from 'react-native';
import MotionPressable from './MotionPressable';
import Icon, { type IconName } from '../Icon';
import { useButtonAppearance } from './buttonTheme';

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
  const appearance = useButtonAppearance('outline', false, color);
  return (
    <MotionPressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (sublabel ? `${label} ${sublabel}` : label)
      }
      className="min-h-[72px] items-center justify-center px-1 py-2 active:opacity-80"
      style={[style, appearance.surface]}
    >
      <Icon name={icon} size={24} color={color} />
      <Text
        className="mt-1 text-center text-[13px] font-semibold text-text-primary"
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
    </MotionPressable>
  );
}
