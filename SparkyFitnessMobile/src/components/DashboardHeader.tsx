import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import AppHeaderRow from './AppHeaderRow';
import DateBar from './DateBar';

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

  return (
    <View className="pt-3 pb-3 gap-3">
      <AppHeaderRow
        title={t('dashboard.appName', { defaultValue: 'X on Track' })}
        subtitle={t('dashboard.tagline', {
          defaultValue: 'Keep getting better.',
        })}
        onSettings={props.onSettings}
        onLogoPress={props.onHome ?? props.onToday}
        logoTestID="dashboard-home"
        logoAccessibilityLabel={t('dashboard.home', {
          defaultValue: 'X on Track — Dashboard',
        })}
      />

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
