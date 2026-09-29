import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatDose } from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import TrackingSummaryCard, {
  type SummaryStat,
} from '../components/tracking/TrackingSummaryCard';
import {
  useNeonScale,
  type NeonScale,
} from '../components/tracking/useNeonScale';
import { daypartLabel } from '../components/tracking/trackingLabels';
import GlowCard from '../components/ui/GlowCard';
import NeonButton from '../components/ui/NeonButton';
import { withAlpha } from '../components/ui/glow';
import StatusView from '../components/StatusView';
import Icon, { type IconName } from '../components/Icon';
import {
  useLogDose,
  useMedicationEntries,
  useMedications,
} from '../hooks/useMedications';
import { usePlannedSupplementActions } from '../hooks/usePlannedSupplementActions';
import { usePreferences, useServerConnection } from '../hooks';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { addDays, getDeviceTimezone, getTodayDate } from '../utils/dateUtils';
import {
  formatLocalizedTimeOfDay,
  localizedMealTimingLabel,
} from '../utils/medicationScheduleLocalization';
import {
  activeLocalSupplementStatus,
  doseSlotStatus,
  type DoseSlotStatus,
  type DueDose,
} from '../utils/medications';
import {
  groupByDaypart,
  supplementDosesFor,
  supplementStreak,
  type Daypart,
} from '../utils/supplementDay';
import { formatLocalizedNumber } from '../localization';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Supplements'>;

const STREAK_LOOKBACK_DAYS = 60;

const DAYPART_ICON: Record<Daypart, IconName> = {
  morning: 'sunrise',
  midday: 'sun',
  evening: 'moon',
  anytime: 'clock',
};

function daypartColor(part: Daypart, scale: NeonScale): string {
  switch (part) {
    case 'morning':
      return scale.yellow;
    case 'midday':
      return scale.orange;
    case 'evening':
      return scale.violet;
    default:
      return scale.cyan;
  }
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

const SupplementsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const [primary, secondary, border] = useCSSVariable([
    '--color-text-primary',
    '--color-text-secondary',
    '--color-border-subtle',
  ]) as [string, string, string];
  const [date, setDate] = useState(route.params?.date ?? getTodayDate());
  const { isConnected } = useServerConnection();
  const { preferences } = usePreferences({ enabled: isConnected });
  const remindersEnabled = useAppPreferencesStore(
    (s) => s.notificationsEnabled
  );
  const medicationsQuery = useMedications({
    activeOnly: true,
    enabled: isConnected,
  });
  const entriesQuery = useMedicationEntries({
    fromDate: addDays(date, -(STREAK_LOOKBACK_DAYS - 1)),
    toDate: date,
    enabled: isConnected,
  });
  const dayEntries = useMemo(
    () =>
      (entriesQuery.data ?? []).filter((entry) => entry.entry_date === date),
    [entriesQuery.data, date]
  );
  const { bySchedule: localActions, storageError } =
    usePlannedSupplementActions(date, dayEntries);
  const { entryForDue, logDose } = useLogDose(date, dayEntries);
  const timezone = getDeviceTimezone();
  const medications = useMemo(
    () => medicationsQuery.data ?? [],
    [medicationsQuery.data]
  );
  const supplements = medications.filter(
    (medication) => medication.is_supplement
  );
  const doses = useMemo(
    () => supplementDosesFor(medications, date, timezone),
    [medications, date, timezone]
  );

  // A queued local response (e.g. from a reminder) wins until it syncs, so
  // the row never shows a dose as open that the user already answered.
  const statusOf = (dose: DueDose): DoseSlotStatus =>
    activeLocalSupplementStatus(localActions.get(dose.schedule.id)) ??
    doseSlotStatus(entryForDue(dose));

  const taken = doses.filter((dose) => statusOf(dose) === 'taken').length;
  const skipped = doses.filter((dose) => statusOf(dose) === 'skipped').length;
  const applicable = doses.length - skipped;
  const isToday = date === getTodayDate();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nextDose = isToday
    ? doses
        .filter(
          (dose) =>
            statusOf(dose) === 'pending' &&
            dose.schedule.time_of_day &&
            minutesOf(dose.schedule.time_of_day) > nowMinutes
        )
        .sort(
          (a, b) =>
            minutesOf(a.schedule.time_of_day!) -
            minutesOf(b.schedule.time_of_day!)
        )[0]
    : undefined;
  const streak = useMemo(
    () =>
      supplementStreak({
        medications,
        entries: entriesQuery.data ?? [],
        today: date,
        timezone,
        lookbackDays: STREAK_LOOKBACK_DAYS,
      }),
    [medications, entriesQuery.data, date, timezone]
  );

  const timeLabel = (time: string | null | undefined) =>
    time
      ? formatLocalizedTimeOfDay(time, undefined, preferences?.time_format)
      : null;

  const record = (dose: DueDose, status: 'taken' | 'skipped') =>
    logDose(dose, status);

  const openMenu = (dose: DueDose) => {
    const status = statusOf(dose);
    Alert.alert(dose.medication.name, undefined, [
      status === 'skipped'
        ? {
            text: t('supplements.undoSkip', { defaultValue: 'Undo skip' }),
            onPress: () => record(dose, 'skipped'),
          }
        : {
            text: t('supplements.skipDose', { defaultValue: 'Skip this dose' }),
            onPress: () => record(dose, 'skipped'),
          },
      {
        text: t('supplements.details', {
          defaultValue: 'Details and schedule',
        }),
        onPress: () =>
          navigation.navigate('MedicationDetail', {
            medicationId: dose.medication.id,
          }),
      },
      { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
    ]);
  };

  const stats: SummaryStat[] = [];
  if (isToday) {
    stats.push({
      icon: 'bell',
      color: scale.green,
      value: nextDose ? (timeLabel(nextDose.schedule.time_of_day) ?? '') : '–',
      label: t('supplements.nextDose', { defaultValue: 'Next dose' }),
      detail: nextDose?.medication.name,
      testID: 'supplements-next',
    });
  }
  if (streak > 0) {
    stats.push({
      icon: 'flame',
      color: scale.orange,
      value: formatLocalizedNumber(streak),
      label: t('supplements.streak', {
        defaultValue: 'days all taken',
      }),
      testID: 'supplements-streak',
    });
  }

  const title = t('supplements.title', { defaultValue: 'Supplements' });
  const subtitle = t('supplements.subtitle', {
    defaultValue: 'Stay consistent with your daily routine.',
  });

  if (!isConnected) {
    return (
      <TrackingScreen
        testID="supplements"
        title={title}
        subtitle={subtitle}
        onBack={navigation.goBack}
      >
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          title={t('supplements.offlineTitle', {
            defaultValue: 'Supplements need your server',
          })}
          subtitle={t('supplements.offlineSubtitle', {
            defaultValue: 'Connect to your server to see your routine.',
          })}
        />
      </TrackingScreen>
    );
  }

  return (
    <TrackingScreen
      testID="supplements"
      title={title}
      subtitle={subtitle}
      date={date}
      onDateChange={setDate}
      onBack={navigation.goBack}
      onRefresh={() =>
        Promise.all([medicationsQuery.refetch(), entriesQuery.refetch()])
      }
    >
      {storageError ? (
        <Text className="mb-2 text-sm text-text-danger">
          {t('medications.dose.savedActionError', {
            defaultValue:
              'A saved supplement response could not be read. Check the diary before logging again.',
          })}
        </Text>
      ) : null}
      {medicationsQuery.isLoading ? (
        <StatusView
          loading
          title={t('supplements.loading', {
            defaultValue: 'Loading supplements…',
          })}
        />
      ) : supplements.length === 0 ? (
        <GlowCard
          className="mb-3 items-center gap-3 p-6"
          testID="supplements-empty"
        >
          <Icon name="medication" size={36} color={scale.green} />
          <Text className="text-center text-base font-semibold text-text-primary">
            {t('supplements.emptyTitle', {
              defaultValue: 'No supplements yet',
            })}
          </Text>
          <Text className="text-center text-sm text-text-secondary">
            {t('supplements.emptySubtitle', {
              defaultValue:
                'Add a supplement with a schedule to see it here. Medications stay in Medications.',
            })}
          </Text>
          <NeonButton
            testID="supplements-add"
            icon="add"
            label={t('supplements.add', { defaultValue: 'Add supplement' })}
            onPress={() =>
              navigation.navigate('MedicationForm', { supplement: true })
            }
          />
        </GlowCard>
      ) : (
        <>
          <TrackingSummaryCard
            testID="supplements-summary"
            completed={taken}
            applicable={applicable}
            caption={t('supplements.takenToday', { defaultValue: 'taken' })}
            emptyCaption={
              doses.length === 0
                ? t('supplements.noneScheduled', {
                    defaultValue: 'No supplements scheduled for this day.',
                  })
                : t('supplements.allSkipped', {
                    defaultValue: 'All doses skipped.',
                  })
            }
            progressLabel={t('supplements.progressLabel', {
              defaultValue: 'Supplements taken',
            })}
            stats={stats}
          />

          {groupByDaypart(doses).map(({ daypart, doses: group }) => {
            const color = daypartColor(daypart, scale);
            const groupTaken = group.filter(
              (dose) => statusOf(dose) === 'taken'
            ).length;
            return (
              <GlowCard
                key={daypart}
                glowColor={color}
                className="mb-3 p-3"
                testID={`supplements-group-${daypart}`}
              >
                <View className="mb-2 flex-row flex-wrap items-center gap-3 px-1">
                  <Icon name={DAYPART_ICON[daypart]} size={24} color={color} />
                  <Text
                    accessibilityRole="header"
                    className="min-w-[40%] flex-1 text-lg font-semibold text-text-primary"
                  >
                    {daypartLabel(t, daypart)}
                  </Text>
                  <View
                    className="rounded-full border px-3 py-1"
                    style={{
                      borderColor: color,
                      backgroundColor: withAlpha(color, 0.12),
                    }}
                  >
                    <Text className="text-sm font-semibold" style={{ color }}>
                      {t('supplements.groupTaken', {
                        defaultValue: '{{taken}} / {{total}} taken',
                        taken: groupTaken,
                        total: group.length,
                      })}
                    </Text>
                  </View>
                </View>
                {group.map((dose) => {
                  const status = statusOf(dose);
                  const isTaken = status === 'taken';
                  const time = dose.schedule.time_of_day;
                  const overdue =
                    isToday &&
                    status === 'pending' &&
                    time !== null &&
                    time !== undefined &&
                    minutesOf(time) <= nowMinutes;
                  const timeColor = isTaken
                    ? scale.green
                    : overdue
                      ? scale.red
                      : secondary;
                  const amount = formatDose(dose.medication, dose.schedule);
                  const withMeal = dose.schedule.with_meal
                    ? localizedMealTimingLabel(t, dose.schedule.with_meal)
                    : null;
                  return (
                    <View
                      key={`${dose.medication.id}-${dose.schedule.id}`}
                      testID={`supplement-row-${dose.schedule.id}`}
                      className="mb-2 flex-row flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2"
                      style={{
                        borderColor: overdue
                          ? withAlpha(scale.yellow, 0.8)
                          : border,
                        backgroundColor: withAlpha(color, 0.04),
                      }}
                    >
                      <Pressable
                        testID={`supplement-take-${dose.schedule.id}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isTaken }}
                        accessibilityLabel={
                          isTaken
                            ? t('supplements.takenA11y', {
                                defaultValue: '{{name}} taken. Tap to undo.',
                                name: dose.medication.name,
                              })
                            : t('supplements.markTakenA11y', {
                                defaultValue: 'Mark {{name}} taken',
                                name: dose.medication.name,
                              })
                        }
                        onPress={() => record(dose, 'taken')}
                        className="h-11 w-11 items-center justify-center"
                      >
                        <View
                          className="h-8 w-8 items-center justify-center rounded-full"
                          style={
                            isTaken
                              ? { backgroundColor: scale.green }
                              : { borderWidth: 2, borderColor: secondary }
                          }
                        >
                          {isTaken ? (
                            <Icon name="checkmark" size={16} color="#08130d" />
                          ) : null}
                        </View>
                      </Pressable>
                      <View className="min-w-[55%] flex-1">
                        <Text
                          className="text-base font-semibold text-text-primary"
                          numberOfLines={2}
                        >
                          {dose.medication.name}
                        </Text>
                        <View className="flex-row flex-wrap items-center gap-2">
                          {amount ? (
                            <Text className="text-sm text-text-secondary">
                              {amount}
                            </Text>
                          ) : null}
                          {withMeal ? (
                            <View className="rounded-md border border-border-subtle px-2 py-0.5">
                              <Text className="text-xs text-text-secondary">
                                {withMeal}
                              </Text>
                            </View>
                          ) : null}
                          {status === 'skipped' ? (
                            <Text className="text-xs text-text-secondary">
                              {t('supplements.skipped', {
                                defaultValue: 'Skipped',
                              })}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {time ? (
                        <View className="flex-row items-center gap-1">
                          <Icon name="clock" size={14} color={timeColor} />
                          <Text
                            className="text-sm"
                            style={{ color: timeColor }}
                          >
                            {timeLabel(time)}
                          </Text>
                        </View>
                      ) : null}
                      <Pressable
                        testID={`supplement-menu-${dose.schedule.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={t('supplements.moreActions', {
                          defaultValue: 'More actions for {{name}}',
                          name: dose.medication.name,
                        })}
                        onPress={() => openMenu(dose)}
                        className="h-11 w-8 items-center justify-center"
                      >
                        <Icon
                          name="ellipsis-horizontal"
                          size={18}
                          color={primary}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </GlowCard>
            );
          })}

          <GlowCard
            glowColor={scale.green}
            className="mb-3 p-4"
            testID="supplements-settings"
          >
            <View className="mb-3 flex-row items-center gap-3">
              <Icon name="bell" size={22} color={scale.green} />
              <View className="flex-1">
                <Text
                  accessibilityRole="header"
                  className="text-base font-semibold text-text-primary"
                >
                  {t('supplements.reminderTitle', {
                    defaultValue: 'Reminders and routine',
                  })}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {remindersEnabled
                    ? t('supplements.remindersOn', {
                        defaultValue:
                          'Scheduled reminders are on. Snooze and skip from the notification.',
                      })
                    : t('supplements.remindersOff', {
                        defaultValue:
                          'Notifications are off. Turn them on in Notification settings.',
                      })}
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <NeonButton
                variant="outline"
                size="sm"
                icon="bell"
                label={t('supplements.notificationSettings', {
                  defaultValue: 'Notifications',
                })}
                onPress={() => navigation.navigate('NotificationSettings')}
                className="flex-1"
              />
              <NeonButton
                variant="outline"
                size="sm"
                icon="pencil"
                label={t('supplements.editRoutine', {
                  defaultValue: 'Edit routine ({{count}})',
                  count: supplements.length,
                })}
                onPress={() => navigation.navigate('MedicationsList')}
                className="flex-1"
              />
            </View>
          </GlowCard>
        </>
      )}
    </TrackingScreen>
  );
};

export default SupplementsScreen;
