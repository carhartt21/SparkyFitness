import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import SettingsHeaderButton from './SettingsHeaderButton';

interface TabScreenHeaderProps {
  title: string;
  subtitle?: string;
  onSettings: () => void;
  /** Optional trailing action, e.g. the Diary's family-diaries button. */
  right?: ReactNode;
}

/**
 * Title block for content tabs on the screen-owned header path: Settings in
 * the upper-left corner, a large title with a short subtitle, and an optional
 * trailing action, matching the references' page headers.
 */
export default function TabScreenHeader({
  title,
  subtitle,
  onSettings,
  right,
}: TabScreenHeaderProps) {
  return (
    <View className="flex-row items-center gap-3 pb-3">
      <SettingsHeaderButton onPress={onSettings} />
      <View className="flex-1">
        <Text
          className="text-[28px] font-bold text-text-primary"
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-sm text-text-secondary"
            maxFontSizeMultiplier={1.6}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
