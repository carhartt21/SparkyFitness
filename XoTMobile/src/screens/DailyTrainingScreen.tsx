import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import DailyDetailScreen from '../components/DailyDetailScreen';
import Button from '../components/ui/Button';
import Icon from '../components/Icon';
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
        {t('weeklyPlan.title', { defaultValue: 'Weekly training plan' })}
      </Button>
      {data.daily.summary &&
      !data.mobility.isLoading &&
      !data.mobility.isError ? (
        <View
          testID="daily-training-summary"
          className="mb-4 flex-row flex-wrap gap-5 rounded-2xl border border-border-subtle bg-surface p-4"
        >
          <Text className="text-2xl font-bold text-text-primary">
            {t('dailyTraining.sessionCount', {
              defaultValue: '{{count}} sessions',
              count: data.count,
            })}
          </Text>
          <Text className="text-2xl font-bold text-text-primary">
            {t('dailyTraining.duration', {
              defaultValue: '{{value}} min',
              value: formatLocalizedNumber(Math.round(data.minutes)),
            })}
          </Text>
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
      <View className="mb-3 flex-row flex-wrap gap-2">
        <Button onPress={() => navigation.navigate('WorkoutPresetsLibrary')}>
          {t('dailyTraining.start', { defaultValue: 'Start training' })}
        </Button>
        <Button
          variant="secondary"
          onPress={() => navigation.navigate('ActivityAdd', { date })}
        >
          {t('dailyTraining.log', { defaultValue: 'Log training' })}
        </Button>
        <Button
          variant="secondary"
          onPress={() => navigation.navigate('GuidedMobility')}
        >
          {t('dailyTraining.types.mobility', { defaultValue: 'Mobility' })}
        </Button>
      </View>
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
        return (
          <Pressable
            key={`${session.type}:${session.id}`}
            accessibilityRole="button"
            onPress={() =>
              session.type === 'preset'
                ? navigation.navigate('WorkoutDetail', { session })
                : navigation.navigate('ActivityDetail', { session })
            }
            className="mb-2 min-h-16 flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface p-4"
          >
            <Icon name={getWorkoutIcon(session)} size={24} color={color} />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-base font-bold text-text-primary">
                {summary.name}
              </Text>
              <Text className="text-sm text-text-secondary">
                {clock ??
                  t('hydrationDetails.noTime', {
                    defaultValue: 'Daily record · time unavailable',
                  })}{' '}
                · {formatDuration(summary.duration)}
              </Text>
              {summary.calories > 0 && (
                <Text className="text-sm text-text-secondary">
                  {formatLocalizedNumber(Math.round(summary.calories))}{' '}
                  {t('dashboard.kcal', { defaultValue: 'kcal' })}
                </Text>
              )}
              {session.type === 'individual' && session.distance != null && (
                <Text className="text-sm text-text-secondary">
                  {formatLocalizedNumber(
                    distanceFromKm(session.distance, data.distanceUnit),
                    { maximumFractionDigits: 2 }
                  )}{' '}
                  {data.distanceUnit === 'miles'
                    ? t('dailyTraining.mi', { defaultValue: 'mi' })
                    : t('dailyTraining.km', { defaultValue: 'km' })}
                </Text>
              )}
            </View>
            <Icon name="chevron-forward" size={18} color={color} />
          </Pressable>
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
          <Pressable
            key={item.id}
            accessibilityRole="button"
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
            className="mb-2 min-h-16 flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-surface p-4"
          >
            <Icon
              name={plannedWorkoutIcon(item.activity_type)}
              size={24}
              color={color}
            />
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-base font-semibold text-text-primary">
                {progressActivityLabel(t, item.label, item.activity_type)}
              </Text>
              <Text className="text-sm text-text-secondary">
                {prescription?.plannedTime
                  ? `${prescription.plannedTime} · `
                  : ''}
                {prescription?.plannedDurationMinutes != null
                  ? `${t('dailyTraining.duration', { defaultValue: '{{value}} min', value: formatLocalizedNumber(prescription.plannedDurationMinutes) })} · `
                  : ''}
                {t('dailyTraining.planned', { defaultValue: 'Planned' })}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color={color} />
          </Pressable>
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
        onPress={() => navigation.navigate('ExerciseReview', { date })}
      >
        {t('dailyTraining.review', { defaultValue: 'Review & history' })}
      </Button>
    </DailyDetailScreen>
  );
}
