import { Pressable, Text, View } from 'react-native';
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
  const locale = useAppLocale();
  const range = activityWeekRange(date);
  const data = useActivityPlanning(range.start_date, range.end_date, enabled);
  const color = useCSSVariable('--color-action-training') as string;
  return (
    <View testID="weekly-training-itinerary" className="mb-6 gap-3">
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="secondary"
          onPress={() => onDateChange(addDays(date, -7))}
        >
          {t('activityPlanning.previous', { defaultValue: 'Previous week' })}
        </Button>
        <Button
          variant="secondary"
          onPress={() => onDateChange(addDays(date, 7))}
        >
          {t('activityPlanning.next', { defaultValue: 'Next week' })}
        </Button>
      </View>
      <View className="flex-row gap-1">
        {Array.from({ length: 7 }, (_, index) =>
          addDays(range.start_date, index)
        ).map((day) => (
          <Pressable
            key={day}
            testID={`weekly-day-${day}`}
            accessibilityRole="button"
            accessibilityLabel={formatDate(day, locale)}
            accessibilityState={{ selected: date === day }}
            onPress={() => onDateChange(day)}
            className={`min-h-16 flex-1 items-center justify-center rounded-xl border ${date === day ? 'border-accent-primary bg-raised' : 'border-border-subtle bg-surface'}`}
          >
            <Text className="text-xs text-text-secondary">
              {new Date(`${day}T12:00:00`).toLocaleDateString(locale, {
                weekday: 'short',
              })}
            </Text>
            <Text className="text-base font-bold text-text-primary">
              {new Date(`${day}T12:00:00`).getDate()}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text className="text-base font-semibold text-text-primary">
        {formatDate(range.start_date, locale)} –{' '}
        {formatDate(range.end_date, locale)}
      </Text>
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
                className="min-h-12 flex-row items-center gap-2"
              >
                <Icon name="calendar" size={18} color={color} />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-text-primary">
                    {formatDate(day, locale)}
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    {t('dailyTraining.weekCounts', {
                      defaultValue:
                        '{{recorded}} recorded · {{planned}} scheduled',
                      recorded: records.length,
                      planned: planned.length,
                    })}
                  </Text>
                </View>
                <Icon
                  name={selected ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={color}
                />
              </Pressable>
              {selected && (
                <View className="pb-3 gap-2">
                  {records.map((record) => (
                    <Pressable
                      key={record.id}
                      accessibilityRole="button"
                      onPress={() => onOpenDay(day)}
                      className="min-h-11 flex-row items-center gap-2 border-t border-border-subtle py-2"
                    >
                      <Icon
                        name={plannedWorkoutIcon(record.activity_type)}
                        size={18}
                        color={color}
                      />
                      <View className="flex-1">
                        <Text className="text-base text-text-primary">
                          {progressActivityLabel(
                            t,
                            record.label,
                            record.activity_type
                          )}
                        </Text>
                        <Text className="text-xs text-text-secondary">
                          {t('diary.timeline.recorded', {
                            defaultValue: 'Recorded',
                          })}
                        </Text>
                      </View>
                      <Icon name="chevron-forward" size={16} color={color} />
                    </Pressable>
                  ))}
                  {planned.map((item) => {
                    const prescription = data.query
                      .data!.workout_plans.flatMap((plan) => plan.assignments)
                      .find(
                        (assignment) => assignment.id === item.assignment_id
                      );
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
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
                        className="min-h-11 flex-row items-center gap-2 border-t border-border-subtle py-2"
                      >
                        <Icon
                          name={plannedWorkoutIcon(item.activity_type)}
                          size={18}
                          color={color}
                        />
                        <View className="flex-1">
                          <Text className="text-base text-text-primary">
                            {progressActivityLabel(
                              t,
                              item.label,
                              item.activity_type
                            )}
                          </Text>
                          <Text className="text-xs text-text-secondary">
                            {prescription?.plannedTime
                              ? `${prescription.plannedTime} · `
                              : ''}
                            {prescription?.plannedDurationMinutes != null
                              ? `${t('dailyTraining.duration', { defaultValue: '{{value}} min', value: formatLocalizedNumber(prescription.plannedDurationMinutes) })} · `
                              : ''}
                            {item.state === 'complete'
                              ? t('progress.state.complete', {
                                  defaultValue: 'Complete',
                                })
                              : item.state === 'excluded'
                                ? t('progress.state.excluded', {
                                    defaultValue: 'Skipped, not counted',
                                  })
                                : t('dailyTraining.planned', {
                                    defaultValue: 'Planned',
                                  })}
                          </Text>
                        </View>
                        <Icon name="chevron-forward" size={16} color={color} />
                      </Pressable>
                    );
                  })}
                  {!records.length && !planned.length && (
                    <Text className="text-sm text-text-secondary">
                      {t('dailyTraining.noPlans', {
                        defaultValue: 'No training planned for this day.',
                      })}
                    </Text>
                  )}
                  <Button variant="secondary" onPress={() => onOpenDay(day)}>
                    {t('dailyTraining.dayDetails', {
                      defaultValue: 'Daily details',
                    })}
                  </Button>
                </View>
              )}
            </View>
          );
        })}
    </View>
  );
}
