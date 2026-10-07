import Button from '../components/ui/Button';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  habitDayState,
  isHabitDue,
  isWellnessActivity,
  type Habit,
} from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import TrackingSummaryCard from '../components/tracking/TrackingSummaryCard';
import HabitRow from '../components/tracking/HabitRow';
import {
  useNeonScale,
  type NeonScale,
} from '../components/tracking/useNeonScale';
import GlowCard from '../components/ui/GlowCard';
import NeonButton from '../components/ui/NeonButton';
import { withAlpha } from '../components/ui/glow';
import SegmentedControl from '../components/SegmentedControl';
import StatusView from '../components/StatusView';
import Icon, { type IconName } from '../components/Icon';
import {
  useDailyTrackingPreferences,
  useHabitLogs,
  useHabits,
  useLogHabit,
} from '../hooks/useDailyTracking';
import { usePreferences, useServerConnection } from '../hooks';
import { addDays, getTodayDate } from '../utils/dateUtils';
import { formatLocalizedTimeOfDay } from '../utils/medicationScheduleLocalization';
import { computeHabitTrend } from '../utils/habitTrends';
import { formatLocalizedNumber } from '../localization';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Habits'>;
type Range = 7 | 30 | 90;
const HISTORY_DAYS = 90;

function habitTint(index: number, scale: NeonScale): string {
  const tints = [
    scale.green,
    scale.orange,
    scale.cyan,
    scale.violet,
    scale.yellow,
    scale.mint,
  ];
  return tints[index % tints.length];
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

const HabitsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const [secondary, border, track] = useCSSVariable([
    '--color-text-secondary',
    '--color-border-subtle',
    '--color-progress-track',
  ]) as [string, string, string];
  const [date, setDate] = useState(route.params?.date ?? getTodayDate());
  const [focusedId, setFocusedId] = useState(route.params?.habitId);
  const [range, setRange] = useState<Range>(7);
  const [trendHabitId, setTrendHabitId] = useState<string | null>(null);
  const { isConnected } = useServerConnection();
  const { preferences } = usePreferences({ enabled: isConnected });
  const habitsQuery = useHabits({ enabled: isConnected });
  const trackingPreferences = useDailyTrackingPreferences({
    enabled: isConnected,
  });
  const startDate = addDays(date, -(HISTORY_DAYS - 1));
  const logsQuery = useHabitLogs(startDate, date, { enabled: isConnected });
  const logHabit = useLogHabit(startDate, date);

  const habits = useMemo(
    () =>
      (habitsQuery.data ?? []).filter((habit) => !isWellnessActivity(habit)),
    [habitsQuery.data]
  );
  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data]);
  const dueHabits = habits.filter((habit) => isHabitDue(habit, date));
  const todaysLogs = new Map(
    logs
      .filter((log) => log.entry_date === date)
      .map((log) => [log.habit_id, log])
  );
  const completed = dueHabits.filter(
    (habit) => habitDayState(habit, todaysLogs.get(habit.id)) === 'complete'
  ).length;

  const isToday = date === getTodayDate();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const open = dueHabits.filter(
    (habit) => habitDayState(habit, todaysLogs.get(habit.id)) !== 'complete'
  );
  const dueNow = isToday
    ? open.filter(
        (habit) =>
          habit.reminder_time && minutesOf(habit.reminder_time) <= nowMinutes
      )
    : [];
  const nextReminder =
    isToday && trackingPreferences.data?.habit_reminders_enabled
      ? open
          .filter(
            (habit) =>
              habit.reminder_time && minutesOf(habit.reminder_time) > nowMinutes
          )
          .sort(
            (a, b) => minutesOf(a.reminder_time!) - minutesOf(b.reminder_time!)
          )[0]
      : undefined;

  const timeLabel = (habit: Habit) =>
    habit.reminder_time
      ? formatLocalizedTimeOfDay(
          habit.reminder_time,
          undefined,
          preferences?.time_format
        )
      : null;

  const save = (habit: Habit, value: boolean | number | null) =>
    logHabit.mutate(
      { habitId: habit.id, body: { entry_date: date, value } },
      {
        onError: () =>
          Toast.show({
            type: 'error',
            text1: t('habits.saveFailed', {
              defaultValue: 'Could not save. Please try again.',
            }),
          }),
      }
    );

  const trendHabit =
    habits.find((habit) => habit.id === trendHabitId) ??
    habits.find((habit) => habit.habit_type === 'count') ??
    habits[0];
  const trend = trendHabit
    ? computeHabitTrend(trendHabit, logs, date, range)
    : null;
  const maxValue = trend
    ? Math.max(
        1,
        ...trend.days.map((day) => day.value ?? 0),
        trendHabit?.target ?? 0
      )
    : 1;
  const countTrend = trendHabit?.habit_type === 'count';
  const unit = trendHabit?.unit ?? '';
  const locale = { maximumFractionDigits: 1 };

  const title = t('habits.title', { defaultValue: 'Habits' });
  const subtitle = t('habits.subtitle', {
    defaultValue: 'Track routines, reps, and daily consistency.',
  });

  if (!isConnected) {
    return (
      <TrackingScreen
        testID="habits"
        title={title}
        subtitle={subtitle}
        onBack={navigation.goBack}
      >
        <StatusView
          icon="cloud-offline"
          iconTone="muted"
          title={t('habits.offlineTitle', {
            defaultValue: 'Habits need your server',
          })}
          subtitle={t('habits.offlineSubtitle', {
            defaultValue: 'Connect to your server to see and log habits.',
          })}
        />
      </TrackingScreen>
    );
  }

  return (
    <TrackingScreen
      testID="habits"
      title={title}
      subtitle={subtitle}
      date={date}
      onDateChange={setDate}
      onBack={navigation.goBack}
      onRefresh={() =>
        Promise.all([habitsQuery.refetch(), logsQuery.refetch()])
      }
      titleAccessory={
        dueHabits.length > 0 ? (
          <View className="mt-2 flex-row items-center gap-1 rounded-full border border-border-subtle px-3 py-1.5">
            <Icon name="calendar" size={14} color={secondary} />
            <Text className="text-xs text-text-primary">
              {t('habits.scheduledCount', {
                defaultValue: '{{count}} scheduled',
                count: dueHabits.length,
              })}
            </Text>
          </View>
        ) : null
      }
    >
      {focusedId && (
        <NeonButton
          label={t('common.showAll', { defaultValue: 'Show all' })}
          variant="subtle"
          onPress={() => setFocusedId(undefined)}
        />
      )}
      {habitsQuery.isLoading ? (
        <StatusView
          loading
          title={t('habits.loading', { defaultValue: 'Loading habits…' })}
        />
      ) : habits.length === 0 ? (
        <GlowCard className="mb-3 items-center gap-3 p-6" testID="habits-empty">
          <Icon name="habit" size={36} color={scale.green} />
          <Text className="text-center text-base font-semibold text-text-primary">
            {t('habits.emptyTitle', { defaultValue: 'No habits yet' })}
          </Text>
          <Text className="text-center text-sm text-text-secondary">
            {t('habits.emptySubtitle', {
              defaultValue:
                'Add a routine you want to track, such as stretching or reading. Water is tracked in Hydration.',
            })}
          </Text>
          <NeonButton
            testID="habits-create"
            icon="add"
            label={t('habits.addHabit', { defaultValue: 'Add habit' })}
            onPress={() => navigation.navigate('HabitForm')}
          />
        </GlowCard>
      ) : (
        <>
          <TrackingSummaryCard
            testID="habits-summary"
            completed={completed}
            applicable={dueHabits.length}
            caption={t('habits.loggedToday', { defaultValue: 'complete' })}
            emptyCaption={t('habits.noneScheduled', {
              defaultValue: 'No habits scheduled for this day.',
            })}
            progressLabel={t('habits.progressLabel', {
              defaultValue: 'Habits complete',
            })}
            stats={
              isToday
                ? [
                    {
                      icon: 'clock',
                      color: dueNow.length > 0 ? scale.red : secondary,
                      value: formatLocalizedNumber(dueNow.length),
                      label: t('habits.dueNow', { defaultValue: 'due now' }),
                      detail: dueNow[0]?.name,
                      testID: 'habits-due-now',
                    },
                    {
                      icon: 'bell',
                      color: scale.green,
                      value: nextReminder
                        ? (timeLabel(nextReminder) ?? '')
                        : '–',
                      label: t('habits.nextReminder', {
                        defaultValue: 'Next reminder',
                      }),
                      detail: nextReminder?.name,
                      testID: 'habits-next-reminder',
                    },
                  ]
                : []
            }
          />

          <GlowCard
            glowColor={scale.green}
            className="mb-3 px-4 pt-3 pb-1"
            testID="habits-today"
          >
            <View className="flex-row items-center gap-2 pb-1">
              <Icon name="chart-bar" size={20} color={secondary} />
              <Text
                accessibilityRole="header"
                className="flex-1 text-lg font-semibold text-text-primary"
              >
                {isToday
                  ? t('habits.todaysHabits', { defaultValue: 'Today’s habits' })
                  : t('habits.daysHabits', {
                      defaultValue: 'Habits for this day',
                    })}
              </Text>
              <Text className="text-sm text-text-secondary">
                {t('habits.habitCount', {
                  defaultValue: '{{count}} habits',
                  count: dueHabits.length,
                })}
              </Text>
            </View>
            {dueHabits.length === 0 ? (
              <Text className="py-3 text-sm text-text-secondary">
                {t('habits.noneScheduled', {
                  defaultValue: 'No habits scheduled for this day.',
                })}
              </Text>
            ) : (
              dueHabits
                .filter((habit) => !focusedId || habit.id === focusedId)
                .map((habit, index) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    log={todaysLogs.get(habit.id)}
                    timeLabel={timeLabel(habit)}
                    tint={habitTint(index, scale)}
                    saving={
                      logHabit.isPending &&
                      logHabit.variables?.habitId === habit.id
                    }
                    onSave={(value) => save(habit, value)}
                    onEdit={() =>
                      navigation.navigate('HabitForm', { habitId: habit.id })
                    }
                    showDivider={index > 0}
                  />
                ))
            )}
          </GlowCard>

          {trend && trendHabit ? (
            <GlowCard
              glowColor={scale.cyan}
              className="mb-3 p-4"
              testID="habits-trends"
            >
              <View className="mb-3 flex-row items-center gap-2">
                <Icon name="chart-bar" size={20} color={secondary} />
                <Text
                  accessibilityRole="header"
                  className="flex-1 text-lg font-semibold text-text-primary"
                >
                  {t('habits.trends', { defaultValue: 'Quick trends' })}
                </Text>
              </View>
              <SegmentedControl
                segments={[
                  { key: '7', label: t('ranges.7d', { defaultValue: '7d' }) },
                  {
                    key: '30',
                    label: t('ranges.30d', { defaultValue: '30d' }),
                  },
                  {
                    key: '90',
                    label: t('ranges.90d', { defaultValue: '90d' }),
                  },
                ]}
                activeKey={String(range)}
                onSelect={(key) => setRange(Number(key) as Range)}
              />
              <View className="my-3 flex-row flex-wrap gap-2">
                {habits.map((habit) => {
                  const selected = habit.id === trendHabit.id;
                  return (
                    <Button
                      variant={selected ? 'primary' : 'secondary'}
                      key={habit.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setTrendHabitId(habit.id)}
                      className="min-h-11 justify-center px-3"
                    >
                      <Text className="text-xs text-text-primary">
                        {habit.name}
                      </Text>
                    </Button>
                  );
                })}
              </View>
              <View className="mb-3 flex-row flex-wrap gap-2">
                <TrendStat
                  icon="calendar"
                  color={scale.green}
                  value={`${formatLocalizedNumber(trend.loggedDays)}/${formatLocalizedNumber(trend.days.length)}`}
                  label={t('habits.loggedDays', {
                    defaultValue: 'days recorded',
                  })}
                />
                <TrendStat
                  icon="checkmark-circle"
                  color={scale.mint}
                  value={`${formatLocalizedNumber(trend.completedDays)}/${formatLocalizedNumber(trend.scheduledDays)}`}
                  label={t('habits.completedScheduled', {
                    defaultValue: 'scheduled days complete',
                  })}
                />
                {countTrend ? (
                  <>
                    <TrendStat
                      icon="chart-bar"
                      color={scale.cyan}
                      value={
                        trend.average === null
                          ? '–'
                          : formatLocalizedNumber(trend.average, locale)
                      }
                      label={t('habits.average', {
                        defaultValue: 'average {{unit}}',
                        unit,
                      }).trim()}
                    />
                    <TrendStat
                      icon="trophy"
                      color={scale.yellow}
                      value={
                        trend.best === null
                          ? '–'
                          : formatLocalizedNumber(trend.best, locale)
                      }
                      label={t('habits.best', {
                        defaultValue: 'best {{unit}}',
                        unit,
                      }).trim()}
                    />
                  </>
                ) : null}
                {/* A streak is secondary and never shown as a zero. */}
                {trend.currentStreak > 0 ? (
                  <TrendStat
                    icon="flame"
                    color={scale.orange}
                    value={formatLocalizedNumber(trend.currentStreak)}
                    label={t('habits.streak', { defaultValue: 'in a row' })}
                  />
                ) : null}
              </View>
              <Text className="mb-2 text-xs text-text-secondary">
                {countTrend
                  ? t('habits.chartCaption', {
                      defaultValue:
                        '{{name}}, last {{count}} days. Gaps are days without a record.',
                      name: trendHabit.name,
                      count: range,
                    })
                  : t('habits.calendarCaption', {
                      defaultValue: '{{name}}, last {{count}} days.',
                      name: trendHabit.name,
                      count: range,
                    })}
              </Text>
              {countTrend ? (
                <View
                  className="h-28 flex-row items-end gap-[2px]"
                  accessibilityRole="image"
                  accessibilityLabel={t('habits.chartA11y', {
                    defaultValue: '{{recorded}} of {{count}} days recorded',
                    recorded: trend.loggedDays,
                    count: range,
                  })}
                >
                  {trend.days.map((day) => (
                    <View
                      key={day.date}
                      className="flex-1 items-center justify-end"
                    >
                      {range === 7 && day.value !== null ? (
                        <Text className="text-[10px] text-text-primary">
                          {formatLocalizedNumber(day.value, locale)}
                        </Text>
                      ) : null}
                      <View
                        className="w-full rounded-t"
                        style={{
                          height:
                            day.value === null
                              ? 2
                              : Math.max(3, (day.value / maxValue) * 84),
                          backgroundColor:
                            day.value === null
                              ? track
                              : withAlpha(
                                  scale.green,
                                  day.state === 'complete' ? 0.9 : 0.5
                                ),
                        }}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  className="flex-row flex-wrap gap-1"
                  accessibilityRole="image"
                  accessibilityLabel={t('habits.calendarA11y', {
                    defaultValue:
                      '{{complete}} of {{scheduled}} scheduled days complete',
                    complete: trend.completedDays,
                    scheduled: trend.scheduledDays,
                  })}
                >
                  {trend.days.map((day) => (
                    <View
                      key={day.date}
                      className="h-5 w-5 rounded"
                      style={{
                        backgroundColor:
                          day.state === 'complete'
                            ? scale.green
                            : day.state === 'not_done'
                              ? withAlpha(scale.orange, 0.5)
                              : 'transparent',
                        borderWidth: 1,
                        borderColor: day.scheduled ? border : 'transparent',
                        opacity: day.scheduled ? 1 : 0.35,
                      }}
                    />
                  ))}
                </View>
              )}
            </GlowCard>
          ) : null}

          <GlowCard
            glowColor={scale.green}
            className="mb-3 p-4"
            testID="habits-manage"
          >
            <View className="mb-3 flex-row items-center gap-3">
              <Icon name="settings" size={22} color={secondary} />
              <View className="flex-1">
                <Text
                  accessibilityRole="header"
                  className="text-base font-semibold text-text-primary"
                >
                  {t('habits.manageTitle', { defaultValue: 'Manage habits' })}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {t('habits.manageSubtitle', {
                    defaultValue: 'Edit habits, reminders, and schedules.',
                  })}
                </Text>
              </View>
            </View>
            <View className="gap-2">
              <NeonButton
                variant="outline"
                size="sm"
                icon="pencil"
                label={t('habits.editHabits', { defaultValue: 'Edit habits' })}
                onPress={() => navigation.navigate('HabitsManage')}
              />
              <NeonButton
                variant="outline"
                size="sm"
                icon="bell"
                label={t('habits.reminderSettings', {
                  defaultValue: 'Reminders',
                })}
                onPress={() => navigation.navigate('TrackingSettings')}
              />
            </View>
          </GlowCard>
        </>
      )}
    </TrackingScreen>
  );
};

function TrendStat({
  icon,
  color,
  value,
  label,
}: {
  icon: IconName;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <View
      className="min-w-[30%] flex-1 flex-row items-center gap-2 rounded-xl border px-3 py-2"
      style={{
        borderColor: withAlpha(color, 0.45),
        backgroundColor: withAlpha(color, 0.08),
      }}
    >
      <Icon name={icon} size={20} color={color} />
      <View className="flex-1">
        <Text className="text-lg font-bold text-text-primary">{value}</Text>
        <Text className="text-xs text-text-secondary" numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export default HabitsScreen;
