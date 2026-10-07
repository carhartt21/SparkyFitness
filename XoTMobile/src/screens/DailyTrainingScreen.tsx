import { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import DailyDetailScreen from '../components/DailyDetailScreen';
import Button from '../components/ui/Button';
import Icon from '../components/Icon';
import DailyMetricTable from '../components/DailyMetricTable';
import TrainingSessionRow from '../components/TrainingSessionRow';
import StatusView from '../components/StatusView';
import MobilityDiarySection from '../components/MobilityDiarySection';
import { useServerConnection } from '../hooks';
import { useDailyTraining } from '../hooks/useDailyTraining';
import { formatLocalizedNumber } from '../localization';
import { distanceFromKm } from '../utils/unitConversions';
import { getTodayDate } from '../utils/dateUtils';
import {
  formatDuration,
  getWorkoutSummary,
  getWorkoutIcon,
  plannedWorkoutIcon,
} from '../utils/workoutSession';
import { workoutRecordedTime } from '../utils/workoutPresentation';
import { progressActivityLabel } from '../components/tracking/trackingLabels';
import type { RootStackScreenProps } from '../types/navigation';

export default function DailyTrainingScreen({
  navigation,
  route,
}: RootStackScreenProps<'DailyTraining'>) {
  const { t } = useTranslation();
  const expandedText = useWindowDimensions().fontScale > 1.3;
  const [date, setDate] = useState(route.params?.date ?? getTodayDate());
  const { isConnected } = useServerConnection();
  const data = useDailyTraining(date, isConnected);
  const color = useCSSVariable('--color-action-training') as string;
  return (
    <DailyDetailScreen
      title={t('dailyTraining.title', { defaultValue: 'Training' })}
      date={date}
      onDateChange={setDate}
      onRefresh={() =>
        Promise.all([
          data.daily.refetch(),
          data.mobility.refetch(),
          data.planning.query.refetch(),
        ])
      }
    >
      <Button
        testID="daily-training-weekly"
        variant="secondary"
        className="mb-4"
        onPress={() => navigation.navigate('WorkoutPlans', { date })}
      >
        <View className="w-full flex-row items-center gap-2">
          <Icon name="calendar" size={20} color={color} />
          <Text className="min-w-0 flex-1 text-base font-semibold text-text-primary">
            {t('dailyTraining.weekPlan', { defaultValue: 'Weekly plan' })}
          </Text>
          <Icon name="chevron-forward" size={18} color={color} />
        </View>
      </Button>
      {data.daily.summary &&
      !data.mobility.isLoading &&
      !data.mobility.isError ? (
        <View
          testID="daily-training-summary"
          className="mb-3 rounded-2xl border border-border-subtle bg-surface p-4"
        >
          <DailyMetricTable
            large
            metrics={[
              {
                key: 'sessions',
                icon: 'exercise-default',
                color,
                value: formatLocalizedNumber(data.count),
                label: t('dailyTraining.sessionsLabel', {
                  defaultValue: 'Sessions',
                }),
              },
              {
                key: 'duration',
                icon: 'timer',
                color,
                value: formatLocalizedNumber(Math.round(data.minutes)),
                label: t('dailyTraining.minutesLabel', {
                  defaultValue: 'Minutes recorded',
                }),
              },
            ]}
          />
        </View>
      ) : (
        <StatusView
          loading={data.daily.isLoading || data.mobility.isLoading}
          title={t('dailyTraining.unavailable', {
            defaultValue: 'Training summary unavailable',
          })}
          action={{
            label: t('common.retry', { defaultValue: 'Retry' }),
            onPress: () => {
              void data.daily.refetch();
              void data.mobility.refetch();
            },
          }}
        />
      )}
      <View className={`mb-3 gap-2 ${expandedText ? 'flex-col' : 'flex-row'}`}>
        <Button
          className={expandedText ? 'w-full' : 'flex-1'}
          icon="play"
          accessibilityLabel={t('dailyTraining.start', {
            defaultValue: 'Start training',
          })}
          onPress={() => navigation.navigate('WorkoutPresetsLibrary')}
        >
          {t('dailyTraining.startAction', { defaultValue: 'Start' })}
        </Button>
        <Button
          className={expandedText ? 'w-full' : 'flex-1'}
          variant="secondary"
          icon="add"
          accessibilityLabel={t('dailyTraining.log', {
            defaultValue: 'Log training',
          })}
          onPress={() => navigation.navigate('ActivityAdd', { date })}
        >
          {t('dailyTraining.logAction', { defaultValue: 'Record' })}
        </Button>
      </View>
      <Button
        variant="secondary"
        className="mb-3"
        onPress={() => navigation.navigate('GuidedMobility')}
      >
        <View className="w-full flex-row items-center gap-2">
          <Icon name="exercise-yoga" size={22} color={color} />
          <Text className="min-w-0 flex-1 text-base font-semibold text-text-primary">
            {t('dailyTraining.types.mobility', { defaultValue: 'Mobility' })}
          </Text>
          <Icon name="chevron-forward" size={18} color={color} />
        </View>
      </Button>
      <Text
        accessibilityRole="header"
        className="mt-3 mb-2 text-lg font-bold text-text-primary"
      >
        {t('diary.timeline.recorded', { defaultValue: 'Recorded' })}
      </Text>
      {data.sessions.length === 0 &&
        !data.mobility.sessions.length &&
        !data.mobility.isLoading &&
        !data.mobility.isError &&
        data.daily.summary && (
          <Text className="mb-4 text-sm text-text-secondary">
            {t('trainingHub.noRecorded', {
              defaultValue: 'No training recorded for this day.',
            })}
          </Text>
        )}
      {data.sessions.map((session) => {
        const summary = getWorkoutSummary(session, t);
        const clock = workoutRecordedTime(session, data.timezone);
        const metadata = [
          formatDuration(summary.duration),
          session.type === 'individual' && session.distance != null
            ? `${formatLocalizedNumber(distanceFromKm(session.distance, data.distanceUnit), { maximumFractionDigits: 2 })} ${data.distanceUnit === 'miles' ? t('dailyTraining.mi', { defaultValue: 'mi' }) : t('dailyTraining.km', { defaultValue: 'km' })}`
            : null,
          summary.calories > 0
            ? `${formatLocalizedNumber(Math.round(summary.calories))} ${t('dashboard.kcal', { defaultValue: 'kcal' })}`
            : t('dailyTraining.energyUnknown', {
                defaultValue: 'Energy not recorded',
              }),
          !clock
            ? t('hydrationDetails.noTime', {
                defaultValue: 'Daily record · time unavailable',
              })
            : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <View
            key={`${session.type}:${session.id}`}
            className="mb-2 rounded-2xl border border-border-subtle bg-surface px-3"
          >
            <TrainingSessionRow
              title={summary.name}
              details={metadata}
              clock={clock}
              icon={getWorkoutIcon(session)}
              onPress={() =>
                session.type === 'preset'
                  ? navigation.navigate('WorkoutDetail', { session })
                  : navigation.navigate('ActivityDetail', { session })
              }
            />
          </View>
        );
      })}
      <MobilityDiarySection
        sessions={data.mobility.sessions}
        timezone={data.timezone}
        failed={data.mobility.isError}
        onRetry={() => void data.mobility.refetch()}
        onPress={() => navigation.navigate('GuidedMobility')}
      />
      <Text
        accessibilityRole="header"
        className="mt-5 mb-2 text-lg font-bold text-text-primary"
      >
        {t('dailyTraining.planned', { defaultValue: 'Planned' })}
      </Text>
      {data.planned.map((item) => {
        const prescription = data.planning.query.data?.workout_plans
          .flatMap((plan) => plan.assignments)
          .find((assignment) => assignment.id === item.assignment_id);
        return (
          <View
            key={item.id}
            className="mb-2 rounded-2xl border border-border-subtle bg-surface px-3"
          >
            <TrainingSessionRow
              title={progressActivityLabel(t, item.label, item.activity_type)}
              clock={prescription?.plannedTime}
              icon={plannedWorkoutIcon(item.activity_type)}
              details={[
                prescription?.plannedDurationMinutes != null
                  ? t('dailyTraining.duration', {
                      defaultValue: '{{value}} min',
                      value: formatLocalizedNumber(
                        prescription.plannedDurationMinutes
                      ),
                    })
                  : null,
                t('dailyTraining.planned', { defaultValue: 'Planned' }),
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() =>
                item.source === 'mobility'
                  ? navigation.navigate('GuidedMobility')
                  : navigation.navigate('WorkoutPlans', {
                      date,
                      assignmentId:
                        item.assignment_id == null
                          ? undefined
                          : String(item.assignment_id),
                    })
              }
            />
          </View>
        );
      })}
      {!data.planned.length && data.planning.query.isSuccess && (
        <Text className="mb-4 text-sm text-text-secondary">
          {t('dailyTraining.noPlans', {
            defaultValue: 'No training planned for this day.',
          })}
        </Text>
      )}
      {(data.daily.isError ||
        data.planning.query.isError ||
        data.mobility.isError) && (
        <StatusView
          title={t('dailyTraining.partial', {
            defaultValue: 'Some training data could not be refreshed.',
          })}
          action={{
            label: t('common.retry', { defaultValue: 'Retry' }),
            onPress: () => {
              void data.daily.refetch();
              void data.planning.query.refetch();
              void data.mobility.refetch();
            },
          }}
        />
      )}
      <Button
        className="mt-4"
        variant="secondary"
        icon="history"
        onPress={() => navigation.navigate('ExerciseReview', { date })}
      >
        {t('dailyTraining.review', { defaultValue: 'Review & history' })}
      </Button>
    </DailyDetailScreen>
  );
}
