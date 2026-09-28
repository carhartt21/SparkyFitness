import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { type IconName } from './Icon';
import IconBadge from './ui/IconBadge';
import { glowSurfaceStyle, useGlowTheme } from './ui/glow';

interface CreateTileProps {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
  /** Hex accent for the tile's icon and glow; defaults to the app accent. */
  color?: string;
}

const CreateTile: React.FC<CreateTileProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
  className = '',
  color,
}) => {
  const accentPrimary = useCSSVariable('--color-accent-primary') as string;
  const glowing = useGlowTheme();
  const tint = color ?? accentPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityState={{ disabled }}
      style={[
        glowSurfaceStyle(tint, glowing, 'soft'),
        disabled ? { opacity: 0.7 } : null,
      ]}
      className={`bg-surface rounded-2xl border border-border-subtle px-3 py-3 flex-row items-center ${className}`}
    >
      <IconBadge icon={icon} color={tint} size={40} />
      <View className="flex-1 ml-3">
        <Text
          className="text-text-primary text-sm font-medium"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="text-text-secondary text-xs" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default CreateTile;
