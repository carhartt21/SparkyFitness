import { plannedActivityLabel } from '../components/tracking/trackingLabels';
import { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { weekdayOfDay } from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import NeonButton from '../components/ui/NeonButton';
import GlowCard from '../components/ui/GlowCard';
import StatusView from '../components/StatusView';
import { useWorkoutPlans } from '../hooks/useWorkoutPlans';
import { useServerConnection } from '../hooks';
import { useStartWorkoutPlanAssignment } from '../hooks/useStartWorkoutPlanAssignment';
import { getTodayDate } from '../utils/dateUtils';
import { formatLocalizedNumber } from '../localization';
import type { RootStackScreenProps } from '../types/navigation';
import type {
  WorkoutPlanAssignment,
  WorkoutPlanTemplate,
} from '../types/workoutPlans';

export default function WorkoutPlansScreen({
  navigation,
  route,
}: RootStackScreenProps<'WorkoutPlans'>) {
  const { t } = useTranslation();
  const [date, setDate] = useState(route.params?.date ?? getTodayDate());
  const { isConnected } = useServerConnection();
  const query = useWorkoutPlans(isConnected);
  const start = useStartWorkoutPlanAssignment(navigation, date);
  const [starting, setStarting] = useState<string | null>(null);
  const startLock = useRef(false);
  const [focusedId, setFocusedId] = useState(route.params?.assignmentId);
  const begin = async (
    plan: WorkoutPlanTemplate,
    assignment: WorkoutPlanAssignment
  ) => {
    if (startLock.current) return;
    startLock.current = true;
    setStarting(String(assignment.id));
    try {
      await start(plan, assignment);
    } catch {
      Toast.show({
        type: 'error',
        text1: t('weeklyPlan.startFailed', {
          defaultValue: 'Could not open the planned session. Try again.',
        }),
      });
    } finally {
      startLock.current = false;
      setStarting(null);
    }
  };
  const remove = (id: string) =>
    Alert.alert(
      t('weeklyPlan.deleteTitle', { defaultValue: 'Delete training plan?' }),
      t('weeklyPlan.deleteHint', {
        defaultValue: 'Previous logged workouts remain in your history.',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => {
            void query.remove.mutateAsync(id).catch(() =>
              Toast.show({
                type: 'error',
                text1: t('weeklyPlan.saveFailed', {
                  defaultValue:
                    'Could not save the plan. Your changes are still here. Try again.',
                }),
              })
            );
          },
        },
      ]
    );
  return (
    <TrackingScreen
      testID="workout-plans"
      title={t('weeklyPlan.title', { defaultValue: 'Weekly training plan' })}
      subtitle={t('weeklyPlan.subtitle', {
        defaultValue:
          'Plan whole activities and saved workouts. Planned sessions are not completed workouts.',
      })}
      date={date}
      onDateChange={setDate}
      onBack={navigation.goBack}
      onRefresh={query.refetch}
    >
      {focusedId && (
        <NeonButton
          label={t('common.showAll', { defaultValue: 'Show all' })}
          variant="subtle"
          onPress={() => setFocusedId(undefined)}
        />
      )}
      <NeonButton
        label={t('weeklyPlan.create', { defaultValue: 'Create plan' })}
        icon="add"
        onPress={() => navigation.navigate('WorkoutPlanForm')}
        disabled={!isConnected}
      />
      {!isConnected ? (
        <StatusView
          icon="cloud-offline"
          title={t('weeklyPlan.offline', {
            defaultValue:
              'Connect to your server to edit or start planned sessions.',
          })}
        />
      ) : query.isError ? (
        <StatusView
          icon="alert-circle"
          title={t('weeklyPlan.loadFailed', {
            defaultValue: 'Could not load training plans. Try again.',
          })}
          action={{
            label: t('common.retry', { defaultValue: 'Retry' }),
            onPress: () => void query.refetch(),
          }}
        />
      ) : null}
      {query.isLoading && (
        <Text className="text-text-secondary py-4">
          {t('common.loading', { defaultValue: 'Loading...' })}
        </Text>
      )}
      {query.data?.length === 0 && (
        <Text className="text-text-secondary py-4">
          {t('weeklyPlan.empty', {
            defaultValue:
              'No training plan yet. Add activities or saved workouts to your week.',
          })}
        </Text>
      )}
      {(query.data ?? [])
        .filter(
          (plan) =>
            !focusedId ||
            plan.assignments?.some((a) => String(a.id) === focusedId)
        )
        .map((plan) => {
          const due =
            plan.is_active &&
            plan.start_date.slice(0, 10) <= date &&
            (!plan.end_date || plan.end_date.slice(0, 10) >= date)
              ? (plan.assignments ?? []).filter(
                  (a) =>
                    a.day_of_week === weekdayOfDay(date) &&
                    (!focusedId || String(a.id) === focusedId)
                )
              : [];
          return (
            <GlowCard key={plan.id} className="mt-4 p-4 gap-3">
              <Text className="text-xl font-semibold text-text-primary">
                {plan.plan_name}
              </Text>
              <Text className="text-text-secondary">
                {plan.is_active
                  ? t('weeklyPlan.active', { defaultValue: 'Active' })
                  : t('weeklyPlan.inactive', { defaultValue: 'Inactive' })}{' '}
                · {plan.start_date.slice(0, 10)}
                {plan.end_date ? ` – ${plan.end_date.slice(0, 10)}` : ''}
              </Text>
              {due.length === 0 && (
                <Text className="text-text-secondary">
                  {t('weeklyPlan.noSession', {
                    defaultValue: 'No session planned for this day.',
                  })}
                </Text>
              )}
              {due.map((a) => (
                <View
                  key={a.id}
                  className="gap-2 border-t border-border-subtle pt-3"
                >
                  <Text className="text-lg text-text-primary">
                    {a.session_name ||
                      (a.activity_type
                        ? plannedActivityLabel(t, a.activity_type)
                        : a.workout_preset_name || a.exercise_name)}
                  </Text>
                  <Text className="text-text-secondary">
                    {[
                      a.planned_time?.slice(0, 5),
                      a.planned_duration_minutes
                        ? `${formatLocalizedNumber(a.planned_duration_minutes)} min`
                        : null,
                      a.planned_distance_km
                        ? `${formatLocalizedNumber(a.planned_distance_km)} km`
                        : null,
                      a.is_optional
                        ? t('weeklyPlan.optional', {
                            defaultValue: 'Optional session',
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {a.activity_type !== 'rest' && (
                    <NeonButton
                      label={
                        a.activity_type
                          ? t('weeklyPlan.log', {
                              defaultValue: 'Log activity',
                            })
                          : t('weeklyPlan.start', {
                              defaultValue: 'Start workout',
                            })
                      }
                      onPress={() => void begin(plan, a)}
                      loading={starting === String(a.id)}
                      disabled={Boolean(starting) || !isConnected}
                      variant="outline"
                    />
                  )}
                </View>
              ))}
              <View className="flex-row gap-2">
                <NeonButton
                  label={t('common.edit', { defaultValue: 'Edit' })}
                  variant="subtle"
                  style={{ flex: 1 }}
                  onPress={() =>
                    navigation.navigate('WorkoutPlanForm', { plan })
                  }
                />
                <NeonButton
                  label={t('common.delete', { defaultValue: 'Delete' })}
                  variant="subtle"
                  style={{ flex: 1 }}
                  onPress={() => remove(String(plan.id))}
                  disabled={query.remove.isPending}
                />
              </View>
            </GlowCard>
          );
        })}
    </TrackingScreen>
  );
}
