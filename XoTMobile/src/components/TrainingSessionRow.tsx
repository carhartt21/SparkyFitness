import { Text, View, useWindowDimensions } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from './Icon';
import MotionPressable from './ui/MotionPressable';

/** Clock, activity and metadata share one readable anatomy in the day and week views. */
export default function TrainingSessionRow({
  title,
  details,
  clock,
  icon,
  onPress,
  compact = false,
  inlineDetails = false,
}: {
  title: string;
  details: string;
  clock?: string | null;
  icon: IconName;
  onPress: () => void;
  compact?: boolean;
  inlineDetails?: boolean;
}) {
  const expanded = useWindowDimensions().fontScale > 1.3;
  const tight = compact && !expanded;
  const inline = tight && inlineDetails;
  const [accent, muted] = useCSSVariable([
    '--color-action-training',
    '--color-text-secondary',
  ]) as string[];
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={[clock, title, details].filter(Boolean).join(', ')}
      onPress={onPress}
      className={`flex-row items-center ${tight ? 'min-h-11 gap-2 py-1' : 'min-h-16 gap-3 py-3'}`}
    >
      {!expanded && clock && (
        <Text
          className="w-11 text-xs text-text-secondary"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {clock}
        </Text>
      )}
      <Icon name={icon} size={tight ? 20 : 28} color={accent} />
      <View className="min-w-0 flex-1 gap-0.5">
        {expanded && clock && (
          <Text className="text-xs text-text-secondary">{clock}</Text>
        )}
        <Text
          className={`${tight ? 'text-sm' : 'text-base'} font-semibold text-text-primary`}
        >
          {title}
          {inline && (
            <Text className="text-xs font-normal text-text-secondary">
              {' '}
              · {details}
            </Text>
          )}
        </Text>
        {!inline && (
          <Text className="text-xs leading-4 text-text-secondary">
            {details}
          </Text>
        )}
      </View>
      <Icon name="chevron-forward" size={18} color={muted} />
    </MotionPressable>
  );
}
