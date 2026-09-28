import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import { useAppLocale } from '../localization';
import { formatDate, getTodayDate } from '../utils/dateUtils';
import Icon from './Icon';
import GlowCard from './ui/GlowCard';
import { withAlpha } from './ui/glow';

interface DateBarProps {
  selectedDate: string;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onDatePress: () => void;
  /** Prefix for testIDs, e.g. `dashboard` → `dashboard-date`. */
  testIDPrefix: string;
  chooseDateLabel: string;
}

/**
 * Full-width date control from the references: previous/next chevrons around
 * a calendar date that opens the picker. Today appears only on other days.
 */
export default function DateBar({
  selectedDate,
  onPreviousDay,
  onNextDay,
  onToday,
  onDatePress,
  testIDPrefix,
  chooseDateLabel,
}: DateBarProps) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { fontScale } = useWindowDimensions();
  const [color, secondary, accent] = useCSSVariable([
    '--color-text-primary',
    '--color-text-secondary',
    '--color-accent-primary',
  ]) as [string, string, string];
  const isToday = selectedDate === getTodayDate();
  const todayLabel = t('dashboard.today', { defaultValue: 'Today' });

  return (
    <View className="gap-2">
      <GlowCard className="flex-row items-center overflow-hidden">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('familyDiary.previousDay', {
            defaultValue: 'Previous day',
          })}
          testID={`${testIDPrefix}-previous-day`}
          onPress={onPreviousDay}
          className="w-12 min-h-12 items-center justify-center active:bg-raised"
        >
          <Icon name="chevron-back" size={18} color={color} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={chooseDateLabel}
          accessibilityValue={{ text: selectedDate }}
          testID={`${testIDPrefix}-date`}
          onPress={onDatePress}
          className="flex-1 min-h-12 flex-row items-center justify-center gap-2 py-2 active:bg-raised"
        >
          <Icon name="calendar" size={18} color={secondary} />
          <Text className="text-base font-medium text-text-primary flex-shrink text-center">
            {formatDate(selectedDate, locale)}
          </Text>
        </Pressable>
        {!isToday && fontScale <= 1.3 ? (
          <Pressable
            accessibilityRole="button"
            testID={`${testIDPrefix}-today`}
            onPress={onToday}
            className="min-h-12 justify-center px-1 active:opacity-70"
          >
            <View
              className="rounded-full px-3 py-1.5"
              style={{ backgroundColor: withAlpha(accent, 0.14) }}
            >
              <Text className="text-xs font-semibold text-text-link">
                {todayLabel}
              </Text>
            </View>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('familyDiary.nextDay', {
            defaultValue: 'Next day',
          })}
          testID={`${testIDPrefix}-next-day`}
          onPress={onNextDay}
          className="w-12 min-h-12 items-center justify-center active:bg-raised"
        >
          <Icon name="chevron-forward" size={18} color={color} />
        </Pressable>
      </GlowCard>
      {!isToday && fontScale > 1.3 ? (
        <Pressable
          accessibilityRole="button"
          testID={`${testIDPrefix}-today`}
          onPress={onToday}
          className="min-h-11 self-end justify-center rounded-full border border-border-subtle bg-surface px-4 active:opacity-70"
        >
          <Text className="text-sm font-semibold text-text-link">
            {todayLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
