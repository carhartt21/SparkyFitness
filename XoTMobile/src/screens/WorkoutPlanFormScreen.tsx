import Button from '../components/ui/Button';
import { plannedActivityLabel } from '../components/tracking/trackingLabels';
import { useRef, useState } from 'react';
import { Keyboard, Pressable, Switch, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import {
  PLANNED_ACTIVITY_TYPES,
  workoutPlanWriteSchema,
  type PlannedActivityType,
} from '@workspace/shared';
import FormScreenChrome from '../components/FormScreenChrome';
import FormInput from '../components/FormInput';
import WorkoutPlanTimeField from '../components/WorkoutPlanTimeField';
import BottomSheetPicker from '../components/BottomSheetPicker';
import CalendarSheet, {
  type CalendarSheetRef,
} from '../components/CalendarSheet';
import Icon from '../components/Icon';
import { useCSSVariable } from 'uniwind';
import NeonButton from '../components/ui/NeonButton';
import { useWorkoutPlans } from '../hooks/useWorkoutPlans';
import { useWorkoutPresets } from '../hooks/useWorkoutPresets';
import { useServerConnection } from '../hooks';
import { useAppLocale } from '../localization';
import { parseDecimalInput } from '../utils/numericInput';
import { getTodayDate } from '../utils/dateUtils';
import type { WorkoutPlanAssignment } from '../types/workoutPlans';
import type { RootStackScreenProps } from '../types/navigation';

export default function WorkoutPlanFormScreen({
  navigation,
  route,
}: RootStackScreenProps<'WorkoutPlanForm'>) {
  const initial = route.params?.plan;
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { isConnected } = useServerConnection();
  const { save } = useWorkoutPlans(isConnected);
  const { presets } = useWorkoutPresets({ enabled: isConnected });
  const [name, setName] = useState(initial?.plan_name ?? '');
  const [startDate, setStartDate] = useState(
    initial?.start_date.slice(0, 10) ?? getTodayDate()
  );
  const [endDate, setEndDate] = useState(initial?.end_date?.slice(0, 10) ?? '');
  const startCalendar = useRef<CalendarSheetRef>(null);
  const endCalendar = useRef<CalendarSheetRef>(null);
  const iconColor = useCSSVariable('--color-text-secondary') as string;
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [assignments, setAssignments] = useState<WorkoutPlanAssignment[]>(
    initial?.assignments ?? []
  );
  const [numericDrafts, setNumericDrafts] = useState<
    Record<string, { duration?: string; distance?: string }>
  >({});
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const counter = useRef(0);
  const sequential = initial?.schedule_type === 'sequential';
  const update = (index: number, patch: Partial<WorkoutPlanAssignment>) =>
    setAssignments((current) =>
      current.map((a, i) => (i === index ? { ...a, ...patch } : a))
    );
  const savePlan = async () => {
    if (lock.current) return;
    const data = {
      plan_name: name.trim(),
      description: initial?.description ?? null,
      start_date: startDate,
      end_date: endDate || null,
      is_active: active,
      schedule_type: initial?.schedule_type ?? ('weekly' as const),
      entry_mode: assignments.some((assignment) => assignment.activity_type)
        ? ('prompt' as const)
        : (initial?.entry_mode ?? ('prompt' as const)),
      assignments: assignments.map((a) => ({
        ...a,
        planned_duration_minutes:
          numericDrafts[String(a.id)]?.duration === undefined
            ? a.planned_duration_minutes
            : nullableNumber(numericDrafts[String(a.id)].duration!),
        planned_distance_km:
          numericDrafts[String(a.id)]?.distance === undefined
            ? a.planned_distance_km
            : nullableNumber(numericDrafts[String(a.id)].distance!),
      })),
    };
    if (!name.trim() || !workoutPlanWriteSchema.safeParse(data).success) {
      setError(true);
      return;
    }
    lock.current = true;
    setError(false);
    try {
      await save.mutateAsync({
        data,
        id: initial ? String(initial.id) : undefined,
      });
      navigation.goBack();
    } catch {
      Toast.show({
        type: 'error',
        text1: t('weeklyPlan.saveFailed', {
          defaultValue:
            'Could not save the plan. Your changes are still here. Try again.',
        }),
      });
    } finally {
      lock.current = false;
    }
  };
  const days = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    value: day,
    label: new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2026, 8, 27 + day))),
  }));
  const activityOptions = PLANNED_ACTIVITY_TYPES.map((type) => ({
    value: type as string,
    label: plannedActivityLabel(t, type),
  }));
  const nullableNumber = (value: string) =>
    value.trim() ? parseDecimalInput(value) : null;
  const dateLabel = (day: string) => {
    const [year, month, date] = day.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(year, month - 1, date));
  };
  const openCalendar = (calendar: React.RefObject<CalendarSheetRef | null>) => {
    Keyboard.dismiss();
    calendar.current?.present();
  };
  return (
    <FormScreenChrome
      title={t('weeklyPlan.title', { defaultValue: 'Weekly training plan' })}
      saveLabel={t('common.save', { defaultValue: 'Save' })}
      savingLabel={t('common.saving', { defaultValue: 'Saving…' })}
      isSaving={save.isPending || !isConnected}
      onSave={() => void savePlan()}
      onCancel={navigation.goBack}
    >
      <Text className="text-text-secondary">
        {t('weeklyPlan.subtitle', {
          defaultValue:
            'Plan whole activities and saved workouts. Planned sessions are not completed workouts.',
        })}
      </Text>
      <Text className="text-text-primary">
        {t('weeklyPlan.name', { defaultValue: 'Plan name' })}
      </Text>
      <FormInput
        testID="weekly-plan-name"
        value={name}
        onChangeText={setName}
        maxLength={255}
        accessibilityLabel={t('weeklyPlan.name', { defaultValue: 'Plan name' })}
      />
      <Text className="text-text-primary">
        {t('weeklyPlan.startDate', { defaultValue: 'Start date' })}
      </Text>
      <Button
        variant="secondary"
        testID="weekly-plan-start-date"
        onPress={() => openCalendar(startCalendar)}
        accessibilityRole="button"
        accessibilityLabel={t('weeklyPlan.startDate', {
          defaultValue: 'Start date',
        })}
        accessibilityValue={{ text: dateLabel(startDate) }}
        className="min-h-12 flex-row items-center justify-between px-3 py-3"
      >
        <Text className="text-base text-text-primary">
          {dateLabel(startDate)}
        </Text>
        <Icon name="calendar" size={20} color={iconColor} />
      </Button>
      <Text className="text-text-primary">
        {t('weeklyPlan.endDate', { defaultValue: 'End date (optional)' })}
      </Text>
      <Button
        variant="secondary"
        testID="weekly-plan-end-date"
        onPress={() => openCalendar(endCalendar)}
        accessibilityRole="button"
        accessibilityLabel={t('weeklyPlan.endDate', {
          defaultValue: 'End date (optional)',
        })}
        accessibilityValue={{
          text: endDate
            ? dateLabel(endDate)
            : t('weeklyPlan.noEndDate', { defaultValue: 'No end date' }),
        }}
        className="min-h-12 flex-row items-center justify-between px-3 py-3"
      >
        <Text className="text-base text-text-primary">
          {endDate
            ? dateLabel(endDate)
            : t('weeklyPlan.noEndDate', { defaultValue: 'No end date' })}
        </Text>
        <Icon name="calendar" size={20} color={iconColor} />
      </Button>
      {endDate ? (
        <Pressable
          testID="weekly-plan-clear-end-date"
          onPress={() => setEndDate('')}
          accessibilityRole="button"
          className="min-h-11 justify-center self-start"
        >
          <Text className="text-accent-primary">
            {t('weeklyPlan.clearEndDate', { defaultValue: 'Remove end date' })}
          </Text>
        </Pressable>
      ) : null}
      <CalendarSheet
        ref={startCalendar}
        selectedDate={startDate}
        onSelectDate={setStartDate}
      />
      <CalendarSheet
        ref={endCalendar}
        selectedDate={endDate || startDate}
        onSelectDate={setEndDate}
      />
      <View className="flex-row items-center justify-between gap-4">
        <Text className="flex-1 text-text-primary">
          {t('weeklyPlan.active', { defaultValue: 'Active' })}
        </Text>
        <Switch
          value={active}
          onValueChange={setActive}
          accessibilityLabel={t('weeklyPlan.active', {
            defaultValue: 'Active',
          })}
        />
      </View>
      {error && (
        <Text accessibilityRole="alert" className="text-icon-danger">
          {t('weeklyPlan.validation', {
            defaultValue:
              'Check the plan name, dates, activity and positive duration/distance values. Use a 24-hour time such as 18:30.',
          })}
        </Text>
      )}
      {!isConnected && (
        <Text className="text-text-secondary">
          {t('weeklyPlan.offline', {
            defaultValue:
              'Connect to your server to edit or start planned sessions.',
          })}
        </Text>
      )}
      {sequential ? (
        <Text className="text-text-secondary">
          {t('weeklyPlan.sequentialHint', {
            defaultValue:
              'This is an existing workout sequence. Its sessions are preserved. Edit the sequence in the web advanced editor.',
          })}
        </Text>
      ) : (
        assignments.map((a, index) => (
          <View key={a.id} className="gap-3 border-t border-border-subtle pt-4">
            <BottomSheetPicker
              value={a.day_of_week ?? 1}
              options={days}
              onSelect={(day) => update(index, { day_of_week: day })}
              title={t('weeklyPlan.day', { defaultValue: 'Day' })}
            />
            <BottomSheetPicker
              value={
                a.workout_preset_id
                  ? `preset:${a.workout_preset_id}`
                  : (a.activity_type ?? `exercise:${a.exercise_id}`)
              }
              options={[
                ...activityOptions,
                ...presets.map((p) => ({
                  value: `preset:${p.id}`,
                  label: p.name,
                })),
                ...(a.exercise_id
                  ? [
                      {
                        value: `exercise:${a.exercise_id}`,
                        label:
                          a.exercise_name ??
                          t('weeklyPlan.advanced', {
                            defaultValue: 'Individual exercise',
                          }),
                      },
                    ]
                  : []),
              ]}
              onSelect={(value) => {
                if (value.startsWith('exercise:')) return;
                setNumericDrafts((current) => {
                  const next = { ...current };
                  delete next[String(a.id)];
                  return next;
                });
                update(
                  index,
                  value.startsWith('preset:')
                    ? {
                        workout_preset_id: value.slice(7),
                        exercise_id: null,
                        activity_type: null,
                        sets: [],
                      }
                    : {
                        activity_type: value as PlannedActivityType,
                        workout_preset_id: null,
                        exercise_id: null,
                        sets: [],
                        ...(value === 'rest'
                          ? {
                              planned_duration_minutes: null,
                              planned_distance_km: null,
                            }
                          : {}),
                      }
                );
              }}
              title={t('weeklyPlan.type', {
                defaultValue: 'Activity or saved workout',
              })}
            />
            <FormInput
              value={a.session_name ?? ''}
              maxLength={160}
              onChangeText={(value) =>
                update(index, { session_name: value || null })
              }
              placeholder={t('weeklyPlan.labelOptional', {
                defaultValue: 'Session name (optional)',
              })}
              accessibilityLabel={t('weeklyPlan.labelOptional', {
                defaultValue: 'Session name (optional)',
              })}
            />
            {a.activity_type !== 'rest' && (
              <>
                <View className="flex-row gap-3">
                  <View className="flex-1 gap-1">
                    <Text className="text-text-secondary">
                      {t('weeklyPlan.duration', {
                        defaultValue: 'Duration (min, optional)',
                      })}
                    </Text>
                    <FormInput
                      value={
                        numericDrafts[String(a.id)]?.duration ??
                        (a.planned_duration_minutes == null
                          ? ''
                          : String(a.planned_duration_minutes))
                      }
                      keyboardType="decimal-pad"
                      onChangeText={(value) =>
                        setNumericDrafts((current) => ({
                          ...current,
                          [String(a.id)]: {
                            ...current[String(a.id)],
                            duration: value,
                          },
                        }))
                      }
                      accessibilityLabel={t('weeklyPlan.duration', {
                        defaultValue: 'Duration (min, optional)',
                      })}
                    />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-text-secondary">
                      {t('weeklyPlan.distance', {
                        defaultValue: 'Distance (km, optional)',
                      })}
                    </Text>
                    <FormInput
                      value={
                        numericDrafts[String(a.id)]?.distance ??
                        (a.planned_distance_km == null
                          ? ''
                          : String(a.planned_distance_km))
                      }
                      keyboardType="decimal-pad"
                      onChangeText={(value) =>
                        setNumericDrafts((current) => ({
                          ...current,
                          [String(a.id)]: {
                            ...current[String(a.id)],
                            distance: value,
                          },
                        }))
                      }
                      accessibilityLabel={t('weeklyPlan.distance', {
                        defaultValue: 'Distance (km, optional)',
                      })}
                    />
                  </View>
                </View>
                <WorkoutPlanTimeField
                  value={a.planned_time}
                  onChange={(time) => update(index, { planned_time: time })}
                />
                <View className="flex-row items-center justify-between">
                  <Text className="text-text-primary">
                    {t('weeklyPlan.optional', {
                      defaultValue: 'Optional session',
                    })}
                  </Text>
                  <Switch
                    value={a.is_optional ?? false}
                    onValueChange={(value) =>
                      update(index, { is_optional: value })
                    }
                    accessibilityLabel={t('weeklyPlan.optional', {
                      defaultValue: 'Optional session',
                    })}
                  />
                </View>
              </>
            )}
            <NeonButton
              label={t('common.delete', { defaultValue: 'Delete' })}
              variant="subtle"
              onPress={() =>
                setAssignments((current) =>
                  current.filter((_, i) => i !== index)
                )
              }
            />
          </View>
        ))
      )}
      {!sequential && (
        <NeonButton
          label={t('weeklyPlan.addSession', { defaultValue: 'Add session' })}
          icon="add"
          variant="outline"
          onPress={() =>
            setAssignments((current) => [
              ...current,
              {
                id: `draft-${++counter.current}`,
                template_id: initial?.id ?? '',
                day_of_week: 1,
                sort_order: current.length,
                activity_type: 'running',
                sets: [],
              },
            ])
          }
        />
      )}
    </FormScreenChrome>
  );
}
