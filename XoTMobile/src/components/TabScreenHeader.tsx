import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import AppHeaderRow from './AppHeaderRow';

interface TabScreenHeaderProps {
  title: string;
  subtitle?: string;
  onSettings: () => void;
  onHome: () => void;
  /** Optional trailing action, e.g. the Diary's family-diaries button. */
  right?: ReactNode;
}

/**
 * Title block for content tabs on the screen-owned header path, using the
 * shared logo / title / Settings row so every top-level tab lines up with
 * the Dashboard.
 */
export default function TabScreenHeader({
  title,
  subtitle,
  onSettings,
  onHome,
  right,
}: TabScreenHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className="pb-3">
      <AppHeaderRow
        title={title}
        subtitle={subtitle}
        onSettings={onSettings}
        onLogoPress={onHome}
        logoAccessibilityLabel={t('dashboard.home', {
          defaultValue: 'X on Track — Dashboard',
        })}
        right={right}
      />
    </View>
  );
}
