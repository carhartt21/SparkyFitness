import {
  Image,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import { useAppLocale } from '../localization';
import { formatDate } from '../utils/dateUtils';
import Icon from './Icon';

interface Props {
  selectedDate: string;
  onHome?: () => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onDatePress: () => void;
}

export default function DashboardHeader(props: Props) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { fontScale } = useWindowDimensions();
  const color = useCSSVariable('--color-text-primary') as string;
  const today = (
    <Pressable
      accessibilityRole="button"
      testID="dashboard-today"
      onPress={props.onToday}
      className="min-w-11 min-h-11 px-2 rounded-md border border-border-subtle bg-surface items-center justify-center active:opacity-70"
    >
      <Text className="text-sm font-medium text-text-link">
        {t('dashboard.today', { defaultValue: 'Today' })}
      </Text>
    </Pressable>
  );

  return (
    <View className="pt-3 pb-3 gap-2">
      <View className="flex-row items-center gap-2">
        <Pressable
          testID="dashboard-home"
          onPress={props.onHome ?? props.onToday}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.home', {
            defaultValue: 'X on Track — Dashboard',
          })}
          className="w-11 min-h-11 items-center justify-center active:opacity-70"
        >
          <Image
            source={require('../../assets/brand/x-on-track-dark.png')}
            style={{ width: 40, height: 40, borderRadius: 8 }}
            resizeMode="contain"
            accessible={false}
          />
        </Pressable>
        <View className="flex-1 flex-row items-center rounded-md border border-border-subtle bg-surface overflow-hidden">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('familyDiary.previousDay', {
              defaultValue: 'Previous day',
            })}
            testID="dashboard-previous-day"
            onPress={props.onPreviousDay}
            className="w-11 min-h-11 items-center justify-center active:bg-raised"
          >
            <Icon name="chevron-back" size={18} color={color} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.chooseDate', {
              defaultValue: 'Choose dashboard date',
            })}
            accessibilityValue={{ text: props.selectedDate }}
            testID="dashboard-date"
            onPress={props.onDatePress}
            className="flex-1 min-w-11 min-h-11 flex-row items-center justify-center gap-1 py-2 active:bg-raised"
          >
            <Text className="text-sm font-medium text-text-primary flex-shrink text-center">
              {formatDate(props.selectedDate, locale)}
            </Text>
            <Icon name="chevron-down" size={12} color={color} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('familyDiary.nextDay', {
              defaultValue: 'Next day',
            })}
            testID="dashboard-next-day"
            onPress={props.onNextDay}
            className="w-11 min-h-11 items-center justify-center active:bg-raised"
          >
            <Icon name="chevron-forward" size={18} color={color} />
          </Pressable>
        </View>
        {fontScale <= 1.3 && today}
      </View>
      {fontScale > 1.3 && <View className="self-end">{today}</View>}
    </View>
  );
}
