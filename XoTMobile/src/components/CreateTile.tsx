import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { type IconName } from './Icon';
import IconBadge from './ui/IconBadge';
import { useButtonAppearance } from './ui/buttonTheme';

interface CreateTileProps {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
  /** Hex accent for the tile's icon and glow; defaults to the app accent. */
  color?: string;
  testID?: string;
  /** Allow complete labels when the caller switches to accessible full-width rows. */
  wrapText?: boolean;
}

const CreateTile: React.FC<CreateTileProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
  className = '',
  color,
  testID,
  wrapText = false,
}) => {
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;
  const tint = color ?? accentPrimary;
  const appearance = useButtonAppearance('secondary', disabled, tint);

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityState={{ disabled }}
      style={[appearance.surface, disabled ? { opacity: 0.7 } : null]}
      className={`px-3 py-3 flex-row items-center ${className}`}
    >
      <IconBadge icon={icon} color={tint} size={40} />
      <View className="flex-1 ml-3">
        <Text
          className="text-text-primary text-sm font-medium"
          numberOfLines={wrapText ? undefined : 1}
        >
          {title}
        </Text>
        <Text
          className="text-text-secondary text-xs"
          numberOfLines={wrapText ? undefined : 1}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default CreateTile;
