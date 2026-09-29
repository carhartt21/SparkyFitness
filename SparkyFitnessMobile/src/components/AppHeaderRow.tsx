import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import BrandMark from './brand/BrandMark';
import SettingsHeaderButton from './SettingsHeaderButton';
import { useGlowTheme, withAlpha } from './ui/glow';

interface AppHeaderRowProps {
  title: string;
  subtitle?: string;
  onSettings: () => void;
  /** Makes the logo a button, e.g. back to today on the Dashboard. */
  onLogoPress?: () => void;
  logoAccessibilityLabel?: string;
  logoTestID?: string;
  /** Extra actions shown before Settings, e.g. the Diary's family button. */
  right?: ReactNode;
}

/**
 * The shared top-level header row: X on Track logo on the left, the screen
 * identity, and Settings in the upper-right corner. Detail and modal screens
 * keep their own Back/Close headers instead.
 */
export default function AppHeaderRow({
  title,
  subtitle,
  onSettings,
  onLogoPress,
  logoAccessibilityLabel,
  logoTestID = 'app-header-logo',
  right,
}: AppHeaderRowProps) {
  const { t } = useTranslation();
  const glowing = useGlowTheme();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const logoClass =
    'h-12 w-12 items-center justify-center rounded-2xl border border-border-subtle bg-surface';
  const logoStyle = glowing
    ? { boxShadow: `0px 0px 12px 0px ${withAlpha(accent, 0.3)}` }
    : undefined;
  const logo = <BrandMark size={38} />;

  return (
    <View className="flex-row items-center gap-3">
      {onLogoPress ? (
        <Pressable
          testID={logoTestID}
          onPress={onLogoPress}
          accessibilityRole="button"
          accessibilityLabel={
            logoAccessibilityLabel ??
            t('brand.name', { defaultValue: 'X on Track' })
          }
          className={`${logoClass} active:opacity-70`}
          style={logoStyle}
        >
          {logo}
        </Pressable>
      ) : (
        <View testID={logoTestID} className={logoClass} style={logoStyle}>
          {logo}
        </View>
      )}
      <View className="flex-1" accessible accessibilityRole="header">
        <Text
          className="text-[26px] font-bold text-text-primary"
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.4}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-sm text-text-secondary"
            maxFontSizeMultiplier={1.6}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      <SettingsHeaderButton onPress={onSettings} />
    </View>
  );
}
