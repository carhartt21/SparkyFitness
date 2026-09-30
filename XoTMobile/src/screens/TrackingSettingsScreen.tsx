import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  DailyTrackingPreferences,
  MeasurementReminderDaypart,
} from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import { useNeonScale } from '../components/tracking/useNeonScale';
import { daypartLabel } from '../components/tracking/trackingLabels';
import GlowCard from '../components/ui/GlowCard';
import Switch from '../components/ui/Switch';
import { withAlpha } from '../components/ui/glow';
import SegmentedControl from '../components/SegmentedControl';
import TimeSheet, { type TimeSheetRef } from '../components/TimeSheet';
import StatusView from '../components/StatusView';
import Icon from '../components/Icon';
import {
  useDailyTrackingPreferences,
  useMeasurementReminders,
  useSaveMeasurementReminder,
  useUpdateDailyTrackingPreferences,
} from '../hooks/useDailyTracking';
import { usePreferences, useServerConnection } from '../hooks';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import {
  formatLocalizedTimeOfDay,
  localizedWeekdayLabels,
} from '../utils/medicationScheduleLocalization';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TrackingSettings'>;

const DAYPART_DEFAULT_TIME: Record<MeasurementReminderDaypart, string> = {
  morning: '07:30',
  midday: '12:30',
  evening: '19:30',
};

const ToggleRow: React.FC<{
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID: string;
  showDivider?: boolean;
}> = ({ title, subtitle, value, onChange, testID, showDivider }) => {
  const border = useCSSVariable('--color-border-subtle') as string;
  return (
    <View
      className="min-h-14 flex-row items-center gap-3 py-2"
      style={
        showDivider ? { borderTopWidth: 1, borderTopColor: border } : undefined
      }
    >
      <View className="flex-1">
        <Text className="text-base text-text-primary">{title}</Text>
        {subtitle ? (
          <Text className="text-xs text-text-secondary">{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        accessibilityLabel={title}
      />
    </View>
  );
};

const TrackingSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const [secondary, border] = useCSSVariable([
    '--color-text-secondary',
    '--color-border-subtle',
  ]) as [string, string];
  const { isConnected } = useServerConnection();
  const { preferences: userPreferences } = usePreferences({
    enabled: isConnected,
  });
  const notificationsEnabled = useAppPreferencesStore(
    (s) => s.notificationsEnabled
  );
  const preferencesQuery = useDailyTrackingPreferences({
    enabled: isConnected,
  });
  const updatePreferences = useUpdateDailyTrackingPreferences();
  const remindersQuery = useMeasurementReminders({ enabled: isConnected });
  const saveReminder = useSaveMeasurementReminder();
  const checkinTimeSheet = useRef<TimeSheetRef>(null);
  const weighInTimeSheet = useRef<TimeSheetRef>(null);
  const weekdays = localizedWeekdayLabels(t);
  const [pendingCheckinTime, setPendingCheckinTime] = useState<string | null>(
    null
  );

  const preferences = preferencesQuery.data;
  const weighIn = remindersQuery.data?.find(
    (reminder) => reminder.measurement_key === 'weight'
  );

  const patch = (body: Partial<DailyTrackingPreferences>) =>
    updatePreferences.mutate(body, {
      onError: () =>
        Toast.show({
          type: 'error',
          text1: t('trackingSettings.saveFailed', {
            defaultValue: 'Could not save the setting.',
          }),
        }),
    });

  const saveWeighIn = (body: {
    enabled?: boolean;
    days?: number[] | null;
    daypart?: MeasurementReminderDaypart;
    reminder_time?: string;
    include_in_daily_progress?: boolean;
  }) =>
    saveReminder.mutate(
      {
        measurement_key: 'weight',
        enabled: body.enabled ?? weighIn?.enabled ?? true,
        ...(body.days !== undefined ? { days: body.days } : {}),
        ...(body.daypart ? { daypart: body.daypart } : {}),
        ...(body.reminder_time ? { reminder_time: body.reminder_time } : {}),
        ...(body.include_in_daily_progress !== undefined
          ? { include_in_daily_progress: body.include_in_daily_progress }
          : {}),
      },
      {
        onError: () =>
          Toast.show({
            type: 'error',
            text1: t('trackingSettings.saveFailed', {
              defaultValue: 'Could not save the setting.',
            }),
          }),
      }
    );

  const time = (value: string) =>
    formatLocalizedTimeOfDay(value, undefined, userPreferences?.time_format);

  if (!isConnected) {
    return (
      <TrackingScreen
        testID="tracking-settings"
        title={t('trackingSettings.title', {
          defaultValue: 'Tracking settings',
        })}
        subtitle={t('trackingSettings.subtitle', {
          defaultValue:
            'Choose what counts toward Daily Progress and when to be reminded.',
        })}
        onBack={navigation.goBack}
      >
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          title={t('trackingSettings.offline', {
            defaultValue: 'Connect to your server to change these settings.',
          })}
        />
      </TrackingScreen>
    );
  }

  const weighInDays = weighIn?.days ?? [0, 1, 2, 3, 4, 5, 6];

  return (
    <TrackingScreen
      testID="tracking-settings"
      title={t('trackingSettings.title', { defaultValue: 'Tracking settings' })}
      subtitle={t('trackingSettings.subtitle', {
        defaultValue:
          'Choose what counts toward Daily Progress and when to be reminded.',
      })}
      onBack={navigation.goBack}
    >
      {!preferences ? (
        <StatusView
          loading
          title={t('trackingSettings.loading', { defaultValue: 'Loading…' })}
        />
      ) : (
        <>
          <Text className="mb-2 text-sm font-semibold uppercase text-text-secondary">
            {t('trackingSettings.countsTitle', {
              defaultValue: 'Counts toward Daily Progress',
            })}
          </Text>
          <GlowCard
            className="mb-4 px-4 py-1"
            testID="tracking-settings-counts"
          >
            <ToggleRow
              testID="tracking-include-checkin"
              title={t('trackingSettings.includeCheckin', {
                defaultValue: 'Daily check-in',
              })}
              value={preferences.include_checkin}
              onChange={(value) => patch({ include_checkin: value })}
            />
            <ToggleRow
              testID="tracking-include-habits"
              title={t('trackingSettings.includeHabits', {
                defaultValue: 'Scheduled habits',
              })}
              value={preferences.include_habits}
              onChange={(value) => patch({ include_habits: value })}
              showDivider
            />
            <ToggleRow
              testID="tracking-include-supplements"
              title={t('trackingSettings.includeSupplements', {
                defaultValue: 'Scheduled supplements',
              })}
              value={preferences.include_supplements}
              onChange={(value) => patch({ include_supplements: value })}
              showDivider
            />
            <ToggleRow
              testID="tracking-include-meals"
              title={t('trackingSettings.includeMeals', {
                defaultValue: 'Meals marked complete',
              })}
              subtitle={t('trackingSettings.includeMealsHint', {
                defaultValue:
                  'Each visible meal counts once you mark it complete or “no meal”.',
              })}
              value={preferences.include_meals}
              onChange={(value) => patch({ include_meals: value })}
              showDivider
            />
          </GlowCard>

          <Text className="mb-2 text-sm font-semibold uppercase text-text-secondary">
            {t('trackingSettings.remindersTitle', {
              defaultValue: 'Optional reminders',
            })}
          </Text>
          {!notificationsEnabled ? (
            <Text className="mb-2 text-xs text-text-secondary">
              {t('trackingSettings.notificationsOff', {
                defaultValue:
                  'Notifications are off on this device, so no reminder is shown.',
              })}
            </Text>
          ) : null}
          <GlowCard
            className="mb-4 px-4 py-1"
            testID="tracking-settings-reminders"
          >
            <ToggleRow
              testID="tracking-checkin-reminder"
              title={t('trackingSettings.checkinReminder', {
                defaultValue: 'Check-in reminder',
              })}
              subtitle={
                preferences.checkin_reminder_enabled
                  ? time(
                      pendingCheckinTime ?? preferences.checkin_reminder_time
                    )
                  : undefined
              }
              value={preferences.checkin_reminder_enabled}
              onChange={(value) => patch({ checkin_reminder_enabled: value })}
            />
            {preferences.checkin_reminder_enabled ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => checkinTimeSheet.current?.present()}
                className="min-h-11 flex-row items-center gap-2 pb-2"
              >
                <Icon name="clock" size={16} color={scale.green} />
                <Text className="text-sm text-text-link">
                  {t('trackingSettings.changeTime', {
                    defaultValue: 'Change time',
                  })}
                </Text>
              </Pressable>
            ) : null}
            <ToggleRow
              testID="tracking-habit-reminders"
              title={t('trackingSettings.habitReminders', {
                defaultValue: 'Habit reminders',
              })}
              subtitle={t('trackingSettings.habitRemindersHint', {
                defaultValue:
                  'At each habit’s reminder time, only while it is not recorded.',
              })}
              value={preferences.habit_reminders_enabled}
              onChange={(value) => patch({ habit_reminders_enabled: value })}
              showDivider
            />
            <ToggleRow
              testID="tracking-weigh-in"
              title={t('trackingSettings.weighIn', {
                defaultValue: 'Weigh-in reminder',
              })}
              subtitle={
                weighIn?.enabled
                  ? time(weighIn.reminder_time)
                  : t('trackingSettings.weighInHint', {
                      defaultValue:
                        'Opens the weight entry; nothing is filled in for you.',
                    })
              }
              value={weighIn?.enabled ?? false}
              onChange={(value) => saveWeighIn({ enabled: value })}
              showDivider
            />
            {weighIn?.enabled ? (
              <View className="gap-3 pb-3">
                <SegmentedControl
                  segments={[
                    { key: 'morning', label: daypartLabel(t, 'morning') },
                    { key: 'midday', label: daypartLabel(t, 'midday') },
                    { key: 'evening', label: daypartLabel(t, 'evening') },
                  ]}
                  activeKey={weighIn.daypart}
                  onSelect={(key) => {
                    const daypart = key as MeasurementReminderDaypart;
                    saveWeighIn({
                      daypart,
                      reminder_time: DAYPART_DEFAULT_TIME[daypart],
                    });
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => weighInTimeSheet.current?.present()}
                  className="min-h-11 flex-row items-center gap-2"
                >
                  <Icon name="clock" size={16} color={scale.green} />
                  <Text className="text-sm text-text-link">
                    {t('trackingSettings.changeTime', {
                      defaultValue: 'Change time',
                    })}
                  </Text>
                </Pressable>
                <View className="flex-row flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const selected = weighInDays.includes(day);
                    return (
                      <Pressable
                        key={day}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={weekdays[day]}
                        onPress={() => {
                          const next = selected
                            ? weighInDays.filter((item) => item !== day)
                            : [...weighInDays, day];
                          if (next.length === 0) return;
                          saveWeighIn({
                            days: next.length === 7 ? null : next.sort(),
                          });
                        }}
                        className="h-11 min-w-11 items-center justify-center rounded-full border px-2"
                        style={{
                          borderColor: selected ? scale.green : border,
                          backgroundColor: selected
                            ? withAlpha(scale.green, 0.18)
                            : 'transparent',
                        }}
                      >
                        <Text className="text-sm text-text-primary">
                          {weekdays[day]?.slice(0, 2)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <ToggleRow
                  testID="tracking-weigh-in-progress"
                  title={t('trackingSettings.weighInProgress', {
                    defaultValue: 'Count weigh-ins toward Daily Progress',
                  })}
                  subtitle={t('trackingSettings.weighInProgressHint', {
                    defaultValue: 'Only on the days selected above.',
                  })}
                  value={weighIn.include_in_daily_progress}
                  onChange={(value) =>
                    saveWeighIn({ include_in_daily_progress: value })
                  }
                />
              </View>
            ) : null}
          </GlowCard>
          <Text className="mb-4 text-xs text-text-secondary">
            {t('trackingSettings.budgetNote', {
              defaultValue:
                'Optional reminders share a small daily budget, respect quiet hours and pause during context periods you choose. Medication and supplement reminders are separate.',
            })}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('HealthContext')}
            className="mb-6 min-h-11 flex-row items-center gap-2"
          >
            <Icon name="bandage" size={16} color={secondary} />
            <Text className="text-sm text-text-link">
              {t('trackingSettings.manageContext', {
                defaultValue: 'Manage injury, illness and vacation periods',
              })}
            </Text>
          </Pressable>

          <TimeSheet
            ref={checkinTimeSheet}
            value={pendingCheckinTime ?? preferences.checkin_reminder_time}
            commitOn="done"
            onSelectTime={(value) => {
              setPendingCheckinTime(value);
              patch({ checkin_reminder_time: value });
            }}
            timeFormat={userPreferences?.time_format}
          />
          <TimeSheet
            ref={weighInTimeSheet}
            value={weighIn?.reminder_time ?? DAYPART_DEFAULT_TIME.morning}
            commitOn="done"
            onSelectTime={(value) => saveWeighIn({ reminder_time: value })}
            timeFormat={userPreferences?.time_format}
          />
        </>
      )}
    </TrackingScreen>
  );
};

export default TrackingSettingsScreen;
