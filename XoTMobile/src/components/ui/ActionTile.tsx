import {
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import MotionPressable from './MotionPressable';
import Icon, { type IconName } from '../Icon';
import { useButtonAppearance } from './buttonTheme';

interface ActionTileProps {
  label: string;
  sublabel?: string;
  /** Keep labels on one baseline when neighboring tiles show supporting copy. */
  reserveSublabel?: boolean;
  icon: IconName;
  /** Hex theme color that tints the border, glow, fill and icon. */
  color: string;
  onPress: () => void;
  onLongPress?: () => void;
  longPressLabel?: string;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Neon quick-action tile (Log Food, Log Water, Scan, …). */
export default function ActionTile({
  label,
  sublabel,
  reserveSublabel = false,
  icon,
  color,
  onPress,
  onLongPress,
  longPressLabel,
  testID,
  accessibilityLabel,
  style,
}: ActionTileProps) {
  const appearance = useButtonAppearance('outline', false, color);
  const { fontScale } = useWindowDimensions();
  return (
    <MotionPressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityHint={longPressLabel}
      accessibilityActions={
        onLongPress && longPressLabel
          ? [{ name: 'longpress', label: longPressLabel }]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'longpress') onLongPress?.();
      }}
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
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
      {sublabel || reserveSublabel ? (
        <View style={{ height: 14 * Math.min(fontScale, 1.6) }}>
          <Text
            className="text-center text-[11px] text-text-secondary"
            maxFontSizeMultiplier={1.6}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={{ lineHeight: 14 }}
          >
            {sublabel || '\u00a0'}
          </Text>
        </View>
      ) : null}
    </MotionPressable>
  );
}
