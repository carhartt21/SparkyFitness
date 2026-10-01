import { notificationStatusLabels } from '../localization/notificationStatusLabels';
import Button from '../components/ui/Button';
import { apiFetch } from '../services/api/apiClient';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, View, ScrollView, Text, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import SettingsRow, { SettingsRowGroup } from '../components/SettingsRow';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import NotificationPermissionBanner, {
  type NotificationPermissionBannerHandle,
} from '../components/NotificationPermissionBanner';
import BottomSheetPicker from '../components/BottomSheetPicker';
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
import {
  engagementStatusSchema,
  type EngagementStatus,
  type EngagementSettingsV2,
  type EngagementSettingsPatchV2,
} from '@workspace/shared';
import {
  enableRemoteEngagement,
  patchRemoteEngagement,
  refreshRemoteEngagement,
  readCachedRemoteEngagement,
  disableThisNotificationDevice,
  flushNotificationDeviceOff,
  notificationDeviceOffPending,
  renewRemoteEngagementDevice,
} from '../services/remoteEngagement';

type NotificationSettingsScreenProps =
  RootStackScreenProps<'NotificationSettings'>;

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({
  navigation,
}) => {
  const { t, i18n } = useTranslation();
  const statusLabels = notificationStatusLabels(t);
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
  const quietStartSheetRef = useRef<TimeSheetRef>(null);
  const quietEndSheetRef = useRef<TimeSheetRef>(null);
  const usesNativeHeader = useNativeIOSHeadersActive();
  const bannerRef = useRef<NotificationPermissionBannerHandle>(null);
  const [dailyOptionalBudgetUsed, setDailyOptionalBudgetUsed] = useState<
    number | null
  >(null);
  const [remoteSettings, setRemoteSettings] =
    useState<EngagementSettingsV2 | null>(null);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteOffline, setRemoteOffline] = useState(false);
  const [remoteSaveFailed, setRemoteSaveFailed] = useState(false);
  const [deviceOffPending, setDeviceOffPending] = useState(false);
  const [status, setStatus] = useState<EngagementStatus | null>(null);
  const [limitText, setLimitText] = useState('3');
  const limit = useAppPreferencesStore(
    (state) => state.optionalReminderDailyLimit
  );
  const setLimit = useAppPreferencesStore(
    (state) => state.setOptionalReminderDailyLimit
  );
  const mutationBusy = useRef(false);
  const refreshStatus = useCallback(async () => {
    try {
      setStatus(
        engagementStatusSchema.parse(
          await apiFetch({
            endpoint: '/api/v2/engagement/status',
            serviceName: 'Engagement',
            operation: 'load reminder status',
          })
        )
      );
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const identity = await getActiveNutritionIdentity();
        if (!identity) return;
        const cached = await readCachedRemoteEngagement(identity);
        if (active && cached) setRemoteSettings(cached);
        await flushNotificationDeviceOff(identity).catch(() => undefined);
        if (active)
          setDeviceOffPending(await notificationDeviceOffPending(identity));
        const settings = await refreshRemoteEngagement(identity);
        if (active) {
          setRemoteOffline(false);
          setRemoteSaveFailed(false);
          setLimit(settings.daily_limit);
          setLimitText(String(settings.daily_limit ?? 3));
          void refreshStatus();
        }
        if (active) {
          setRemoteSettings(settings);
          if (settings.remote_enabled) {
            setWaterReminderEnabled(settings.hydration_enabled);
            setMealCaptureReminderEnabled(settings.meal_capture_enabled);
            setReviewEnabled(settings.meal_review_enabled);
            setMovementReminderEnabled(settings.movement_break_enabled);
            setWaterReminderIntervalHours(
              settings.hydration_interval_hours as WaterReminderIntervalHours
            );
            setWaterReminderWindow(
              settings.hydration_start,
              settings.hydration_end
            );
            setMealWindow(
              settings.meal_capture_start,
              settings.meal_capture_end,
              settings.meal_capture_time
            );
            setReviewTime(settings.meal_review_time);
            setMovementReminderTime(settings.movement_break_time);
          }
        }
      } catch {
        if (active) setRemoteOffline(true);
      }
    };
    void refresh();
    const unsubscribe = navigation.addListener?.('focus', () => void refresh());
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [
    navigation,
    setWaterReminderEnabled,
    setMealCaptureReminderEnabled,
    setReviewEnabled,
    setMovementReminderEnabled,
    setWaterReminderIntervalHours,
    setWaterReminderWindow,
    setMealWindow,
    setReviewTime,
    setMovementReminderTime,
    setLimit,
    refreshStatus,
  ]);

  const updateRemoteKind = useCallback(
    async (
      key:
        | 'hydration_enabled'
        | 'meal_capture_enabled'
        | 'meal_review_enabled'
        | 'movement_break_enabled',
      value: boolean,
      applyLocal: (next: boolean) => void
    ) => {
      if (!remoteSettings?.remote_enabled) applyLocal(value);
      if (!remoteSettings) return;
      if (mutationBusy.current) return;
      mutationBusy.current = true;
      setRemoteBusy(true);
      try {
        const identity = await getActiveNutritionIdentity();
        if (!identity) throw new Error('Sign in to update remote reminders.');
        const updated = await patchRemoteEngagement(identity, { [key]: value });
        setRemoteSettings(updated);
        applyLocal(value);
        void refreshStatus();
      } catch {
        setRemoteSaveFailed(true);
        Toast.show({
          type: 'error',
          text1: t('notificationSettings.remoteUpdateFailed', {
            defaultValue:
              'Not saved. Reload settings and try again; they may have changed elsewhere.',
          }),
        });
      } finally {
        mutationBusy.current = false;
        setRemoteBusy(false);
      }
    },
    [remoteSettings, refreshStatus, t]
  );

  const handleRemoteToggle = useCallback(
    async (value: boolean) => {
      if (remoteBusy) return;
      setRemoteBusy(true);
      try {
        const identity = await getActiveNutritionIdentity();
        if (!identity) throw new Error('Sign in to enable remote reminders.');
        const updated = value
          ? await enableRemoteEngagement(identity, {
              hydration_enabled: waterReminderEnabled,
              meal_capture_enabled: mealCaptureReminderEnabled,
              meal_review_enabled: reviewEnabled,
              movement_break_enabled: movementReminderEnabled,
              mobility_enabled: true,
            })
          : await patchRemoteEngagement(identity, { remote_enabled: false });
        setRemoteSettings(updated);
      } catch {
        Toast.show({
          type: 'error',
          text1: t('notificationSettings.remoteUnavailable', {
            defaultValue:
              'Remote reminders are unavailable. Check notification permission and push setup.',
          }),
        });
      } finally {
        setRemoteBusy(false);
      }
    },
    [
      remoteBusy,
      waterReminderEnabled,
      mealCaptureReminderEnabled,
      reviewEnabled,
      movementReminderEnabled,
      t,
    ]
  );

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
      const identity = await getActiveNutritionIdentity();
      if (identity) {
        try {
          await disableThisNotificationDevice(identity);
          setDeviceOffPending(false);
        } catch {
          setDeviceOffPending(true);
        }
      }
      return;
    }
    await setNotificationsEnabled(true);
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      const identity = await getActiveNutritionIdentity();
      if (identity) {
        await flushNotificationDeviceOff(identity).catch(() => undefined);
        const remote = await readCachedRemoteEngagement(identity);
        if (remote?.remote_enabled)
          await renewRemoteEngagementDevice(identity).catch(() => {
            setDeviceOffPending(true);
          });
      }
    }
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
        await updateRemoteKind(
          'hydration_enabled',
          false,
          setWaterReminderEnabled
        );
        return;
      }
      const status = await requestNotificationPermission();
      bannerRef.current?.refresh();
      // Same rule as medication reminders: never show "on" while the OS would
      // silently drop every reminder.
      if (status === 'granted')
        await updateRemoteKind(
          'hydration_enabled',
          true,
          setWaterReminderEnabled
        );
    },
    [setWaterReminderEnabled, updateRemoteKind]
  );

  const handleMealReminderToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        await updateRemoteKind(
          'meal_capture_enabled',
          false,
          setMealCaptureReminderEnabled
        );
        return;
      }
      const status = await requestNotificationPermission();
      bannerRef.current?.refresh();
      if (status === 'granted')
        await updateRemoteKind(
          'meal_capture_enabled',
          true,
          setMealCaptureReminderEnabled
        );
    },
    [setMealCaptureReminderEnabled, updateRemoteKind]
  );

  const handleReviewReminderToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        await updateRemoteKind('meal_review_enabled', false, setReviewEnabled);
        return;
      }
      const status = await requestNotificationPermission();
      bannerRef.current?.refresh();
      if (status === 'granted')
        await updateRemoteKind('meal_review_enabled', true, setReviewEnabled);
    },
    [setReviewEnabled, updateRemoteKind]
  );

  const handleMovementReminderToggle = useCallback(
    async (value: boolean) => {
      if (!value) {
        await updateRemoteKind(
          'movement_break_enabled',
          false,
          setMovementReminderEnabled
        );
        return;
      }
      const status = await requestNotificationPermission();
      bannerRef.current?.refresh();
      if (status === 'granted')
        await updateRemoteKind(
          'movement_break_enabled',
          true,
          setMovementReminderEnabled
        );
    },
    [setMovementReminderEnabled, updateRemoteKind]
  );

  const updateSchedule = useCallback(
    async (
      patch: Omit<EngagementSettingsPatchV2, 'expected_revision'>,
      applyLocal: () => void
    ) => {
      if (!remoteSettings?.remote_enabled) applyLocal();
      if (!remoteSettings || mutationBusy.current) return;
      mutationBusy.current = true;
      setRemoteBusy(true);
      try {
        const identity = await getActiveNutritionIdentity();
        if (!identity) throw new Error('Account unavailable.');
        const updated = await patchRemoteEngagement(identity, patch);
        setRemoteSettings(updated);
        applyLocal();
        void refreshStatus();
      } catch {
        setRemoteSaveFailed(true);
        Toast.show({
          type: 'error',
          text1: t('notificationSettings.remoteUpdateFailed', {
            defaultValue:
              'Not saved. Reload settings and try again; they may have changed elsewhere.',
          }),
        });
      } finally {
        mutationBusy.current = false;
        setRemoteBusy(false);
      }
    },
    [remoteSettings, refreshStatus, t]
  );
  const changeMealWindow = useCallback(
    (start: string, end: string, prompt: string) => {
      if (!(start <= prompt && prompt < end)) {
        Toast.show({
          type: 'error',
          text1: t('engagement.invalidWindow', {
            defaultValue: 'The reminder time must fall inside the meal window.',
          }),
        });
        return;
      }
      void updateSchedule(
        {
          meal_capture_start: start,
          meal_capture_end: end,
          meal_capture_time: prompt,
        },
        () => setMealWindow(start, end, prompt)
      );
    },
    [setMealWindow, updateSchedule, t]
  );

  const intervalSegments = useMemo(
    () =>
      WATER_REMINDER_INTERVAL_OPTIONS.map((hours) => ({
        value: hours,
        label: t('notificationSettings.waterReminderIntervalOption', {
          defaultValue: '{{hours}}h',
          hours,
        }),
      })),
    [t]
  );

  const handleIntervalSelect = useCallback(
    (hours: WaterReminderIntervalHours) => {
      void updateSchedule({ hydration_interval_hours: hours }, () =>
        setWaterReminderIntervalHours(hours as WaterReminderIntervalHours)
      );
    },
    [setWaterReminderIntervalHours, updateSchedule]
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
      void updateSchedule(
        { hydration_start: time, hydration_end: waterReminderWindowEnd },
        () => setWaterReminderWindow(time, waterReminderWindowEnd)
      );
    },
    [
      waterReminderWindowEnd,
      setWaterReminderWindow,
      showInvalidWindowToast,
      updateSchedule,
    ]
  );

  const handleEndTimeSelect = useCallback(
    (time: string) => {
      if (!isValidReminderWindow(waterReminderWindowStart, time)) {
        showInvalidWindowToast();
        return;
      }
      void updateSchedule(
        { hydration_start: waterReminderWindowStart, hydration_end: time },
        () => setWaterReminderWindow(waterReminderWindowStart, time)
      );
    },
    [
      waterReminderWindowStart,
      setWaterReminderWindow,
      showInvalidWindowToast,
      updateSchedule,
    ]
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
            defaultValue: 'Alerts on this device',
          })}
          subtitle={t('notificationSettings.allowSubtitle', {
            defaultValue:
              'Stops local alerts and push delivery to this installation. Other devices and account settings stay active.',
          })}
          subtitleNumberOfLines={0}
          rightAccessory={
            <Switch
              disabled={remoteBusy}
              accessibilityLabel={t('notificationSettings.allow', {
                defaultValue: 'Alerts on this device',
              })}
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
            />
          }
        />

        <NotificationPermissionBanner ref={bannerRef} />

        {(remoteOffline || deviceOffPending || remoteSaveFailed) && (
          <SettingsRowGroup>
            <SettingsRow
              title={
                deviceOffPending
                  ? t('notificationSettings.deviceOffPending', {
                      defaultValue:
                        'Device alerts off \u00b7 server confirmation pending',
                    })
                  : remoteSaveFailed
                    ? t('common.retry', { defaultValue: 'Retry' })
                    : t('notificationSettings.offline', {
                        defaultValue:
                          'Saved settings \u00b7 connection unavailable',
                      })
              }
              subtitle={
                remoteSaveFailed && !deviceOffPending
                  ? t('notificationSettings.remoteUpdateFailed', {
                      defaultValue:
                        'Not saved. Reload settings and try again; they may have changed elsewhere.',
                    })
                  : t('notificationSettings.offlineDescription', {
                      defaultValue:
                        'Local changes remain on this device. Push may continue until the server confirms device-off. Reconnect and tap here to retry.',
                    })
              }

              subtitleNumberOfLines={0}
              onPress={() => {
                void refreshStatus();
                navigation.replace('NotificationSettings');
              }}
            />
          </SettingsRowGroup>
        )}
        <SettingsRowGroup
          title={t('notificationSettings.setup', {
            defaultValue: 'Schedules and widgets',
          })}
        >
          <SettingsRow
            title={t('widgetGuide.title', {
              defaultValue: 'Widgets & Live Activities',
            })}
            subtitle={t('notificationSettings.widgetHint', {
              defaultValue: 'Setup steps and Live Activity availability',
            })}
            subtitleNumberOfLines={0}
            testID="notification-widget-guide"
            onPress={() => navigation.navigate('WidgetGuide')}
          />
          <SettingsRow
            title={t('notificationSettings.trackingSchedules', {
              defaultValue: 'Check-in, habits and weigh-in',
            })}
            subtitle={t('notificationSettings.trackingHint', {
              defaultValue:
                'Edit their existing schedules. Recorded or skipped items do not need reminders.',
            })}
            subtitleNumberOfLines={0}
            onPress={() => navigation.navigate('TrackingSettings')}
          />
          <SettingsRow
            title={t('mobility.title', { defaultValue: 'Guided mobility' })}
            subtitle={t('notificationSettings.mobilityHint', {
              defaultValue: 'Planned routines, execution and sync status',
            })}
            subtitleNumberOfLines={0}
            onPress={() => navigation.navigate('GuidedMobility')}
          />
        </SettingsRowGroup>
        {notificationsEnabled && (
          <SettingsRowGroup
            title={t('notificationSettings.delivery', {
              defaultValue: 'Delivery',
            })}
          >
            <SettingsRow
              title={t('notificationSettings.remoteReminders', {
                defaultValue: 'Server delivery for this account',
              })}
              subtitle={t('notificationSettings.remoteRemindersSubtitle', {
                defaultValue:
                  'The server uses your saved schedules, completion state, quiet hours and daily limit. Local delivery pauses after handoff. Scheduled intake and timer alerts stay on the device.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  accessibilityLabel={t(
                    'notificationSettings.remoteReminders',
                    {
                      defaultValue: 'Server delivery for this account',
                    }
                  )}
                  value={remoteSettings?.remote_enabled ?? false}
                  disabled={remoteBusy || !remoteSettings || remoteOffline}
                  onValueChange={(value) => void handleRemoteToggle(value)}
                />
              }
            />
          </SettingsRowGroup>
        )}

        {notificationsEnabled && remoteSettings && (
          <SettingsRowGroup
            title={t('notificationSettings.quietHours', {
              defaultValue: 'Quiet hours',
            })}
          >
            <SettingsRow
              title={t('notificationSettings.quietHours', {
                defaultValue: 'Quiet hours',
              })}
              subtitle={t('notificationSettings.quietHoursHint', {
                defaultValue:
                  'Optional reminders pause during these hours, in the account time zone. Medication, supplement and rest alerts remain separate. Equal times turn quiet hours off.',
              })}
              subtitleNumberOfLines={0}
            />
            <SettingsRow
              title={t('notificationSettings.quietStart', {
                defaultValue: 'Quiet hours start',
              })}
              subtitle={formatTimeLabel(remoteSettings.quiet_start)}
              onPress={
                remoteBusy
                  ? undefined
                  : () => quietStartSheetRef.current?.present()
              }
            />
            <SettingsRow
              title={t('notificationSettings.quietEnd', {
                defaultValue: 'Quiet hours end',
              })}
              subtitle={formatTimeLabel(remoteSettings.quiet_end)}
              onPress={
                remoteBusy
                  ? undefined
                  : () => quietEndSheetRef.current?.present()
              }
            />
          </SettingsRowGroup>
        )}

        {notificationsEnabled && (
          <SettingsRowGroup>
            <SettingsRow
              title={t('engagement.dailyOptionalBudget', {
                defaultValue: 'Optional reminders today',
              })}
              subtitle={t('notificationSettings.budgetState', {
                defaultValue:
                  '{{used}} slots reserved or attempted today · Limit: {{limit}}',
                used: remoteSettings?.remote_enabled
                  ? (status?.daily_used ?? '—')
                  : (dailyOptionalBudgetUsed ?? '—'),
                limit:
                  limit === null
                    ? t('notificationSettings.noLimit', {
                        defaultValue: 'No limit',
                      })
                    : limit,
              })}
              subtitleNumberOfLines={0}
              testID="optional-reminder-budget"
            />
            <View className="px-4 pb-4 gap-3">
              <Text className="text-sm text-text-secondary">
                {t('notificationSettings.capDescription', {
                  defaultValue:
                    'Optional meal, hydration, movement, mobility, habit, check-in and weigh-in reminders share this limit. No limit removes the quota; quiet hours, cadence and 20-minute spacing still apply. Scheduled intake, rest and fasting timers are separate.',
                })}
              </Text>
              <TextInput
                keyboardType="number-pad"
                editable={!remoteBusy}
                value={limitText}
                onChangeText={setLimitText}
                maxLength={2}
                accessibilityLabel={t('notificationSettings.dailyLimit', {
                  defaultValue: 'Daily limit, 1 to 50',
                })}
                className="min-h-12 rounded-xl border border-border-subtle px-3 text-base text-text-primary"
              />
              <View className="flex-row gap-3">
                <Button
                  className="flex-1"
                  onPress={() => {
                    const value = Number(limitText);
                    if (Number.isInteger(value) && value >= 1 && value <= 50)
                      void updateSchedule({ daily_limit: value }, () =>
                        setLimit(value)
                      );
                    else
                      Toast.show({
                        type: 'error',
                        text1: t('notificationSettings.capInvalid', {
                          defaultValue: 'Use a whole number from 1 to 50.',
                        }),
                      });
                  }}
                  disabled={remoteBusy}
                >
                  {t('common.save', { defaultValue: 'Save' })}
                </Button>
                <Button
                  className="flex-1"
                  onPress={() =>
                    void updateSchedule({ daily_limit: null }, () =>
                      setLimit(null)
                    )
                  }
                  disabled={remoteBusy}
                >
                  {t('notificationSettings.noLimit', {
                    defaultValue: 'No limit',
                  })}
                </Button>
              </View>
            </View>
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
                  disabled={remoteBusy}
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
                  disabled={remoteBusy}
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
              defaultValue: 'Medications & supplements',
            })}
          >
            <SettingsRow
              title={t('notificationSettings.medicationReminders', {
                defaultValue: 'Scheduled intake reminders',
              })}
              subtitle={t('notificationSettings.medicationRemindersSubtitle', {
                defaultValue:
                  'Remind you at the times saved in medication and supplement schedules. As-needed items without a scheduled time do not send reminders.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  disabled={remoteBusy}
                  accessibilityLabel={t(
                    'notificationSettings.medicationReminders',
                    { defaultValue: 'Scheduled intake reminders' }
                  )}
                  value={medicationRemindersEnabled}
                  onValueChange={handleMedicationRemindersToggle}
                />
              }
            />
            {medicationRemindersEnabled && (
              <SettingsRow
                title={t('notificationSettings.repeatReminders', {
                  defaultValue: 'Intake follow-ups',
                })}
                subtitle={t('notificationSettings.repeatRemindersSubtitle', {
                  defaultValue:
                    'Optional follow-ups today at +10, +20 and +30 minutes. Recording taken or skipped cancels the remaining follow-ups. Off by default; your saved choice is kept.',
                })}
                subtitleNumberOfLines={0}
                rightAccessory={
                  <Switch
                    disabled={remoteBusy}
                    accessibilityLabel={t(
                      'notificationSettings.repeatReminders',
                      { defaultValue: 'Intake follow-ups' }
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
                  defaultValue: 'Hide names and doses',
                })}
                subtitle={t(
                  'notificationSettings.hideMedicationNamesSubtitle',
                  {
                    defaultValue:
                      'Hide the item’s name and dose on notifications. The title still distinguishes a medication from a supplement.',
                  }
                )}
                subtitleNumberOfLines={0}
                rightAccessory={
                  <Switch
                    disabled={remoteBusy}
                    accessibilityLabel={t(
                      'notificationSettings.hideMedicationNames',
                      { defaultValue: 'Hide names and doses' }
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
                  'After the chosen interval since the last drink, within your window. Stops at the known water goal. Uses remaining optional slots.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  disabled={remoteBusy}
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
                    <BottomSheetPicker
                      options={intervalSegments}
                      value={waterReminderIntervalHours}
                      title={t('notificationSettings.waterReminderInterval', {
                        defaultValue: 'Remind After',
                      })}
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
                disabled={remoteBusy}
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
                disabled={remoteBusy}
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
                  'Reminds only while the selected meal window is unresolved. Food, a meal photo, or an explicit meal state resolves it. Offline saves suppress the local reminder; server delivery needs the save to sync.',
              })}
              subtitleNumberOfLines={0}
              rightAccessory={
                <Switch
                  disabled={remoteBusy}
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
                  accessibilityLabel={t('notificationSettings.timeValue', {
                    defaultValue: 'Reminder time, {{time}}',
                    time: mealStart,
                  })}
                  disabled={remoteBusy}
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
                  accessibilityLabel={t('notificationSettings.timeValue', {
                    defaultValue: 'Reminder time, {{time}}',
                    time: mealPrompt,
                  })}
                  disabled={remoteBusy}
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
                  accessibilityLabel={t('notificationSettings.timeValue', {
                    defaultValue: 'Reminder time, {{time}}',
                    time: mealEnd,
                  })}
                  disabled={remoteBusy}
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
                  disabled={remoteBusy}
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
                accessibilityLabel={t('notificationSettings.timeValue', {
                  defaultValue: 'Reminder time, {{time}}',
                  time: reviewTime,
                })}
                disabled={remoteBusy}
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
                  disabled={remoteBusy}
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
              accessibilityLabel={t('notificationSettings.timeValue', {
                defaultValue: 'Reminder time, {{time}}',
                time: movementReminderTime,
              })}
              disabled={remoteBusy}
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
        {status && notificationsEnabled && (
          <SettingsRowGroup
            title={t('notificationSettings.statusTitle', {
              defaultValue: 'Delivery status · last 7 days',
            })}
          >
            <SettingsRow
              title={t('notificationSettings.statusNote', {
                defaultValue: 'Delivery does not mean seen',
              })}
              subtitle={t('notificationSettings.statusDescription', {
                defaultValue:
                  'Scheduled: reserved by the server. Accepted: Expo accepted the push. Receipt confirmed: the push service confirmed delivery. Unknown: do not retry an uncertain send automatically. Device Focus or notification summaries may delay presentation.',
              })}
              subtitleNumberOfLines={0}
            />
            {status.occurrences.slice(0, 6).map((item) => (
              <SettingsRow
                key={item.id}
                title={statusLabels.kind[item.kind]}
                subtitle={`${new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23', timeZone: preferences?.timezone ?? undefined }).format(new Date(item.scheduled_at))} · ${statusLabels.deliveryState[(item.deliveries[0]?.status ?? item.status) as keyof typeof statusLabels.deliveryState] ?? t('notificationSettings.reason.data_unavailable', { defaultValue: 'Required data unavailable; no reminder inferred' })}`}
                subtitleNumberOfLines={0}
              />
            ))}
            {status.diagnostics
              .filter((item) => item.reason !== 'disabled')
              .map((item, index) => (
                <SettingsRow
                  key={`${item.kind}:${index}`}
                  title={statusLabels.kind[item.kind]}
                  subtitle={`${statusLabels.reason[item.reason as keyof typeof statusLabels.reason] ?? t('notificationSettings.reason.data_unavailable', { defaultValue: 'Required data unavailable; no reminder inferred' })}${item.next_at ? ` · ${new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: preferences?.timezone ?? undefined }).format(new Date(item.next_at))}` : ''}`}
                  subtitleNumberOfLines={0}
                />
              ))}
          </SettingsRowGroup>
        )}
      </ScrollView>

      <TimeSheet
        ref={quietStartSheetRef}
        value={remoteSettings?.quiet_start ?? '22:00'}
        onSelectTime={(time) =>
          void updateSchedule({ quiet_start: time }, () => undefined)
        }
        commitOn="done"
      />
      <TimeSheet
        ref={quietEndSheetRef}
        value={remoteSettings?.quiet_end ?? '08:00'}
        onSelectTime={(time) =>
          void updateSchedule({ quiet_end: time }, () => undefined)
        }
        commitOn="done"
      />
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
        onSelectTime={(time) =>
          void updateSchedule({ meal_review_time: time }, () =>
            setReviewTime(time)
          )
        }
        commitOn="done"
      />
      <TimeSheet
        ref={movementTimeSheetRef}
        value={movementReminderTime}
        onSelectTime={(time) =>
          void updateSchedule({ movement_break_time: time }, () =>
            setMovementReminderTime(time)
          )
        }
        commitOn="done"
      />
    </View>
  );
};

export default NotificationSettingsScreen;
