import { View } from 'react-native';
import Icon, { type IconName } from '../Icon';
import { useGlowTheme, withAlpha } from './glow';

/** Tinted circular icon holder used in stat rows, list rows and settings. */
export default function IconBadge({
  icon,
  color,
  size = 40,
}: {
  icon: IconName;
  color: string;
  size?: number;
}) {
  const glowing = useGlowTheme();
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: withAlpha(color, glowing ? 0.16 : 0.12),
        boxShadow: glowing
          ? `0px 0px 10px 0px ${withAlpha(color, 0.25)}`
          : undefined,
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}
