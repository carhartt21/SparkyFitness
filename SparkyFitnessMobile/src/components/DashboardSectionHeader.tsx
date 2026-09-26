import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Icon, { type IconName } from './Icon';

export default function DashboardSectionHeader({
  title,
  compact = false,
  icon,
  color,
  onDetails,
  testID,
}: {
  title: string;
  compact?: boolean;
  icon: IconName;
  color: string;
  onDetails?: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const accent = useCSSVariable('--color-text-link') as string;
  if (compact && onDetails) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${t('common.details', { defaultValue: 'Details' })}`}
        onPress={onDetails}
        className="flex-row items-center min-h-11 mb-1 gap-2"
      >
        <Icon name={icon} size={20} color={color} />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-text-primary">
            {title}
          </Text>
          <Text className="text-xs font-medium text-text-link">
            {t('common.details', { defaultValue: 'Details' })}
          </Text>
        </View>
        <Icon name="chevron-forward" size={12} color={accent} />
      </Pressable>
    );
  }
  return (
    <View
      style={{
        flexDirection: compact ? 'column' : 'row',
        alignItems: compact ? 'flex-start' : 'center',
      }}
      className="flex-wrap justify-between gap-x-2 mb-2"
    >
      <View className="flex-row items-center gap-2 min-h-8 flex-shrink">
        <Icon name={icon} size={22} color={color} />
        <Text className="text-base font-semibold text-text-primary flex-shrink">
          {title}
        </Text>
      </View>
      {onDetails && (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`${title}: ${t('common.details', { defaultValue: 'Details' })}`}
          onPress={onDetails}
          className="flex-row items-center gap-1 min-h-11 min-w-11"
        >
          <Text className="text-xs font-medium text-text-link">
            {t('common.details', { defaultValue: 'Details' })}
          </Text>
          <Icon name="chevron-forward" size={12} color={accent} />
        </Pressable>
      )}
    </View>
  );
}
