import { useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  ScrollView,
  View,
  RefreshControl,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useActiveWorkoutBarPadding } from './ActiveWorkoutBar';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import DateBar from './DateBar';
import CalendarSheet, { type CalendarSheetRef } from './CalendarSheet';
import { addDays, getTodayDate } from '../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import ScreenBackground from './ui/ScreenBackground';

/** Shared dated frame for Meals, Training and hydration; logging remains in-domain. */
export default function DailyDetailScreen({
  title,
  date,
  onDateChange,
  children,
  footer,
  onRefresh,
  scrollRef,
  ...scrollProps
}: {
  title: string;
  date: string;
  onDateChange: (date: string) => void;
  children: ReactNode;
  footer?: ReactNode;
  onRefresh?: () => Promise<unknown>;
  scrollRef?: RefObject<ScrollView | null>;
} & Pick<ScrollViewProps, 'onScroll' | 'onLayout'>) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const native = useNativeIOSHeadersActive();
  const bar = useActiveWorkoutBarPadding();
  const [refreshing, setRefreshing] = useState(false);
  const refreshBusy = useRef(false);
  const setSelectedDate = useDiaryDateStore((state) => state.setSelectedDate);
  const changeDate = (day: string) => {
    setSelectedDate(day);
    onDateChange(day);
  };
  const refresh = async () => {
    if (!onRefresh || refreshBusy.current) return;
    refreshBusy.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      refreshBusy.current = false;
      setRefreshing(false);
    }
  };
  const calendar = useRef<CalendarSheetRef>(null);
  const header = useScreenHeader({ title, left: { kind: 'back' } });
  return (
    <View
      className="flex-1 bg-background"
      style={native ? undefined : { paddingTop: insets.top }}
    >
      <ScreenBackground />
      {header}
      <View className="px-4 pb-3">
        <DateBar
          selectedDate={date}
          testIDPrefix="daily-detail"
          chooseDateLabel={t('diary.chooseDate', {
            defaultValue: 'Choose diary date',
          })}
          onToday={() => changeDate(getTodayDate())}
          onPreviousDay={() => changeDate(addDays(date, -1))}
          onNextDay={() => changeDate(addDays(date, 1))}
          onDatePress={() => calendar.current?.present()}
        />
      </View>
      <ScrollView
        ref={scrollRef}
        {...scrollProps}
        scrollEventThrottle={16}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
            />
          ) : undefined
        }
        contentContainerStyle={{
          padding: 16,
          paddingTop: 0,
          paddingBottom: Math.max(insets.bottom, 16) + bar + 16,
        }}
      >
        {children}
      </ScrollView>
      {footer}
      <CalendarSheet
        ref={calendar}
        selectedDate={date}
        onSelectDate={changeDate}
      />
    </View>
  );
}
