import { Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import {
  getDueDosesForDate,
  utcToLocalDateTimeInput,
  type Habit,
  type MedicationDetail,
  type MedicationEntry,
} from '@workspace/shared';
import { useProjectedDailyProgress } from './useProjectedDailyProgress';
import { useActivityPlanning } from './useActivityPlanning';
import { useProgressActions } from './useProgressActions';
import { useLogDose } from './useMedications';
import { useLogHabit } from './useDailyTracking';
import { getTodayDate } from '../utils/dateUtils';
import { diaryTimestamp, wellnessTimestamp } from '../utils/diaryTimeline';
import type { DiaryTimelineEntry } from '../components/DiaryTimeline';
import Icon from '../components/Icon';
import NeonButton from '../components/ui/NeonButton';
import ActivityTargetProgress from '../components/tracking/ActivityTargetProgress';

/** Existing explicit resolution paths; planned values never become logged health data. */
export function useDiaryScheduledEntries(
  date: string,
  enabled: boolean,
  timezone: string,
  habits: Habit[],
  medications: MedicationDetail[],
  intakes: MedicationEntry[],
  onHydration: () => void
) {
  const { t } = useTranslation();
  const [accent, trainingColor, sleepColor] = useCSSVariable([
    '--color-accent-primary',
    '--color-action-training',
    '--color-macro-carbs',
  ]) as string[];
  const scheduledDay = date >= getTodayDate();
  const progress = useProjectedDailyProgress(date, enabled);
  const activities = useActivityPlanning(date, date, enabled && scheduledDay);
  const { itemLabel, openItem } = useProgressActions(date, onHydration);
  const habitMutation = useLogHabit(date, date);
  const doses = useLogDose(date, intakes);
  const entries: DiaryTimelineEntry[] = [];
  const stateLabels = {
    complete: t('progress.state.complete', { defaultValue: 'Complete' }),
    started: t('progress.state.started', { defaultValue: 'Started' }),
    pending: t('diary.timeline.planned', {
      defaultValue: 'Planned · nothing logged yet',
    }),
    excluded: t('progress.state.excluded', {
      defaultValue: 'Skipped, not counted',
    }),
  };
  for (const item of progress.progress?.items ?? []) {
    if (['meal', 'supplement', 'goal'].includes(item.domain)) continue;
    if (item.domain === 'measurement' && item.state === 'complete') continue;
    if (
      !scheduledDay &&
      !(item.domain === 'habit' || item.domain === 'checkin')
    )
      continue;
    if (!scheduledDay && !item.recorded_at) continue;
    // Workout/mobility evidence already has a recorded session timeline row.
    if (
      ['workout', 'activity'].includes(item.domain) &&
      (!scheduledDay || item.state === 'complete')
    )
      continue;
    const habit = habits.find((record) => record.id === item.reference_id);
    const activity = activities.query.data?.occurrences.find(
      (record) => record.id === item.id
    );
    const prescription = activity
      ? activities.query.data?.workout_plans
          .find((plan) => String(plan.id) === activity.source_id)
          ?.assignments.find(
            (assignment) => assignment.id === activity.assignment_id
          )
      : undefined;
    const isRecorded =
      item.state === 'complete' &&
      !['workout', 'activity'].includes(item.domain);
    const clock =
      scheduledDay && !isRecorded
        ? (habit?.reminder_time?.slice(0, 5) ??
          prescription?.plannedTime?.slice(0, 5))
        : null;
    const label = itemLabel(item);
    const binary = habit?.habit_type === 'completion';
    const timestamp = clock
      ? diaryTimestamp(date, clock, timezone)
      : item.recorded_at && item.domain !== 'measurement'
        ? wellnessTimestamp(date, item.recorded_at, timezone)
        : null;
    entries.push({
      id: `task:${item.id}`,
      label,
      clock:
        clock ??
        (timestamp !== null && item.recorded_at
          ? utcToLocalDateTimeInput(item.recorded_at, timezone).slice(11, 16)
          : null),
      timestamp,
      section: isRecorded ? 'recorded' : 'planned',
      icon:
        item.domain === 'measurement'
          ? 'scale'
          : item.domain === 'workout' || item.domain === 'activity'
            ? 'exercise-running'
            : item.domain === 'checkin'
              ? 'daily-checkin'
              : 'habit',
      color:
        item.domain === 'workout' || item.domain === 'activity'
          ? trainingColor
          : item.domain === 'checkin'
            ? sleepColor
            : accent,
      collapsible: true,
      summary: stateLabels[item.state],
      accessory: binary ? (
        <Pressable
          testID={`diary-check-${item.id}`}
          accessibilityRole="checkbox"
          accessibilityLabel={label}
          accessibilityState={{
            checked: item.state === 'complete',
            disabled: habitMutation.isPending || date > getTodayDate(),
          }}
          disabled={habitMutation.isPending || date > getTodayDate()}
          className="h-11 w-11 items-center justify-center"
          onPress={() =>
            habitMutation.mutate({
              habitId: habit.id,
              body: {
                entry_date: date,
                value: item.state === 'complete' ? null : true,
              },
            })
          }
        >
          <Icon
            name={
              item.state === 'complete'
                ? 'checkmark-circle'
                : 'radio-button-off'
            }
            size={24}
            color={accent}
          />
        </Pressable>
      ) : undefined,
      content: (
        <View className="gap-2">
          <ActivityTargetProgress occurrence={activity} />
          <NeonButton
            variant="subtle"
            className=""
            label={t('common.details', { defaultValue: 'Details' })}
            onPress={() => openItem(item)}
          />
        </View>
      ),
    });
  }
  if (scheduledDay)
    for (const dose of getDueDosesForDate(medications, date, timezone)) {
      const entry = doses.entryForDue(dose);
      if (entry?.status === 'taken' || entry?.status === 'prn_taken') continue;
      const label = dose.medication.name;
      const clock = dose.schedule.time_of_day?.slice(0, 5) ?? null;
      const skipped = entry?.status === 'skipped';
      entries.push({
        id: `dose:${dose.schedule.id}`,
        section: 'planned',
        icon: 'medication',
        label,
        clock,
        timestamp: diaryTimestamp(date, clock, timezone),
        collapsible: true,
        summary: skipped ? stateLabels.excluded : stateLabels.pending,
        accessory: (
          <Pressable
            testID={`diary-check-dose-${dose.schedule.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('diary.timeline.recordIntake', {
              defaultValue: 'Record {{name}} as taken',
              name: label,
            })}
            disabled={date > getTodayDate()}
            className="h-11 w-11 items-center justify-center"
            onPress={() => doses.logDose(dose, 'taken')}
          >
            <Icon
              name={skipped ? 'skip-forward' : 'radio-button-off'}
              size={24}
              color={accent}
            />
          </Pressable>
        ),
        content: (
          <View className="gap-2">
            <Text className="text-sm text-text-secondary">
              {t('diary.timeline.plannedIntakeHint', {
                defaultValue:
                  'Planned intake. Record it only after you have taken it.',
              })}
            </Text>
            <NeonButton
              className=""
              variant="subtle"
              label={t('supplements.skipDose', {
                defaultValue: 'Skip this dose',
              })}
              onPress={() => doses.logDose(dose, 'skipped')}
            />
          </View>
        ),
      });
    }
  return {
    entries,
    isLoading:
      progress.isLoading || (scheduledDay && activities.query.isLoading),
    isError:
      progress.isError ||
      (scheduledDay && activities.query.isError) ||
      habitMutation.isError,
    refetch: () =>
      Promise.all([
        progress.refetch(),
        ...(scheduledDay ? [activities.query.refetch()] : []),
      ]),
  };
}
