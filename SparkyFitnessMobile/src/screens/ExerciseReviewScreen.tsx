import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  ExerciseReviewAdherencePeriod,
  ExerciseReviewBucket,
  ExerciseReviewSourceSession,
  ExerciseReviewTrendPoint,
} from '@workspace/shared';
import { useCSSVariable } from 'uniwind';
import Toast from 'react-native-toast-message';
import SegmentedControl from '../components/SegmentedControl';
import { addSheetRef } from '../components/AddSheet';
import Icon from '../components/Icon';
import StatusView from '../components/StatusView';
import { usePreferences, useServerConnection } from '../hooks';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { formatLocalizedNumber, getAppLocale } from '../localization';
import { fetchExerciseReview } from '../services/api/exerciseReviewApi';
import { fetchDailySummary } from '../services/api/dailySummaryApi';
import { formatShortDate, getTodayDate } from '../utils/dateUtils';
import { getSourceLabel } from '../utils/workoutSession';
import { getApiErrorMessage } from '../services/api/errors';
import type { RootStackScreenProps } from '../types/navigation';
import {
  exerciseReviewDates,
  type ExerciseReviewWindow,
} from '../utils/exerciseReviewPeriods';

function ReviewSection({
  title,
  bucket,
  previousSessions,
  facts,
  inferredLabel,
  previousLabel,
  sessionLabel,
}: {
  title: string;
  bucket: ExerciseReviewBucket;
  previousSessions: number;
  facts: string[];
  inferredLabel: string;
  previousLabel: string;
  sessionLabel: string;
}) {
  return (
    <View className="rounded-2xl bg-raised px-4 py-4 gap-2">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="text-lg font-semibold text-text-primary">{title}</Text>
        <Text className="text-base font-semibold text-text-primary">
          {sessionLabel}
        </Text>
      </View>
      {facts.length > 0 ? (
        <Text className="text-sm text-text-secondary">{facts.join(' · ')}</Text>
      ) : null}
      <Text className="text-xs text-text-secondary">
        {previousLabel}: {formatLocalizedNumber(previousSessions)}
      </Text>
      {bucket.inferredEntries > 0 ? (
        <Text className="text-xs text-text-muted">{inferredLabel}</Text>
      ) : null}
    </View>
  );
}

type TrendSport = 'running' | 'cycling' | 'strength';
type TrendMetric = 'sessions' | 'measure';

function ReviewTrend({
  points,
  window,
  distanceUnit,
  weightUnit,
}: {
  points: ExerciseReviewTrendPoint[];
  window: ExerciseReviewWindow;
  distanceUnit: 'km' | 'mi';
  weightUnit: 'kg' | 'lb';
}) {
  const { t } = useTranslation();
  const [sport, setSport] = useState<TrendSport>('running');
  const [metric, setMetric] = useState<TrendMetric>('sessions');
  const locale = getAppLocale();
  const metricLabel =
    metric === 'sessions'
      ? t('exerciseReview.trendSessions', { defaultValue: 'Sessions' })
      : sport === 'strength'
        ? t('exerciseReview.trendVolume', { defaultValue: 'Lifted volume' })
        : t('exerciseReview.trendDistance', { defaultValue: 'Distance' });
  const measureUnit = sport === 'strength' ? weightUnit : distanceUnit;
  const sportLabel =
    sport === 'running'
      ? t('exerciseReview.running', { defaultValue: 'Running' })
      : sport === 'cycling'
        ? t('exerciseReview.cycling', { defaultValue: 'Cycling' })
        : t('exerciseReview.strength', { defaultValue: 'Strength' });
  const values = points.map((point) => {
    const bucket = point[sport];
    if (metric === 'sessions') return bucket.sessions;
    if (sport === 'strength') {
      return bucket.liftedVolumeKg * (weightUnit === 'lb' ? 2.2046226218 : 1);
    }
    return bucket.distanceMeters / (distanceUnit === 'mi' ? 1609.344 : 1000);
  });
  const maxValue = Math.max(0, ...values);
  const formatValue = (value: number) =>
    formatLocalizedNumber(value, {
      maximumFractionDigits:
        metric === 'sessions' ? 0 : sport === 'strength' ? 0 : 1,
    });
  const pointLabel = (point: ExerciseReviewTrendPoint) => {
    if (window === 'year') {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        timeZone: 'UTC',
      }).format(new Date(`${point.startDate}T00:00:00Z`));
    }
    return formatShortDate(point.startDate, locale);
  };

  return (
    <View className="rounded-2xl bg-raised px-4 py-4 gap-3">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-text-primary">
          {t('exerciseReview.trendTitle', { defaultValue: 'Sport trends' })}
        </Text>
        <Text className="text-xs text-text-secondary">
          {t('exerciseReview.trendHint', {
            defaultValue: 'Recorded activity through the selected period.',
          })}
        </Text>
      </View>
      <SegmentedControl<TrendSport>
        segments={[
          {
            key: 'running',
            label: t('exerciseReview.running', { defaultValue: 'Running' }),
          },
          {
            key: 'cycling',
            label: t('exerciseReview.cycling', { defaultValue: 'Cycling' }),
          },
          {
            key: 'strength',
            label: t('exerciseReview.strength', { defaultValue: 'Strength' }),
          },
        ]}
        activeKey={sport}
        onSelect={(next) => {
          setSport(next);
          setMetric('sessions');
        }}
      />
      <SegmentedControl<TrendMetric>
        segments={[
          {
            key: 'sessions',
            label: t('exerciseReview.trendSessions', {
              defaultValue: 'Sessions',
            }),
          },
          {
            key: 'measure',
            label:
              sport === 'strength'
                ? t('exerciseReview.trendVolume', {
                    defaultValue: 'Lifted volume',
                  })
                : t('exerciseReview.trendDistance', {
                    defaultValue: 'Distance',
                  }),
          },
        ]}
        activeKey={metric}
        onSelect={setMetric}
      />
      {maxValue === 0 ? (
        <Text className="text-sm text-text-secondary py-4">
          {t('exerciseReview.trendEmpty', {
            defaultValue:
              'No {{metric}} recorded for {{sport}} in this period.',
            metric: metricLabel.toLowerCase(),
            sport: sportLabel.toLowerCase(),
          })}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 items-end py-2">
            {points.map((point, index) => {
              const value = values[index];
              const valueLabel = `${formatValue(value)}${metric === 'measure' ? ` ${measureUnit}` : ''}`;
              const dateLabel =
                point.startDate === point.endDate
                  ? formatShortDate(point.startDate, locale)
                  : `${formatShortDate(point.startDate, locale)} – ${formatShortDate(point.endDate, locale)}`;
              return (
                <View
                  key={point.startDate}
                  accessible
                  accessibilityLabel={t('exerciseReview.trendPoint', {
                    defaultValue: '{{date}}: {{metric}} {{value}}',
                    date: dateLabel,
                    metric: metricLabel,
                    value: valueLabel,
                  })}
                  className="w-14 items-center gap-1"
                >
                  <Text
                    className="text-xs text-text-secondary"
                    numberOfLines={1}
                  >
                    {formatValue(value)}
                  </Text>
                  <View className="h-24 w-8 justify-end rounded-md bg-progress-track overflow-hidden">
                    {value > 0 ? (
                      <View
                        className="w-full rounded-md bg-accent-primary"
                        style={{ height: Math.max(4, (value / maxValue) * 96) }}
                      />
                    ) : null}
                  </View>
                  <Text
                    className="text-xs text-text-secondary"
                    numberOfLines={1}
                  >
                    {pointLabel(point)}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const INITIAL_SOURCE_COUNT = 10;

function PlanAdherenceCard({
  current,
  previous,
}: {
  current: ExerciseReviewAdherencePeriod;
  previous: ExerciseReviewAdherencePeriod;
}) {
  const { t } = useTranslation();
  const hasHistory = current.coveredDays > 0;
  const hasSchedule = current.eligibleScheduledSessions > 0;
  return (
    <View className="rounded-2xl bg-raised px-4 py-5 gap-2">
      <Text className="text-base font-semibold text-text-primary">
        {t('exerciseReview.planAdherenceTitle', {
          defaultValue: 'Workout plan',
        })}
      </Text>
      <Text className="text-3xl font-bold text-text-primary">
        {hasSchedule
          ? t('exerciseReview.planAdherenceCount', {
              defaultValue: '{{done}} of {{planned}} attended',
              done: formatLocalizedNumber(current.attendedScheduledSessions),
              planned: formatLocalizedNumber(current.eligibleScheduledSessions),
            })
          : hasHistory
            ? t('exerciseReview.planNoScheduled', {
                defaultValue: 'No scheduled workouts',
              })
            : t('exerciseReview.planHistoryUnavailable', {
                defaultValue: 'Plan history unavailable',
              })}
      </Text>
      {hasSchedule ? (
        <Text className="text-sm text-text-secondary">
          {t('exerciseReview.planAdherenceRate', {
            defaultValue: '{{percent}}% of scheduled slots',
            percent: formatLocalizedNumber(current.adherencePercent ?? 0),
          })}
        </Text>
      ) : null}
      <Text className="text-xs text-text-secondary">
        {previous.coveredDays > 0
          ? t('exerciseReview.planPrevious', {
              defaultValue: 'Earlier: {{done}} of {{planned}} attended',
              done: formatLocalizedNumber(previous.attendedScheduledSessions),
              planned: formatLocalizedNumber(
                previous.eligibleScheduledSessions
              ),
            })
          : t('exerciseReview.planPreviousUnavailable', {
              defaultValue: 'Earlier: plan history unavailable',
            })}
      </Text>
      <Text className="text-xs text-text-muted">
        {t('exerciseReview.planDefinition', {
          defaultValue:
            'A scheduled workout counts as attended after at least one set is completed. Today is excluded.',
        })}
      </Text>
      {current.coveredDays < current.elapsedDays ? (
        <Text className="text-xs text-text-muted">
          {t('exerciseReview.planPartialHistory', {
            defaultValue:
              'Plan history is known for {{covered}} of {{elapsed}} elapsed days in this period.',
            covered: formatLocalizedNumber(current.coveredDays),
            elapsed: formatLocalizedNumber(current.elapsedDays),
          })}
        </Text>
      ) : null}
    </View>
  );
}

export default function ExerciseReviewScreen({
  navigation,
}: RootStackScreenProps<'ExerciseReview'>) {
  const { t } = useTranslation();
  const [window, setWindow] = useState<ExerciseReviewWindow>('day');
  const [periodsAgo, setPeriodsAgo] = useState(0);
  const [today, setToday] = useState(getTodayDate);
  const [visibleSourceCount, setVisibleSourceCount] =
    useState(INITIAL_SOURCE_COUNT);
  const [openingSourceId, setOpeningSourceId] = useState<string | null>(null);
  useFocusEffect(useCallback(() => setToday(getTodayDate()), []));
  const { isConnected, isLoading: connectionLoading } = useServerConnection();
  const { preferences } = usePreferences({ enabled: isConnected });
  const accentColor = useCSSVariable('--color-accent-primary') as string;
  const accentTextColor = useCSSVariable('--color-accent-text') as string;
  const distanceUnit =
    preferences?.default_distance_unit === 'miles' ? 'mi' : 'km';
  const weightUnit = preferences?.default_weight_unit === 'lbs' ? 'lb' : 'kg';
  const dates = exerciseReviewDates(today, window, periodsAgo);
  const query = useQuery({
    queryKey: [
      'exerciseReview',
      dates.startDate,
      dates.endDate,
      dates.previousStartDate,
      dates.previousEndDate,
    ],
    queryFn: () =>
      fetchExerciseReview(
        dates.startDate,
        dates.endDate,
        dates.previousStartDate,
        dates.previousEndDate
      ),
    enabled: isConnected,
    refetchOnMount: 'always',
  });
  const header = useScreenHeader({
    title: t('exerciseReview.title', { defaultValue: 'Exercise review' }),
    left: { kind: 'back' },
  });
  const formatRangeDay = (day: string) =>
    `${formatShortDate(day, getAppLocale())} ${day.slice(0, 4)}`;
  const periodLabel =
    window === 'day'
      ? formatRangeDay(dates.startDate)
      : `${formatRangeDay(dates.startDate)} – ${formatRangeDay(dates.endDate)}`;
  const previousPeriodLabel =
    window === 'day'
      ? formatRangeDay(dates.previousStartDate)
      : `${formatRangeDay(dates.previousStartDate)} – ${formatRangeDay(dates.previousEndDate)}`;
  const earlierLabel = t('exerciseReview.earlier', { defaultValue: 'Earlier' });
  const number = (value: number, fractionDigits = 0) =>
    formatLocalizedNumber(value, { maximumFractionDigits: fractionDigits });
  const sessions = (count: number) =>
    t('exerciseReview.sessions', {
      count,
      defaultValue: '{{count}} sessions',
      defaultValue_one: '{{count}} session',
      defaultValue_other: '{{count}} sessions',
    });
  const distance = (meters: number) =>
    `${number(meters / (distanceUnit === 'mi' ? 1609.344 : 1000), 1)} ${distanceUnit}`;
  const duration = (minutes: number) =>
    t('exerciseReview.minutes', {
      defaultValue: '{{value}} min',
      value: number(minutes),
    });
  const volume = (kg: number) =>
    `${number(kg * (weightUnit === 'lb' ? 2.2046226218 : 1), 0)} ${weightUnit}`;
  const inferred = (count: number) =>
    t('exerciseReview.inferred', {
      count,
      defaultValue: '{{count}} entries classified from their names',
      defaultValue_one: '{{count}} entry classified from its name',
      defaultValue_other: '{{count}} entries classified from their names',
    });
  const facts = (
    bucket: ExerciseReviewBucket,
    kind: 'endurance' | 'strength'
  ) => {
    const items: string[] = [];
    if (kind === 'endurance' && bucket.distanceMeters > 0) {
      items.push(distance(bucket.distanceMeters));
    }
    if (bucket.durationMinutes > 0)
      items.push(duration(bucket.durationMinutes));
    if (kind === 'strength' && bucket.liftedVolumeKg > 0) {
      items.push(
        t('exerciseReview.liftedVolume', {
          defaultValue: '{{value}} lifted',
          value: volume(bucket.liftedVolumeKg),
        })
      );
    }
    if (kind === 'strength' && bucket.reps > 0) {
      items.push(
        t('exerciseReview.reps', {
          defaultValue: '{{value}} reps',
          value: number(bucket.reps),
        })
      );
    }
    return items;
  };
  const current = query.data?.current;
  const previous = query.data?.previous;
  const sources = query.data?.sources ?? [];
  const trend = query.data?.trend ?? [];

  const openSource = async (source: ExerciseReviewSourceSession) => {
    if (openingSourceId != null) return;
    setOpeningSourceId(source.id);
    try {
      const day = await fetchDailySummary(source.entryDate);
      const session = day.exerciseSessions.find(
        (candidate) =>
          candidate.id === source.id && candidate.type === source.type
      );
      if (!session) {
        Toast.show({
          type: 'error',
          text1: t('exerciseReview.sourceUnavailable', {
            defaultValue:
              'This activity is no longer available. Refresh the review.',
          }),
        });
        void query.refetch();
        return;
      }
      if (session.type === 'preset') {
        navigation.navigate('WorkoutDetail', { session });
      } else {
        navigation.navigate('ActivityDetail', { session });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('exerciseReview.sourceOpenFailed', {
          defaultValue: 'Could not open that activity',
        }),
        text2: getApiErrorMessage(error) ?? undefined,
      });
    } finally {
      setOpeningSourceId(null);
    }
  };

  return (
    <View className="flex-1 bg-background">
      {header}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-10 gap-4"
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={accentColor}
          />
        }
      >
        <Text className="text-sm text-text-secondary">
          {t('exerciseReview.intro', {
            defaultValue:
              'A look at the activity you recorded, compared with the previous period.',
          })}
        </Text>
        <SegmentedControl<ExerciseReviewWindow>
          segments={[
            {
              key: 'day',
              label: t('exerciseReview.today', { defaultValue: 'Day' }),
            },
            {
              key: 'week',
              label: t('exerciseReview.week', { defaultValue: 'Week' }),
            },
            {
              key: 'month',
              label: t('exerciseReview.month', { defaultValue: 'Month' }),
            },
            {
              key: 'year',
              label: t('exerciseReview.year', { defaultValue: 'Year' }),
            },
          ]}
          activeKey={window}
          onSelect={(next) => {
            setWindow(next);
            setPeriodsAgo(0);
            setVisibleSourceCount(INITIAL_SOURCE_COUNT);
          }}
        />
        <View className="flex-row items-center justify-between gap-3">
          <TouchableOpacity
            onPress={() => {
              setPeriodsAgo((value) => value + 1);
              setVisibleSourceCount(INITIAL_SOURCE_COUNT);
            }}
            accessibilityRole="button"
            className="min-h-11 justify-center"
          >
            <Text className="text-sm font-medium text-text-link">
              {t('exerciseReview.earlier', { defaultValue: 'Earlier' })}
            </Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center text-sm font-medium text-text-primary">
            {periodLabel}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setPeriodsAgo((value) => Math.max(0, value - 1));
              setVisibleSourceCount(INITIAL_SOURCE_COUNT);
            }}
            disabled={periodsAgo === 0}
            accessibilityRole="button"
            accessibilityState={{ disabled: periodsAgo === 0 }}
            className="min-h-11 justify-center"
          >
            <Text
              className={
                periodsAgo === 0
                  ? 'text-sm text-text-muted'
                  : 'text-sm font-medium text-text-link'
              }
            >
              {t('exerciseReview.later', { defaultValue: 'Later' })}
            </Text>
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-text-secondary text-center">
          {t('exerciseReview.comparedWith', {
            defaultValue: 'Compared with {{range}}',
            range: previousPeriodLabel,
          })}
        </Text>
        <TouchableOpacity
          onPress={() =>
            addSheetRef.current?.present({ initialMenu: 'exercise' })
          }
          accessibilityRole="button"
          accessibilityLabel={t('exerciseReview.logExercise', {
            defaultValue: 'Log exercise',
          })}
          className="min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-accent-primary px-4"
        >
          <Icon name="add" size={19} color={accentTextColor} />
          <Text className="text-base font-semibold text-accent-text">
            {t('exerciseReview.logExercise', { defaultValue: 'Log exercise' })}
          </Text>
        </TouchableOpacity>
        {connectionLoading || (isConnected && query.isPending) ? (
          <StatusView
            loading
            title={t('exerciseReview.loading', {
              defaultValue: 'Loading your review…',
            })}
            inline
          />
        ) : !isConnected ? (
          <StatusView
            icon="cloud-offline"
            title={t('exerciseReview.offline', {
              defaultValue: 'Connect to view your review',
            })}
            inline
          />
        ) : query.isError ? (
          <StatusView
            icon="alert-circle"
            title={t('exerciseReview.failed', {
              defaultValue: 'Could not load your review',
            })}
            action={{
              label: t('common.retry', { defaultValue: 'Retry' }),
              onPress: () => void query.refetch(),
            }}
            inline
          />
        ) : current && previous ? (
          <>
            <View className="rounded-2xl bg-raised px-4 py-5 gap-2">
              <Text className="text-base font-semibold text-text-primary">
                {t('exerciseReview.overall', { defaultValue: 'All activity' })}
              </Text>
              <Text className="text-3xl font-bold text-text-primary">
                {sessions(current.overall.sessions)}
              </Text>
              <Text className="text-sm text-text-secondary">
                {t('exerciseReview.previousSessions', {
                  defaultValue: 'Earlier: {{value}}',
                  value: sessions(previous.overall.sessions),
                })}
                {current.overall.durationMinutes > 0
                  ? ` · ${duration(current.overall.durationMinutes)}`
                  : ''}
              </Text>
            </View>
            {query.data?.adherence ? (
              <PlanAdherenceCard
                current={query.data.adherence.current}
                previous={query.data.adherence.previous}
              />
            ) : null}
            {trend.length > 0 ? (
              <ReviewTrend
                points={trend}
                window={window}
                distanceUnit={distanceUnit}
                weightUnit={weightUnit}
              />
            ) : null}
            {current.overall.exerciseEntries === 0 ? (
              <StatusView
                icon="exercise"
                title={t('exerciseReview.empty', {
                  defaultValue: 'No activity recorded in this period',
                })}
                subtitle={t('exerciseReview.emptyHint', {
                  defaultValue: 'Try an earlier period or log an activity.',
                })}
                inline
              />
            ) : (
              <>
                <ReviewSection
                  title={t('exerciseReview.running', {
                    defaultValue: 'Running',
                  })}
                  bucket={current.running}
                  previousSessions={previous.running.sessions}
                  facts={facts(current.running, 'endurance')}
                  inferredLabel={inferred(current.running.inferredEntries)}
                  previousLabel={earlierLabel}
                  sessionLabel={sessions(current.running.sessions)}
                />
                <ReviewSection
                  title={t('exerciseReview.cycling', {
                    defaultValue: 'Cycling',
                  })}
                  bucket={current.cycling}
                  previousSessions={previous.cycling.sessions}
                  facts={facts(current.cycling, 'endurance')}
                  inferredLabel={inferred(current.cycling.inferredEntries)}
                  previousLabel={earlierLabel}
                  sessionLabel={sessions(current.cycling.sessions)}
                />
                <ReviewSection
                  title={t('exerciseReview.strength', {
                    defaultValue: 'Strength',
                  })}
                  bucket={current.strength}
                  previousSessions={previous.strength.sessions}
                  facts={facts(current.strength, 'strength')}
                  inferredLabel={inferred(current.strength.inferredEntries)}
                  previousLabel={earlierLabel}
                  sessionLabel={sessions(current.strength.sessions)}
                />
                {current.other.exerciseEntries > 0 ? (
                  <ReviewSection
                    title={t('exerciseReview.other', {
                      defaultValue: 'Other activity',
                    })}
                    bucket={current.other}
                    previousSessions={previous.other.sessions}
                    facts={facts(current.other, 'endurance')}
                    inferredLabel={inferred(current.other.inferredEntries)}
                    previousLabel={earlierLabel}
                    sessionLabel={sessions(current.other.sessions)}
                  />
                ) : null}
              </>
            )}
            {sources.length > 0 ? (
              <View className="rounded-2xl bg-raised px-4 py-4 gap-3">
                <View className="gap-1">
                  <Text className="text-lg font-semibold text-text-primary">
                    {t('exerciseReview.recordedSessions', {
                      defaultValue: 'Recorded sessions',
                    })}
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    {t('exerciseReview.openSourceHint', {
                      defaultValue:
                        'Open a session to see its recorded details and source.',
                    })}
                  </Text>
                </View>
                {sources.slice(0, visibleSourceCount).map((source) => {
                  const sourceName =
                    source.name ||
                    t('exerciseReview.unnamedSource', {
                      defaultValue: 'Activity',
                    });
                  return (
                    <TouchableOpacity
                      key={`${source.type}:${source.id}`}
                      onPress={() => void openSource(source)}
                      disabled={openingSourceId != null}
                      accessibilityRole="button"
                      accessibilityLabel={t('exerciseReview.openSource', {
                        defaultValue: 'Open {{name}} from {{date}}',
                        name: sourceName,
                        date: formatRangeDay(source.entryDate),
                      })}
                      className="min-h-12 border-t border-border-subtle pt-3"
                    >
                      <Text className="text-sm font-semibold text-text-primary">
                        {sourceName}
                      </Text>
                      <Text className="text-xs text-text-secondary mt-0.5">
                        {formatRangeDay(source.entryDate)}
                        {source.source
                          ? ` · ${getSourceLabel(source.source)}`
                          : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {visibleSourceCount < sources.length ? (
                  <TouchableOpacity
                    onPress={() => setVisibleSourceCount((count) => count + 20)}
                    accessibilityRole="button"
                    className="min-h-11 justify-center"
                  >
                    <Text className="text-sm font-medium text-text-link">
                      {t('exerciseReview.showMoreSources', {
                        defaultValue: 'Show more sessions',
                      })}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            <Text className="text-xs text-text-muted">
              {t('exerciseReview.recordedOnly', {
                defaultValue:
                  'Based on recorded entries. Missing distance, time, or sets are not estimated.',
              })}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
