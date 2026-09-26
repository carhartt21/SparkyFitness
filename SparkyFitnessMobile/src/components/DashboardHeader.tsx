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
  return (
    <View className="pt-3 pb-2">
      <Pressable
        onPress={props.onHome ?? props.onToday}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.home', {
          defaultValue: 'X on Track — Dashboard',
        })}
        className="min-h-11 flex-row items-center gap-3 self-start mb-2"
      >
        <Image
          source={require('../../assets/brand/x-on-track-dark.png')}
          style={{ width: 40, height: 40 }}
          resizeMode="contain"
          accessible={false}
        />
        <Text className="text-xl font-bold text-text-primary">
          {t('app.name', { defaultValue: 'X on Track' })}
        </Text>
      </Pressable>
      <View
        style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row' }}
        className="items-center justify-between gap-1"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.chooseDate', {
            defaultValue: 'Choose dashboard date',
          })}
          onPress={props.onDatePress}
          className="flex-row items-center gap-2 min-h-11 flex-shrink px-1"
        >
          <Icon name="calendar" size={20} color={color} />
          <Text className="text-sm font-medium text-text-primary flex-shrink">
            {formatDate(props.selectedDate, locale)}
          </Text>
          <Icon name="chevron-down" size={12} color={color} />
        </Pressable>
        <View className="flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('familyDiary.previousDay', {
              defaultValue: 'Previous day',
            })}
            onPress={props.onPreviousDay}
            className="min-w-11 min-h-11 items-center justify-center"
          >
            <Icon name="chevron-back" size={18} color={color} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={props.onToday}
            className="min-w-11 min-h-11 px-2 rounded-full bg-surface items-center justify-center"
          >
            <Text className="text-sm font-medium text-text-primary">
              {t('dashboard.today', { defaultValue: 'Today' })}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('familyDiary.nextDay', {
              defaultValue: 'Next day',
            })}
            onPress={props.onNextDay}
            className="min-w-11 min-h-11 items-center justify-center"
          >
            <Icon name="chevron-forward" size={18} color={color} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
