import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Platform } from 'react-native';
import Switch from './ui/Switch';

interface SyncFrequencyProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const SyncFrequency: React.FC<SyncFrequencyProps> = ({
  isEnabled,
  onToggle,
}) => {
  const { t } = useTranslation();
  return (
    <View className="bg-surface rounded-xl border border-border-subtle p-4 mb-4">
      <Text className="text-lg font-bold mb-3 text-text-primary">
        {t('syncFrequency.title', { defaultValue: 'Background Sync' })}
      </Text>
      <View className="flex-row justify-between items-center gap-3">
        <Text className="min-w-0 flex-1 text-base text-text-primary">
          {t('syncFrequency.enable', {
            defaultValue: 'Enable Background Sync',
          })}
        </Text>
        <Switch
          accessibilityLabel={t('syncFrequency.toggleLabel', {
            defaultValue: 'Background sync',
          })}
          accessibilityHint={t('syncFrequency.toggleHint', {
            defaultValue: 'Toggles background health data synchronization.',
          })}
          onValueChange={onToggle}
          value={isEnabled}
        />
      </View>
      {Platform.OS === 'ios' && (
        <Text className="text-sm text-text-secondary mt-3">
          {t('syncFrequency.iosNote', {
            defaultValue:
              'When enabled, the app will update in the background when your phone allows it. Manually syncing will always update right away.',
          })}
        </Text>
      )}
    </View>
  );
};

export default SyncFrequency;
