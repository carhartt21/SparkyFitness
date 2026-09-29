import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import CalendarSheet, { type CalendarSheetRef } from '../CalendarSheet';
import DateBar from '../DateBar';
import Icon from '../Icon';
import ScreenBackground from '../ui/ScreenBackground';
import { addDays, getTodayDate } from '../../utils/dateUtils';

interface TrackingScreenProps {
  title: string;
  subtitle: string;
  /** Omit for screens that are not tied to one day. */
  date?: string;
  onDateChange?: (date: string) => void;
  onBack: () => void;
  /** Trailing header content next to the title, e.g. a summary pill. */
  titleAccessory?: React.ReactNode;
  onRefresh?: () => Promise<unknown>;
  /** Pinned below the scroll view, e.g. the check-in actions. */
  footer?: React.ReactNode;
  testID: string;
  children: React.ReactNode;
}

/**
 * Shared frame for the daily tracking screens (check-in, habits, supplements,
 * progress, context): back button, the reference date bar with calendar
 * picker, a large title and a neon-lit scrolling body.
 */
export default function TrackingScreen({
  title,
  subtitle,
  date,
  onDateChange,
  onBack,
  titleAccessory,
  onRefresh,
  footer,
  testID,
  children,
}: TrackingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const calendarRef = useRef<CalendarSheetRef>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [textPrimary, accent] = useCSSVariable([
    '--color-text-primary',
    '--color-accent-primary',
  ]) as [string, string];

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <View className="flex-1 bg-background" testID={testID}>
      <ScreenBackground />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: footer ? 16 : insets.bottom + 32,
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={accent}
              />
            ) : undefined
          }
        >
          <View className="mb-3 flex-row items-center gap-3">
            <Pressable
              testID={`${testID}-back`}
              accessibilityRole="button"
              accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
              onPress={onBack}
              className="h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-surface active:opacity-70"
            >
              <Icon name="chevron-back" size={20} color={textPrimary} />
            </Pressable>
            {date && onDateChange ? (
              <View className="flex-1">
                <DateBar
                  selectedDate={date}
                  onPreviousDay={() => onDateChange(addDays(date, -1))}
                  onNextDay={() => onDateChange(addDays(date, 1))}
                  onToday={() => onDateChange(getTodayDate())}
                  onDatePress={() => calendarRef.current?.present()}
                  testIDPrefix={testID}
                  chooseDateLabel={t('tracking.chooseDate', {
                    defaultValue: 'Choose date',
                  })}
                />
              </View>
            ) : null}
          </View>
          <View className="mb-4 flex-row items-start gap-3">
            <View className="flex-1">
              <Text
                accessibilityRole="header"
                className="text-[32px] font-bold text-text-primary"
                maxFontSizeMultiplier={1.4}
              >
                {title}
              </Text>
              <Text
                className="text-base text-text-secondary"
                maxFontSizeMultiplier={1.6}
              >
                {subtitle}
              </Text>
            </View>
            {titleAccessory}
          </View>
          {children}
        </ScrollView>
        {footer ? (
          <View
            className="px-4 pt-2"
            style={{ paddingBottom: insets.bottom + 8 }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {date && onDateChange ? (
        <CalendarSheet
          ref={calendarRef}
          selectedDate={date}
          onSelectDate={onDateChange}
        />
      ) : null}
    </View>
  );
}
