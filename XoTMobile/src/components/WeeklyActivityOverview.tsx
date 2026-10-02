import { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  activityWeekRange,
  addDays,
  linkableActivityRecords,
  type ActivityResolutionRequest,
} from '@workspace/shared';
import { useActivityPlanning } from '../hooks/useActivityPlanning';
import Button from './ui/Button';
import { formatDate } from '../utils/dateUtils';
import { useAppLocale } from '../localization';

export default function WeeklyActivityOverview({
  date,
  enabled,
  onOpen,
}: {
  date: string;
  enabled: boolean;
  onOpen: (source: 'workout' | 'mobility', day: string) => void;
}) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const sports = {
    running: t('activityPlanning.sport.running', { defaultValue: 'Running' }),
    walking: t('activityPlanning.sport.walking', { defaultValue: 'Walking' }),
    cycling: t('activityPlanning.sport.cycling', { defaultValue: 'Cycling' }),
    strength: t('activityPlanning.sport.strength', {
      defaultValue: 'Strength training',
    }),
    soccer: t('activityPlanning.sport.soccer', { defaultValue: 'Soccer' }),
    mobility: t('activityPlanning.sport.mobility', {
      defaultValue: 'Mobility',
    }),
    stretching: t('activityPlanning.sport.stretching', {
      defaultValue: 'Stretching',
    }),
    swimming: t('activityPlanning.sport.swimming', {
      defaultValue: 'Swimming',
    }),
    hiking: t('activityPlanning.sport.hiking', { defaultValue: 'Hiking' }),
    rowing: t('activityPlanning.sport.rowing', { defaultValue: 'Rowing' }),
    fitness_equipment: t('activityPlanning.sport.fitness_equipment', {
      defaultValue: 'Fitness equipment',
    }),
    other: t('activityPlanning.sport.other', {
      defaultValue: 'Other activity',
    }),
  };
  const states = {
    complete: t('activityPlanning.state.complete', {
      defaultValue: 'Complete',
    }),
    started: t('activityPlanning.state.started', {
      defaultValue: 'Partly confirmed',
    }),
    pending: t('activityPlanning.state.pending', {
      defaultValue: 'Not recorded yet',
    }),
    excluded: t('activityPlanning.state.excluded', {
      defaultValue: 'Skipped, not counted',
    }),
  };
  const [anchor, setAnchor] = useState(date);
  const [linking, setLinking] = useState<string | null>(null);
  const [failure, setFailure] = useState(false);
  const range = activityWeekRange(anchor);
  const { query, mutation } = useActivityPlanning(
    range.start_date,
    range.end_date,
    enabled
  );
  const decide = async (operation: ActivityResolutionRequest) => {
    setFailure(false);
    try {
      await mutation.mutateAsync(operation);
      setLinking(null);
    } catch {
      setFailure(true);
    }
  };
  const disabled = !enabled || mutation.isPending || query.isFetching;
  return (
    <View testID="weekly-activity-overview" className="mt-6 gap-3">
      <Text
        accessibilityRole="header"
        className="text-xl font-semibold text-text-primary"
      >
        {t('activityPlanning.title', { defaultValue: 'Weekly activities' })}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="outline"
          onPress={() => setAnchor(addDays(anchor, -7))}
        >
          {t('activityPlanning.previous', { defaultValue: 'Previous week' })}
        </Button>
        <Button variant="ghost" onPress={() => setAnchor(date)}>
          {t('activityPlanning.thisWeek', { defaultValue: 'Selected week' })}
        </Button>
        <Button variant="outline" onPress={() => setAnchor(addDays(anchor, 7))}>
          {t('activityPlanning.next', { defaultValue: 'Next week' })}
        </Button>
      </View>
      <Text className="text-sm text-text-secondary">
        {formatDate(range.start_date, locale)} –{' '}
        {formatDate(range.end_date, locale)}
      </Text>
      <Text className="text-sm text-text-secondary">
        {t('activityPlanning.explanation', {
          defaultValue:
            'Scheduled activities count toward Daily Progress when confirmed. Skipped activities are left out. Unsynced workouts are not shown.',
        })}
      </Text>
      {!enabled && (
        <Text accessibilityRole="alert" className="text-sm text-text-secondary">
          {t('activityPlanning.offline', {
            defaultValue: 'Connect to the server to review activities.',
          })}
        </Text>
      )}
      {enabled && query.isPending && (
        <Text accessibilityLiveRegion="polite" className="text-text-secondary">
          {t('activityPlanning.loading', {
            defaultValue: 'Loading activities…',
          })}
        </Text>
      )}
      {query.isError && (
        <View>
          <Text accessibilityRole="alert" className="text-text-primary">
            {t('activityPlanning.loadError', {
              defaultValue: 'Activities could not be loaded. Try again.',
            })}
          </Text>
          <Button variant="outline" onPress={() => void query.refetch()}>
            {t('activityPlanning.retry', { defaultValue: 'Try again' })}
          </Button>
        </View>
      )}
      {failure && (
        <Text accessibilityRole="alert" className="text-text-primary">
          {t('activityPlanning.saveError', {
            defaultValue:
              'The decision was not saved. Refresh and try again; the activity or account may have changed.',
          })}
        </Text>
      )}
      {query.data && !query.isError && (
        <>
          <View className="gap-1">
            {query.data.summary.map((row) => (
              <Text
                key={row.activity_type}
                className="text-sm text-text-primary"
              >
                {sports[row.activity_type]} ·{' '}
                {t('activityPlanning.count', {
                  defaultValue: '{{completed}} of {{scheduled}} complete',
                  completed: row.completed,
                  scheduled: row.scheduled - row.excluded - row.unknown,
                })}
              </Text>
            ))}
          </View>
          {query.data.occurrences.length === 0 && (
            <Text className="text-text-secondary">
              {t('activityPlanning.empty', {
                defaultValue:
                  'No activities scheduled this week. Add a Workout Plan or Mobility schedule.',
              })}
            </Text>
          )}
          {query.data.occurrences.map((row) => {
            const records = linkableActivityRecords(row, query.data.records);
            return (
              <View
                key={row.id}
                className="border-t border-border-subtle py-4 gap-2"
              >
                <Text className="text-sm text-text-secondary">
                  {formatDate(row.date, locale)} · {sports[row.activity_type]}
                </Text>
                <Text className="font-semibold text-text-primary">
                  {row.label}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {row.plan_label} · {states[row.state]}
                </Text>
                {row.reason === 'prescription_unknown' && (
                  <Text className="text-sm text-text-secondary">
                    {t('activityPlanning.unknownHint', {
                      defaultValue:
                        'This older prescription is unknown and is not counted in completion totals.',
                    })}
                  </Text>
                )}
                {row.reason === 'linked_record_missing' && (
                  <Text className="text-sm text-text-secondary">
                    {t('activityPlanning.missingHint', {
                      defaultValue:
                        'The linked session is no longer available. Undo the decision and choose a saved session on this date.',
                    })}
                  </Text>
                )}
                {row.completed_sets > 0 && (
                  <Text className="text-sm text-text-secondary">
                    {t('activityPlanning.sets', {
                      defaultValue:
                        '{{completed}} / {{expected}} sets confirmed',
                      completed: row.completed_sets,
                      expected:
                        row.expected_sets === null
                          ? t('activityPlanning.unknown', {
                              defaultValue: 'unknown',
                            })
                          : row.expected_sets,
                    })}
                  </Text>
                )}
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onPress={() => onOpen(row.source, row.date)}
                  >
                    {row.source === 'mobility'
                      ? t('activityPlanning.openMobility', {
                          defaultValue: 'Open Mobility',
                        })
                      : t('activityPlanning.openDiary', {
                          defaultValue: 'Open Diary',
                        })}
                  </Button>
                  {row.source === 'workout' && (
                    <>
                      {row.revision > 0 && (
                        <Button
                          variant="ghost"
                          disabled={disabled}
                          onPress={() =>
                            void decide({
                              occurrence_id: row.id,
                              expected_revision: row.revision,
                              action: 'undo',
                            })
                          }
                        >
                          {t('activityPlanning.undo', {
                            defaultValue: 'Undo decision',
                          })}
                        </Button>
                      )}
                      {row.state !== 'complete' && row.state !== 'excluded' && (
                        <Button
                          variant="ghost"
                          disabled={disabled}
                          onPress={() =>
                            void decide({
                              occurrence_id: row.id,
                              expected_revision: row.revision,
                              action: 'skip',
                            })
                          }
                        >
                          {t('activityPlanning.skip', {
                            defaultValue: 'Skip activity',
                          })}
                        </Button>
                      )}
                      {row.state !== 'complete' &&
                        row.state !== 'excluded' &&
                        records.length > 0 && (
                          <Button
                            variant="outline"
                            disabled={disabled}
                            onPress={() =>
                              setLinking(linking === row.id ? null : row.id)
                            }
                          >
                            {t('activityPlanning.chooseRecord', {
                              defaultValue: 'Choose a recorded session',
                            })}
                          </Button>
                        )}
                    </>
                  )}
                </View>
                {linking === row.id &&
                  row.state !== 'complete' &&
                  row.state !== 'excluded' && (
                    <View className="gap-2">
                      <Text className="text-sm text-text-secondary">
                        {t('activityPlanning.recordedActivity', {
                          defaultValue: 'Recorded activity on this date',
                        })}
                      </Text>
                      {records.map((record) => (
                        <Button
                          key={record.id}
                          variant="outline"
                          disabled={disabled}
                          accessibilityLabel={t('activityPlanning.linkNamed', {
                            defaultValue: 'Link {{name}}',
                            name: record.label,
                          })}
                          onPress={() =>
                            void decide({
                              occurrence_id: row.id,
                              expected_revision: row.revision,
                              action: 'link',
                              record_id: record.id,
                            })
                          }
                        >
                          {record.label}
                        </Button>
                      ))}
                    </View>
                  )}
              </View>
            );
          })}
          {query.data.workout_plans.some(
            (plan) => plan.is_active && plan.schedule_type === 'sequential'
          ) && (
            <Text className="text-sm text-text-secondary">
              {t('activityPlanning.sequential', {
                defaultValue:
                  'Sequential plans keep their existing next-session workflow and are not counted as dated weekly tasks.',
              })}
            </Text>
          )}
        </>
      )}
    </View>
  );
}
