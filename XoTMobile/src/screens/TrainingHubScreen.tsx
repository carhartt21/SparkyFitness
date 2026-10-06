import { ScrollView, View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { activityWeekRange } from '@workspace/shared';
import type { RootStackScreenProps } from '../types/navigation';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import { useActivityPlanning } from '../hooks/useActivityPlanning';
import { useDailySummary, useServerConnection } from '../hooks';
import { useDiaryDateStore } from '../stores/diaryDateStore';
import { useActiveWorkoutBarPadding } from '../components/ActiveWorkoutBar';
import Icon, { type IconName } from '../components/Icon';
import StatusView from '../components/StatusView';
import GlowCard from '../components/ui/GlowCard';
import { formatDate } from '../utils/dateUtils';
import { formatDuration, getWorkoutSummary } from '../utils/workoutSession';
import { useAppLocale } from '../localization';

export default function TrainingHubScreen({
  navigation,
  route,
}: RootStackScreenProps<'TrainingHub'>) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const insets = useSafeAreaInsets();
  const native = useNativeIOSHeadersActive();
  const barPadding = useActiveWorkoutBarPadding();
  const selectedDate = useDiaryDateStore((s) => s.selectedDate);
  const date = route.params?.date ?? selectedDate;
  const { isConnected } = useServerConnection();
  const week = activityWeekRange(date);
  const planning = useActivityPlanning(
    week.start_date,
    week.end_date,
    isConnected
  );
  const daily = useDailySummary({ date, enabled: isConnected });
  const [accent, glow] = useCSSVariable([
    '--color-accent-primary',
    '--color-card-glow',
  ]) as string[];
  const header = useScreenHeader({
    title: t('trainingHub.title', { defaultValue: 'Training & routines' }),
    left: { kind: 'back' },
  });
  const destinations: { icon: IconName; label: string; press: () => void }[] = [
    {
      icon: 'calendar',
      label: t('weeklyPlan.title', { defaultValue: 'Weekly training plan' }),
      press: () => navigation.navigate('WorkoutPlans', { date }),
    },
    {
      icon: 'bookmark',
      label: t('screens.workoutPresets', { defaultValue: 'Workout Presets' }),
      press: () => navigation.navigate('WorkoutPresetsLibrary'),
    },
    {
      icon: 'exercise-yoga',
      label: t('mobility.title', { defaultValue: 'Guided mobility' }),
      press: () => navigation.navigate('GuidedMobility'),
    },
    {
      icon: 'history',
      label: t('trainingHub.history', { defaultValue: 'Recorded training' }),
      press: () => navigation.navigate('ExerciseReview', { date }),
    },
  ];
  return (
    <View
      className="flex-1 bg-background"
      style={native ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + barPadding + 24,
        }}
      >
        <View className="mb-5 rounded-2xl border border-border-subtle bg-surface px-3">
          {destinations.map((d, i) => (
            <Pressable
              key={d.label}
              accessibilityRole="button"
              onPress={d.press}
              className={`min-h-14 flex-row items-center gap-3 py-3 ${i ? 'border-t border-border-subtle' : ''}`}
            >
              <Icon name={d.icon} size={22} color={accent} />
              <Text className="min-w-0 flex-1 text-base text-text-primary">
                {d.label}
              </Text>
              <Icon name="chevron-forward" size={16} color={accent} />
            </Pressable>
          ))}
        </View>
        <GlowCard glowColor={glow} className="mb-4 p-4">
          <Text
            accessibilityRole="header"
            className="mb-3 text-lg font-semibold text-text-primary"
          >
            {t('trainingHub.thisWeek', { defaultValue: 'This week' })}
          </Text>
          {!isConnected && !planning.query.data ? (
            <Text className="text-sm text-text-secondary">
              {t('activityPlanning.offline', {
                defaultValue: 'Connect to the server to review activities.',
              })}
            </Text>
          ) : planning.query.isError ? (
            <StatusView
              icon="alert-circle"
              title={t('common.error', { defaultValue: 'Error' })}
              action={{
                label: t('common.retry', { defaultValue: 'Retry' }),
                onPress: () => planning.query.refetch(),
              }}
            />
          ) : planning.query.isLoading ? (
            <StatusView
              loading
              title={t('common.loading', { defaultValue: 'Loading...' })}
            />
          ) : !planning.query.data?.occurrences.length ? (
            <Text className="text-sm text-text-secondary">
              {t('trainingHub.noPlans', {
                defaultValue: 'No training planned for this week.',
              })}
            </Text>
          ) : (
            planning.query.data.occurrences.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() =>
                  item.source === 'mobility'
                    ? navigation.navigate('GuidedMobility')
                    : navigation.navigate('WorkoutPlans', {
                        date: item.date,
                        assignmentId:
                          item.assignment_id == null
                            ? undefined
                            : String(item.assignment_id),
                      })
                }
                className="min-h-14 flex-row items-center gap-3 border-t border-border-subtle py-3"
              >
                <Icon
                  name={
                    item.source === 'mobility'
                      ? 'exercise-yoga'
                      : 'exercise-running'
                  }
                  size={20}
                  color={accent}
                />
                <View className="min-w-0 flex-1">
                  <Text className="text-base text-text-primary">
                    {item.label}
                  </Text>
                  <Text className="text-sm text-text-secondary">
                    {formatDate(item.date, locale)} ·{' '}
                    {item.state === 'complete'
                      ? t('progress.state.complete', {
                          defaultValue: 'Complete',
                        })
                      : item.state === 'started'
                        ? t('progress.state.started', {
                            defaultValue: 'Started',
                          })
                        : item.state === 'excluded'
                          ? t('progress.state.excluded', {
                              defaultValue: 'Skipped, not counted',
                            })
                          : t('diary.timeline.plannedSection', {
                              defaultValue: 'Planned',
                            })}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={16} color={accent} />
              </Pressable>
            ))
          )}
        </GlowCard>
        <Text
          accessibilityRole="header"
          className="mb-3 text-lg font-semibold text-text-primary"
        >
          {formatDate(date, locale)}
        </Text>
        {!isConnected && !daily.summary ? (
          <Text className="text-sm text-text-secondary">
            {t('activityPlanning.offline', {
              defaultValue: 'Connect to the server to review activities.',
            })}
          </Text>
        ) : daily.isError ? (
          <StatusView
            icon="alert-circle"
            title={t('common.error', { defaultValue: 'Error' })}
            action={{
              label: t('common.retry', { defaultValue: 'Retry' }),
              onPress: () => daily.refetch(),
            }}
          />
        ) : daily.isLoading ? (
          <StatusView
            loading
            title={t('common.loading', { defaultValue: 'Loading...' })}
          />
        ) : !daily.summary?.exerciseEntries.length ? (
          <Text className="text-sm text-text-secondary">
            {t('trainingHub.noRecorded', {
              defaultValue: 'No training recorded for this day.',
            })}
          </Text>
        ) : (
          daily.summary.exerciseEntries.map((session) => (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              onPress={() =>
                session.type === 'preset'
                  ? navigation.navigate('WorkoutDetail', { session })
                  : navigation.navigate('ActivityDetail', { session })
              }
              className="min-h-14 flex-row items-center gap-3 border-b border-border-subtle py-3"
            >
              <Icon name="exercise-running" size={20} color={accent} />
              <View className="min-w-0 flex-1">
                <Text className="text-base text-text-primary">
                  {getWorkoutSummary(session, t).name}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {formatDuration(getWorkoutSummary(session, t).duration)}
                </Text>
              </View>
              <Icon name="chevron-forward" size={16} color={accent} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
