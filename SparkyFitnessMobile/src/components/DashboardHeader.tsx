import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import BrandMark from './brand/BrandMark';
import SettingsHeaderButton from './SettingsHeaderButton';
import DateBar from './DateBar';
import { useGlowTheme, withAlpha } from './ui/glow';

interface Props {
  selectedDate: string;
  onHome?: () => void;
  onSettings: () => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onDatePress: () => void;
}

/**
 * Dashboard header from the reference: logo and product name on the first
 * line with Settings in the upper-right corner, then a full-width date bar.
 */
export default function DashboardHeader(props: Props) {
  const { t } = useTranslation();
  const glowing = useGlowTheme();
  const accent = useCSSVariable('--color-accent-primary') as string;

  return (
    <View className="pt-3 pb-3 gap-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          testID="dashboard-home"
          onPress={props.onHome ?? props.onToday}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.home', {
            defaultValue: 'X on Track — Dashboard',
          })}
          className="h-14 w-14 items-center justify-center rounded-2xl border border-border-subtle bg-surface active:opacity-70"
          style={
            glowing
              ? { boxShadow: `0px 0px 14px 0px ${withAlpha(accent, 0.35)}` }
              : undefined
          }
        >
          <BrandMark size={44} />
        </Pressable>
        <View className="flex-1" accessible accessibilityRole="header">
          <Text
            className="text-[26px] font-bold text-text-primary"
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.4}
          >
            {t('dashboard.appName', { defaultValue: 'X on Track' })}
          </Text>
          <Text
            className="text-sm text-text-secondary"
            maxFontSizeMultiplier={1.6}
          >
            {t('dashboard.tagline', { defaultValue: 'Keep getting better.' })}
          </Text>
        </View>
        <SettingsHeaderButton onPress={props.onSettings} />
      </View>

      <DateBar
        selectedDate={props.selectedDate}
        onPreviousDay={props.onPreviousDay}
        onNextDay={props.onNextDay}
        onToday={props.onToday}
        onDatePress={props.onDatePress}
        testIDPrefix="dashboard"
        chooseDateLabel={t('dashboard.chooseDate', {
          defaultValue: 'Choose dashboard date',
        })}
      />
    </View>
  );
}
