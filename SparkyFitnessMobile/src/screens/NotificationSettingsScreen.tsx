import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, View, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import NotificationPermissionBanner, {
  type NotificationPermissionBannerHandle,
} from '../components/NotificationPermissionBanner';
import SegmentedControl from '../components/SegmentedControl';
import TimeSheet, { type TimeSheetRef } from '../components/TimeSheet';
import Switch from '../components/ui/Switch';
import {
  maybePromptForExactAlarmPermission,
  requestNotificationPermission,
  setNotificationsEnabled,
  setRestTimerNotificationsEnabled,
} from '../services/notifications';
import {
  WATER_REMINDER_INTERVAL_OPTIONS,
  useAppPreferencesStore,
  type WaterReminderIntervalHours,
} from '../stores/appPreferencesStore';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { usePreferences } from '../hooks/usePreferences';
import { formatTimeLabel } from '../utils/entryTimeDisplay';
import { isValidReminderWindow } from '../utils/hydrationReminder';
import {
  getTodayDiscretionaryPromptBudget,
  subscribeDiscretionaryPromptBudget,
} from '../services/discretionaryPromptLedger';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../services/nutritionIdentity';
import type { RootStackScreenProps } from '../types/navigation';

type IntervalKey = `${WaterReminderIntervalHours}`;

type NotificationSettingsScreenProps =
  RootStackScreenProps<'NotificationSettings'>;

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const activeWorkoutBarPadding = useActiveWorkoutBarPadding('stack');
  const notificationsEnabled = useAppPreferencesStore(
    (s) => s.notificationsEnabled
  );
  const restTimerNotificationsEnabled = useAppPreferencesStore(
    (s) => s.restTimerNotificationsEnabled
  );
  const fastingGoalNotificationsEnabled = useAppPreferencesStore(
    (s) => s.fastingGoalNotificationsEnabled
  );
  const setFastingGoalNotificationsEnabled = useAppPreferencesStore(
    (s) => s.setFastingGoalNotificationsEnabled
  );
  const medicationRemindersEnabled = useAppPreferencesStore(
    (s) => s.medicationRemindersEnabled
  );
  const setMedicationRemindersEnabled = useAppPreferencesStore(
    (s) => s.setMedicationRemindersEnabled
  );
  const medicationReminderRepeats = useAppPreferencesStore(
    (s) => s.medicationReminderRepeats
  );
  const setMedicationReminderRepeats = useAppPreferencesStore(
    (s) => s.setMedicationReminderRepeats
  );
  const medicationReminderHideNames = useAppPreferencesStore(
    (s) => s.medicationReminderHideNames
  );
  const setMedicationReminderHideNames = useAppPreferencesStore(
    (s) => s.setMedicationReminderHideNames
  );
  const waterReminderEnabled = useAppPreferencesStore(
    (s) => s.waterReminderEnabled
  );
  const setWaterReminderEnabled = useAppPreferencesStore(
    (s) => s.setWaterReminderEnabled
  );
  const waterReminderIntervalHours = useAppPreferencesStore(
    (s) => s.waterReminderIntervalHours
  );
  const setWaterReminderIntervalHours = useAppPreferencesStore(
    (s) => s.setWaterReminderIntervalHours
  );
  const waterReminderWindowStart = useAppPreferencesStore(
    (s) => s.waterReminderWindowStart
  );
  const waterReminderWindowEnd = useAppPreferencesStore(
    (s) => s.waterReminderWindowEnd
  );
  const setWaterReminderWindow = useAppPreferencesStore(
    (s) => s.setWaterReminderWindow
  );
  const mealCaptureReminderEnabled = useAppPreferencesStore(
    (s) => s.mealCaptureReminderEnabled
  );
  const setMealCaptureReminderEnabled = useAppPreferencesStore(
    (s) => s.setMealCaptureReminderEnabled
  );
  const mealStart = useAppPreferencesStore((s) => s.mealCaptureWindowStart);
  const mealEnd = useAppPreferencesStore((s) => s.mealCaptureWindowEnd);
  const mealPrompt = useAppPreferencesStore((s) => s.mealCapturePromptTime);
  const setMealWindow = useAppPreferencesStore((s) => s.setMealCaptureWindow);
  const reviewEnabled = useAppPreferencesStore((s) => s.mealPhotoReviewEnabled);
  const setReviewEnabled = useAppPreferencesStore(
    (s) => s.setMealPhotoReviewEnabled
  );
  const reviewTime = useAppPreferencesStore((s) => s.mealPhotoReviewTime);
  const setReviewTime = useAppPreferencesStore((s) => s.setMealPhotoReviewTime);
  const movementReminderEnabled = useAppPreferencesStore(
    (s) => s.movementBreakReminderEnabled
  );
  const setMovementReminderEnabled = useAppPreferencesStore(
    (s) => s.setMovementBreakReminderEnabled
  );
  const movementReminderTime = useAppPreferencesStore(
    (s) => s.movementBreakReminderTime
  );
  const setMovementReminderTime = useAppPreferencesStore(
    (s) => s.setMovementBreakReminderTime
  );
  const { preferences } = usePreferences();
  const startTimeSheetRef = useRef<TimeSheetRef>(null);
  const endTimeSheetRef = useRef<TimeSheetRef>(null);
  const mealStartSheetRef = useRef<TimeSheetRef>(null);
  const mealEndSheetRef = useRef<TimeSheetRef>(null);
  const mealPromptSheetRef = useRef<TimeSheetRef>(null);
  const reviewTimeSheetRef = useRef<TimeSheetRef>(null);
  const movementTimeSheetRef = useRef<TimeSheetRef>(null);
  const usesNativeHeader = useNativeIOSHeadersActive();
  const bannerRef = useRef<NotificationPermissionBannerHandle>(null);
  const [dailyOptionalBudgetUsed, setDailyOptionalBudgetUsed] = useState<
    number | null
  >(null);

  useEffect(() => {
    let mounted = true;
    let latestRefresh = 0;
    const refresh = async () => {
      const request = ++latestRefresh;
      try {
        const identity = await getActiveNutritionIdentity();
        const budget = await getTodayDiscretionaryPromptBudget(identity);
        if (mounted && request === latestRefresh)
          setDailyOptionalBudgetUsed(budget.used);
      } catch {
        if (mounted && request === latestRefresh)
          setDailyOptionalBudgetUsed(null);
      }
    };
    void refresh();
    const unsubscribeBudget = subscribeDiscretionaryPromptBudget(() => {
      void refresh();
    });
    const unsubscribeIdentity = subscribeNutritionIdentity(() => {
      void refresh();
    });
    const unsubscribeFocus = navigation.addListener?.('focus', () => {
      void refresh();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const interval = setInterval(() => {
      void refresh();
    }, 60_000);
    return () => {
      mounted = false;
      unsubscribeBudget();
      unsubscribeIdentity();
      unsubscribeFocus?.();
      appState.remove();
      clearInterval(interval);
    };
  }, [navigation]);

  const handleNotificationsToggle = useCallback(async (value: boolean) => {
    if (!value) {
      await setNotificationsEnabled(false);
      return;
    }
    await setNotificationsEnabled(true);
    await requestNotificationPermission();
    bannerRef.current?.refresh();
  }, []);

  const handleMedicationRemindersToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        setMedicationRemindersEnabled(false);
        return;
      }
      const status = await requestNotificationPermission();
      bannerRef.current?.refresh();
      // Without OS permission the toggle would show "on" while reminders
      // silently never fire; leave it off until permission is granted. The
      // permission banner above explains and links to system settings.
      if (status === 'granted') {
        setMedicationRemindersEnabled(true);
        // Scheduled reminders ring late on Android without the exact-alarm
        // special access; nudge once when the user opts in.
        await maybePromptForExactAlarmPermission();
      }
    },
    [setMedicationRemindersEnabled]
  );

  const handleWaterRemindersToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        setWaterReminderEnabled(false);
        return;
      }
      const status = await requestNotificationPermission();
      bannerRef.current?.refresh();
      // Same rule as medication reminders: never show "on" while the OS would
      // silently drop every reminder.
      if (status === 'granted') setWaterReminderEnabled(true);
    },
    [setWaterReminderEnabled]
  );

  const handleMealReminderToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        setMealCaptureReminderEnabled(false);
        return;
      }
      const status = await requestNotificationPermission();
      bannerRef.current?.refresh();
      if (status === 'granted') setMealCaptureReminderEnabled(true);
    },
    [setMealCaptureReminderEnabled]
  );

  const handleReviewReminderToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        setReviewEnabled(false);
        return;
      }
      const status = await requestNotificationPermission();
      bannerRef.current?.refresh();
      if (status === 'granted') setReviewEnabled(true);
    },
    [setReviewEnabled]
  );

  const handleMovementReminderToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        setMovementReminderEnabled(false);
        return;
      }
      const status = await requestNotificationPermission();
      bannerRef.current?.refresh();
      if (status === 'granted') setMovementReminderEnabled(true);
    },
    [setMovementReminderEnabled]
  );

  const changeMealWindow = useCallback(
    (start: string, end: string, prompt: string) => {
      if (!(start < prompt && prompt < end)) {
        Toast.show({
          type: 'error',
          text1: t('engagement.invalidWindow', {
            defaultValue: 'The reminder time must fall inside the meal window.',
          }),
        });
        return;
      }
      setMealWindow(start, end, prompt);
    },
    [setMealWindow, t]
  );

  const intervalSegments = useMemo(
    () =>
      WATER_REMINDER_INTERVAL_OPTIONS.map((hours) => ({
        key: String(hours) as IntervalKey,
        label: t('notificationSettings.waterReminderIntervalOption', {
          defaultValue: '{{hours}}h',
          hours,
        }),
      })),
    [t]
  );

  const handleIntervalSelect = useCallback(
    (key: IntervalKey) => {
      setWaterReminderIntervalHours(Number(key) as WaterReminderIntervalHours);
    },
    [setWaterReminderIntervalHours]
  );

  const showInvalidWindowToast = useCallback(() => {
    Toast.show({
      type: 'error',
      text1: t('notificationSettings.waterReminderInvalidWindow', {
        defaultValue: 'End time must be after start time.',
      }),
    });
  }, [t]);

  const handleStartTimeSelect = useCallback(
    (time: string) => {
      if (!isValidReminderWindow(time, waterReminderWindowEnd)) {
        showInvalidWindowToast();
        return;
      }
      setWaterReminderWindow(time, waterReminderWindowEnd);
    },
    [waterReminderWindowEnd, setWaterReminderWindow, showInvalidWindowToast]
  );

  const handleEndTimeSelect = useCallback(
    (time: string) => {
      if (!isValidReminderWindow(waterReminderWindowStart, time)) {
        showInvalidWindowToast();
        return;
      }
      setWaterReminderWindow(waterReminderWindowStart, time);
    },
    [waterReminderWindowStart, setWaterReminderWindow, showInvalidWindowToast]
  );

  const startTimeLabel =
    formatTimeLabel(waterReminderWindowStart, preferences?.time_format) ??
    waterReminderWindowStart;
  const endTimeLabel =
    formatTimeLabel(waterReminderWindowEnd, preferences?.time_format) ??
    waterReminderWindowEnd;

  const header = useScreenHeader({
    title: t('notificationSettings.title', { defaultValue: 'Notifications' }),
    left: { kind: 'back' },
  });

  return (
    <View
      className="flex-1 bg-background"
      style={usesNativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 80 + activeWorkoutBarPadding,
        }}
        contentInsetAdjustmentBehavior={
          usesNativeHeader ? 'automatic' : 'never'
        }
      >
        <SettingsRow
          title={t('notificationSettings.allow', {
            defaultValue: 'Allow Notifications',
          })}
          subtitle={t('notificationSettings.allowSubtitle', {
            defaultValue: 'Master switch for all alerts from X on Track.',
          })}
          subtitleNumberOfLines={0}
          rightAccessory={
            <Switch
              accessibilityLabel={t('notificationSettings.allow', {
                defaultValue: 'Allow Notifications',
              })}
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
            />
          }
        />

        <NotificationPermissionBanner ref={bannerRef} />

        {notificationsEnabled && (
          <SettingsRowGroup>
            <SettingsRow
              title={t('engagement.dailyOptionalBudget', {
                defaultValue: 'Optional reminders today',
              })}
              subtitle={
                dailyOptionalBudgetUsed === null
                  ? t('engagement.dailyOptionalBudgetUnavailable', {
                      defaultValue:
                        'Daily reminder count unavailable. Meal, movement, and water reminders share three slots.',
                    })
                  : t('engagement.dailyOptionalBudgetSummary', {
                      defaultValue:
                        '{{used}} of 3 daily slots used. Meal, movement, and water share them; medication and rest alerts are separate.',
                      used: dailyOptionalBudgetUsed,
                    })
              }
              subtitleNumberOfLines={0}
              testID="optional-reminder-budget"
            />
          </SettingsRowGroup>
        )}

        {notificationsEnabled && (
          <SettingsRowGroup
            title={t('notificationSettings.alerts', { defaultValue: 'Alerts' })}
          >
            <SettingsRow
              title={t('notificationSettings.restTimer', {
                defaultValue: 'Rest Timer',
              })}
              subtitle={t('notificationSettings.restTimerSubtitle', {
                defaultValue:
                  'Alert when a rest period ends, even in the background.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  accessibilityLabel={t('notificationSettings.restTimer', {
                    defaultValue: 'Rest Timer',
                  })}
                  value={restTimerNotificationsEnabled}
                  onValueChange={(value) =>
                    void setRestTimerNotificationsEnabled(value)
                  }
                />
              }
            />
            <SettingsRow
              title={t('notificationSettings.fastingGoals', {
                defaultValue: 'Fasting Goals',
              })}
              subtitle={t('notificationSettings.fastingGoalsSubtitle', {
                defaultValue: 'Alert when you reach your fasting goal.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  accessibilityLabel={t('notificationSettings.fastingGoals', {
                    defaultValue: 'Fasting Goals',
                  })}
                  value={fastingGoalNotificationsEnabled}
                  onValueChange={setFastingGoalNotificationsEnabled}
                />
              }
            />
          </SettingsRowGroup>
        )}

        {notificationsEnabled && (
          <SettingsRowGroup
            title={t('notificationSettings.medications', {
              defaultValue: 'Medications',
            })}
          >
            <SettingsRow
              title={t('notificationSettings.medicationReminders', {
                defaultValue: 'Medication Reminders',
              })}
              subtitle={t('notificationSettings.medicationRemindersSubtitle', {
                defaultValue: 'Reminders for scheduled medications.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  accessibilityLabel={t(
                    'notificationSettings.medicationReminders',
                    { defaultValue: 'Medication Reminders' }
                  )}
                  value={medicationRemindersEnabled}
                  onValueChange={handleMedicationRemindersToggle}
                />
              }
            />
            {medicationRemindersEnabled && (
              <SettingsRow
                title={t('notificationSettings.repeatReminders', {
                  defaultValue: 'Repeat Reminders',
                })}
                subtitle={t('notificationSettings.repeatRemindersSubtitle', {
                  defaultValue:
                    'Repeat each reminder every 10 minutes, up to 3 times, until the dose is logged.',
                })}
                subtitleNumberOfLines={0}
                rightAccessory={
                  <Switch
                    accessibilityLabel={t(
                      'notificationSettings.repeatReminders',
                      { defaultValue: 'Repeat Reminders' }
                    )}
                    value={medicationReminderRepeats}
                    onValueChange={setMedicationReminderRepeats}
                  />
                }
              />
            )}
            {medicationRemindersEnabled && (
              <SettingsRow
                title={t('notificationSettings.hideMedicationNames', {
                  defaultValue: 'Hide Medication Names',
                })}
                subtitle={t(
                  'notificationSettings.hideMedicationNamesSubtitle',
                  {
                    defaultValue:
                      'Show a generic reminder instead of the medication name and dose.',
                  }
                )}
                subtitleNumberOfLines={0}
                rightAccessory={
                  <Switch
                    accessibilityLabel={t(
                      'notificationSettings.hideMedicationNames',
                      { defaultValue: 'Hide Medication Names' }
                    )}
                    value={medicationReminderHideNames}
                    onValueChange={setMedicationReminderHideNames}
                  />
                }
              />
            )}
          </SettingsRowGroup>
        )}

        {notificationsEnabled && (
          <SettingsRowGroup
            title={t('notificationSettings.hydration', {
              defaultValue: 'Hydration',
            })}
          >
            <SettingsRow
              title={t('notificationSettings.waterReminders', {
                defaultValue: 'Water Reminders',
              })}
              subtitle={t('notificationSettings.waterRemindersSubtitle', {
                defaultValue:
                  'Water reminders follow your interval and share available reminder slots with meal and movement prompts.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  accessibilityLabel={t('notificationSettings.waterReminders', {
                    defaultValue: 'Water Reminders',
                  })}
                  value={waterReminderEnabled}
                  onValueChange={handleWaterRemindersToggle}
                />
              }
            />
            {waterReminderEnabled && (
              <SettingsRow
                title={t('notificationSettings.waterReminderInterval', {
                  defaultValue: 'Remind After',
                })}
                subtitle={
                  <View className="mt-2">
                    <SegmentedControl
                      segments={intervalSegments}
                      activeKey={
                        String(waterReminderIntervalHours) as IntervalKey
                      }
                      onSelect={handleIntervalSelect}
                    />
                  </View>
                }
              />
            )}
            {waterReminderEnabled && (
              <SettingsRow
                title={t('notificationSettings.waterReminderStart', {
                  defaultValue: 'Start Time',
                })}
                onPress={() => startTimeSheetRef.current?.present()}
                accessibilityLabel={t(
                  'notificationSettings.waterReminderStartAccessibility',
                  { defaultValue: 'Start time, {{time}}', time: startTimeLabel }
                )}
                rightAccessory={
                  <Text className="text-sm text-text-secondary">
                    {startTimeLabel}
                  </Text>
                }
              />
            )}
            {waterReminderEnabled && (
              <SettingsRow
                title={t('notificationSettings.waterReminderEnd', {
                  defaultValue: 'End Time',
                })}
                onPress={() => endTimeSheetRef.current?.present()}
                accessibilityLabel={t(
                  'notificationSettings.waterReminderEndAccessibility',
                  { defaultValue: 'End time, {{time}}', time: endTimeLabel }
                )}
                rightAccessory={
                  <Text className="text-sm text-text-secondary">
                    {endTimeLabel}
                  </Text>
                }
              />
            )}
          </SettingsRowGroup>
        )}
        {notificationsEnabled && (
          <SettingsRowGroup
            title={t('engagement.settingsTitle', {
              defaultValue: 'Meal check-in',
            })}
          >
            <SettingsRow
              title={t('engagement.captureReminderSetting', {
                defaultValue: 'Meal photo reminder',
              })}
              subtitle={t('engagement.captureReminderSettingSubtitle', {
                defaultValue:
                  'One optional check-in during your chosen window. Saving a photo resolves it, even offline.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  accessibilityLabel={t('engagement.captureReminderSetting', {
                    defaultValue: 'Meal photo reminder',
                  })}
                  value={mealCaptureReminderEnabled}
                  onValueChange={(value) =>
                    void handleMealReminderToggle(value)
                  }
                />
              }
            />
            {mealCaptureReminderEnabled && (
              <>
                <SettingsRow
                  title={t('engagement.windowStart', {
                    defaultValue: 'Window starts',
                  })}
                  onPress={() => mealStartSheetRef.current?.present()}
                  rightAccessory={
                    <Text className="text-sm text-text-secondary">
                      {formatTimeLabel(mealStart, preferences?.time_format) ??
                        mealStart}
                    </Text>
                  }
                />
                <SettingsRow
                  title={t('engagement.promptTime', {
                    defaultValue: 'Reminder time',
                  })}
                  onPress={() => mealPromptSheetRef.current?.present()}
                  rightAccessory={
                    <Text className="text-sm text-text-secondary">
                      {formatTimeLabel(mealPrompt, preferences?.time_format) ??
                        mealPrompt}
                    </Text>
                  }
                />
                <SettingsRow
                  title={t('engagement.windowEnd', {
                    defaultValue: 'Window ends',
                  })}
                  onPress={() => mealEndSheetRef.current?.present()}
                  rightAccessory={
                    <Text className="text-sm text-text-secondary">
                      {formatTimeLabel(mealEnd, preferences?.time_format) ??
                        mealEnd}
                    </Text>
                  }
                />
              </>
            )}
            <SettingsRow
              title={t('engagement.reviewSetting', {
                defaultValue: 'Meal photo review reminder',
              })}
              subtitle={t('engagement.reviewSettingSubtitle', {
                defaultValue:
                  'Optional later prompt only when an incomplete photo is known on this device.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  accessibilityLabel={t('engagement.reviewSetting', {
                    defaultValue: 'Meal photo review reminder',
                  })}
                  value={reviewEnabled}
                  onValueChange={(value) =>
                    void handleReviewReminderToggle(value)
                  }
                />
              }
            />
            {reviewEnabled && (
              <SettingsRow
                title={t('engagement.reviewTime', {
                  defaultValue: 'Review time',
                })}
                onPress={() => reviewTimeSheetRef.current?.present()}
                rightAccessory={
                  <Text className="text-sm text-text-secondary">
                    {formatTimeLabel(reviewTime, preferences?.time_format) ??
                      reviewTime}
                  </Text>
                }
              />
            )}
          </SettingsRowGroup>
        )}

        <SettingsRowGroup
          title={t('engagement.movementSettingsTitle', {
            defaultValue: 'Movement break',
          })}
        >
          {notificationsEnabled && (
            <SettingsRow
              title={t('engagement.movementReminderSetting', {
                defaultValue: 'Movement break reminder',
              })}
              subtitle={t('engagement.movementReminderSettingSubtitle', {
                defaultValue:
                  'One optional invitation at your chosen time. It does not track or log movement.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  accessibilityLabel={t('engagement.movementReminderSetting', {
                    defaultValue: 'Movement break reminder',
                  })}
                  value={movementReminderEnabled}
                  onValueChange={(value) =>
                    void handleMovementReminderToggle(value)
                  }
                />
              }
            />
          )}
          {notificationsEnabled && movementReminderEnabled && (
            <SettingsRow
              title={t('engagement.movementReminderTime', {
                defaultValue: 'Reminder time',
              })}
              onPress={() => movementTimeSheetRef.current?.present()}
              rightAccessory={
                <Text className="text-sm text-text-secondary">
                  {formatTimeLabel(
                    movementReminderTime,
                    preferences?.time_format
                  ) ?? movementReminderTime}
                </Text>
              }
            />
          )}
          <SettingsRow
            title={t('engagement.openBreakTimer', {
              defaultValue: 'Open break timer',
            })}
            subtitle={t('engagement.breakSettingSubtitle', {
              defaultValue:
                'Start a short, explicit timer. Finishing it does not log movement.',
            })}
            subtitleNumberOfLines={0}
            onPress={() => navigation.navigate('MovementBreak')}
          />
        </SettingsRowGroup>
      </ScrollView>

      <TimeSheet
        ref={startTimeSheetRef}
        value={waterReminderWindowStart}
        onSelectTime={handleStartTimeSelect}
        commitOn="done"
      />
      <TimeSheet
        ref={endTimeSheetRef}
        value={waterReminderWindowEnd}
        onSelectTime={handleEndTimeSelect}
        commitOn="done"
      />
      <TimeSheet
        ref={mealStartSheetRef}
        value={mealStart}
        onSelectTime={(value) => changeMealWindow(value, mealEnd, mealPrompt)}
        commitOn="done"
      />
      <TimeSheet
        ref={mealPromptSheetRef}
        value={mealPrompt}
        onSelectTime={(value) => changeMealWindow(mealStart, mealEnd, value)}
        commitOn="done"
      />
      <TimeSheet
        ref={mealEndSheetRef}
        value={mealEnd}
        onSelectTime={(value) => changeMealWindow(mealStart, value, mealPrompt)}
        commitOn="done"
      />
      <TimeSheet
        ref={reviewTimeSheetRef}
        value={reviewTime}
        onSelectTime={setReviewTime}
        commitOn="done"
      />
      <TimeSheet
        ref={movementTimeSheetRef}
        value={movementReminderTime}
        onSelectTime={setMovementReminderTime}
        commitOn="done"
      />
    </View>
  );
};

export default NotificationSettingsScreen;
