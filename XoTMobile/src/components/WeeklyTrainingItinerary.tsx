import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { activityWeekRange, addDays } from '@workspace/shared';
import { useCSSVariable } from 'uniwind';
import { useActivityPlanning } from '../hooks/useActivityPlanning';
import { formatDate } from '../utils/dateUtils';
import { formatLocalizedNumber, useAppLocale } from '../localization';
import { plannedWorkoutIcon } from '../utils/workoutSession';
import Icon from './Icon';
import Button from './ui/Button';
import StatusView from './StatusView';
import TrainingSessionRow from './TrainingSessionRow';
import { progressActivityLabel } from './tracking/trackingLabels';

export default function WeeklyTrainingItinerary({
  date,
  enabled,
  onDateChange,
  onOpenDay,
  onOpenPlan,
}: {
  date: string;
  enabled: boolean;
  onDateChange: (day: string) => void;
  onOpenDay: (day: string) => void;
  onOpenPlan: (day: string, id?: string) => void;
}) {
  const { t } = useTranslation();
  const expandedText = useWindowDimensions().fontScale > 1.3;
  const locale = useAppLocale();
  const range = activityWeekRange(date);
  const data = useActivityPlanning(range.start_date, range.end_date, enabled);
  const color = useCSSVariable('--color-action-training') as string;
  return (
    <View testID="weekly-training-itinerary" className="mb-3 gap-2">
      <View className="flex-row gap-1">
        {Array.from({ length: 7 }, (_, index) =>
          addDays(range.start_date, index)
        ).map((day) => (
          <Button
            variant={date === day ? 'primary' : 'secondary'}
            key={day}
            testID={`weekly-day-${day}`}
            accessibilityRole="button"
            accessibilityLabel={new Date(`${day}T12:00:00`).toLocaleDateString(
              locale,
              { weekday: 'short', day: 'numeric', month: 'short' }
            )}
            accessibilityState={{ selected: date === day }}
            onPress={() => onDateChange(day)}
            className="min-h-16 flex-1 items-center justify-center px-0 py-2"
          >
            <Text className="text-xs text-text-secondary">
              {new Date(`${day}T12:00:00`).toLocaleDateString(locale, {
                weekday: 'short',
              })}
            </Text>
            <Text className="text-base font-bold text-text-primary">
              {new Date(`${day}T12:00:00`).getDate()}
            </Text>
            {data.query.data && (
              <View
                className="mt-1 h-1 w-1 rounded-full"
                style={{
                  backgroundColor: data.query.data.records.some(
                    (record) => record.date === day && record.confirmed
                  )
                    ? color
                    : 'transparent',
                }}
              />
            )}
          </Button>
        ))}
      </View>
      {data.query.data && (
        <View className="rounded-xl border border-border-subtle bg-surface px-3 py-3">
          <Text className="text-sm text-text-primary">
            {formatDate(date, locale)} ·{' '}
            {t('dailyTraining.weekCounts', {
              defaultValue: '{{recorded}} recorded · {{planned}} scheduled',
              recorded: data.query.data.records.filter(
                (item) => item.date === date
              ).length,
              planned: data.query.data.occurrences.filter(
                (item) => item.date === date
              ).length,
            })}
          </Text>
        </View>
      )}
      {data.query.isLoading && (
        <StatusView
          loading
          title={t('common.loading', { defaultValue: 'Loading...' })}
        />
      )}
      {data.query.isError && (
        <StatusView
          title={t('weeklyPlan.loadFailed', {
            defaultValue: 'Could not load training plans. Try again.',
          })}
          action={{
            label: t('common.retry', { defaultValue: 'Retry' }),
            onPress: () => void data.query.refetch(),
          }}
        />
      )}
      {data.query.data &&
        Array.from({ length: 7 }, (_, index) =>
          addDays(range.start_date, index)
        ).map((day) => {
          const planned = data.query.data!.occurrences.filter(
            (item) => item.date === day
          );
          const records = data.query.data!.records.filter(
            (item) => item.date === day
          );
          const selected = day === date;
          return (
            <View
              key={day}
              className={`rounded-2xl border bg-surface px-3 ${selected ? 'border-accent-primary' : 'border-border-subtle'}`}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: selected }}
                onPress={() => onDateChange(day)}
                className={`flex-row items-center gap-2 ${expandedText ? 'min-h-12' : 'min-h-11'}`}
              >
                <Icon
                  name={
                    records[0] || planned[0]
                      ? plannedWorkoutIcon(
                          records[0]?.activity_type ??
                            planned[0]?.activity_type ??
                            'other'
                        )
                      : 'calendar'
                  }
                  size={20}
                  color={color}
                />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-text-primary">
                    {new Date(`${day}T12:00:00`).toLocaleDateString(locale, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {!expandedText && (
                      <Text className="text-xs font-normal text-text-secondary">
                        {' · '}
                        {t('dailyTraining.weekCounts', {
                          defaultValue:
                            '{{recorded}} recorded · {{planned}} scheduled',
                          recorded: records.length,
                          planned: planned.length,
                        })}
                      </Text>
                    )}
                  </Text>
                  {expandedText && (
                    <Text className="text-xs text-text-secondary">
                      {t('dailyTraining.weekCounts', {
                        defaultValue:
                          '{{recorded}} recorded · {{planned}} scheduled',
                        recorded: records.length,
                        planned: planned.length,
                      })}
                    </Text>
                  )}
                </View>
                <Icon
                  name={selected ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={color}
                />
              </Pressable>
              {selected && (
                <View className="pb-1">
                  {records.map((record) => (
                    <View
                      key={record.id}
                      className="border-t border-border-subtle"
                    >
                      <TrainingSessionRow
                        compact
                        inlineDetails
                        title={progressActivityLabel(
                          t,
                          record.label,
                          record.activity_type
                        )}
                        details={t('diary.timeline.recorded', {
                          defaultValue: 'Recorded',
                        })}
                        icon={plannedWorkoutIcon(record.activity_type)}
                        onPress={() => onOpenDay(day)}
                      />
                    </View>
                  ))}
                  {planned.map((item) => {
                    const prescription = data.query
                      .data!.workout_plans.flatMap((plan) => plan.assignments)
                      .find(
                        (assignment) => assignment.id === item.assignment_id
                      );
                    const state =
                      item.state === 'complete'
                        ? t('progress.state.complete', {
                            defaultValue: 'Complete',
                          })
                        : item.state === 'excluded'
                          ? t('progress.state.excluded', {
                              defaultValue: 'Skipped, not counted',
                            })
                          : t('dailyTraining.planned', {
                              defaultValue: 'Planned',
                            });
                    return (
                      <View
                        key={item.id}
                        className="border-t border-border-subtle"
                      >
                        <TrainingSessionRow
                          compact
                          title={progressActivityLabel(
                            t,
                            item.label,
                            item.activity_type
                          )}
                          clock={prescription?.plannedTime}
                          details={[
                            prescription?.plannedDurationMinutes != null
                              ? t('dailyTraining.duration', {
                                  defaultValue: '{{value}} min',
                                  value: formatLocalizedNumber(
                                    prescription.plannedDurationMinutes
                                  ),
                                })
                              : null,
                            state,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                          icon={plannedWorkoutIcon(item.activity_type)}
                          onPress={() =>
                            item.source === 'mobility'
                              ? onOpenDay(day)
                              : onOpenPlan(
                                  day,
                                  item.assignment_id == null
                                    ? undefined
                                    : String(item.assignment_id)
                                )
                          }
                        />
                      </View>
                    );
                  })}
                  {!records.length && !planned.length && (
                    <Text className="text-sm text-text-secondary">
                      {t('dailyTraining.noPlans', {
                        defaultValue: 'No training planned for this day.',
                      })}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
    </View>
  );
}
