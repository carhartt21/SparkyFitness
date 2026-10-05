import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import Switch from './ui/Switch';

interface SyncOnOpenProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const SyncOnOpen: React.FC<SyncOnOpenProps> = ({ isEnabled, onToggle }) => {
  const { t } = useTranslation();
  return (
    <View className="bg-surface rounded-xl border border-border-subtle p-4 mb-4">
      <Text className="text-lg font-bold mb-3 text-text-primary">
        {t('syncOnOpen.title', { defaultValue: 'Sync on Open' })}
      </Text>
      <View className="flex-row justify-between items-center gap-3">
        <Text className="min-w-0 flex-1 text-base text-text-primary">
          {t('syncOnOpen.enable', { defaultValue: 'Sync when app opens' })}
        </Text>
        <Switch
          accessibilityLabel={t('syncOnOpen.toggleLabel', {
            defaultValue: 'Sync when app opens',
          })}
          accessibilityHint={t('syncOnOpen.toggleHint', {
            defaultValue:
              'Toggles automatic synchronization when the app opens.',
          })}
          onValueChange={onToggle}
          value={isEnabled}
        />
      </View>
      <Text className="text-sm text-text-secondary mt-3">
        {t('syncOnOpen.description', {
          defaultValue:
            'When enabled, health data will sync automatically when you open the app.',
        })}
      </Text>
    </View>
  );
};

export default SyncOnOpen;
