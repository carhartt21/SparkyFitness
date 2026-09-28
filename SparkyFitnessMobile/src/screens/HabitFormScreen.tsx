import React, { useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HabitType } from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import { HABIT_ICON_OPTIONS } from '../components/tracking/habitIcons';
import { useNeonScale } from '../components/tracking/useNeonScale';
import GlowCard from '../components/ui/GlowCard';
import NeonButton from '../components/ui/NeonButton';
import Switch from '../components/ui/Switch';
import { withAlpha } from '../components/ui/glow';
import SegmentedControl from '../components/SegmentedControl';
import TimeSheet, { type TimeSheetRef } from '../components/TimeSheet';
import Icon from '../components/Icon';
import { useHabitMutations, useHabits } from '../hooks/useDailyTracking';
import { usePreferences } from '../hooks';
import {
  formatLocalizedTimeOfDay,
  localizedWeekdayLabels,
} from '../utils/medicationScheduleLocalization';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'HabitForm'>;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function parseOptionalNumber(text: string): number | null | 'invalid' {
  const trimmed = text.replace(',', '.').trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : 'invalid';
}

const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <View className="mb-4">
    <Text className="mb-1 text-sm font-semibold text-text-primary">
      {label}
    </Text>
    {children}
    {hint ? (
      <Text className="mt-1 text-xs text-text-secondary">{hint}</Text>
    ) : null}
  </View>
);

const HabitFormScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const [secondary, border] = useCSSVariable([
    '--color-text-secondary',
    '--color-border-subtle',
  ]) as [string, string];
  const { preferences } = usePreferences();
  const habitId = route.params?.habitId;
  const habitsQuery = useHabits({
    includeInactive: true,
    enabled: Boolean(habitId),
  });
  const existing = habitId
    ? habitsQuery.data?.find((habit) => habit.id === habitId)
    : undefined;
  const { create, update, remove } = useHabitMutations();
  const timeSheet = useRef<TimeSheetRef>(null);
  const weekdays = localizedWeekdayLabels(t);

  const [name, setName] = useState('');
  const [type, setType] = useState<HabitType>('completion');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [target, setTarget] = useState('');
  const [step, setStep] = useState('');
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [reminder, setReminder] = useState<string | null>(null);
  const [icon, setIcon] = useState<string>('habit');
  const [active, setActive] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Seed the form once when the habit arrives; later refetches must not
  // overwrite edits in progress.
  if (existing && !loaded) {
    setLoaded(true);
    setName(existing.name);
    setType(existing.habit_type);
    setDescription(existing.description ?? '');
    setUnit(existing.unit ?? '');
    setTarget(existing.target === null ? '' : String(existing.target));
    setStep(existing.step === null ? '' : String(existing.step));
    setDays(existing.days ?? ALL_DAYS);
    setReminder(existing.reminder_time);
    setIcon(existing.icon ?? 'habit');
    setActive(existing.active);
  }

  const targetValue = parseOptionalNumber(target);
  const stepValue = parseOptionalNumber(step);
  const valid =
    name.trim().length > 0 &&
    days.length > 0 &&
    (type === 'completion' ||
      (targetValue !== 'invalid' && stepValue !== 'invalid'));

  const submit = async () => {
    if (!valid) return;
    const count = type === 'count';
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      unit: count ? unit.trim() || null : null,
      target: count && targetValue !== 'invalid' ? targetValue : null,
      step: count && stepValue !== 'invalid' ? stepValue : null,
      days: days.length === 7 ? null : days.slice().sort(),
      reminder_time: reminder,
      icon,
      active,
    };
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, body });
      } else {
        await create.mutateAsync({ ...body, habit_type: type });
      }
      navigation.goBack();
    } catch {
      Toast.show({
        type: 'error',
        text1: t('habits.formSaveFailed', {
          defaultValue: 'Could not save the habit.',
        }),
      });
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(
      t('habits.deleteTitle', { defaultValue: 'Delete habit?' }),
      t('habits.deleteMessage', {
        defaultValue:
          'This deletes the habit and its whole history. Archive it instead to keep the history.',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            await remove.mutateAsync(existing.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const inputClass =
    'min-h-12 rounded-xl border border-border-subtle bg-raised px-3 text-base text-text-primary';

  return (
    <TrackingScreen
      testID="habit-form"
      title={
        existing
          ? t('habits.editHabit', { defaultValue: 'Edit habit' })
          : t('habits.newHabit', { defaultValue: 'New habit' })
      }
      subtitle={t('habits.formSubtitle', {
        defaultValue:
          'Only what you record counts; nothing is logged automatically.',
      })}
      onBack={navigation.goBack}
      footer={
        <NeonButton
          testID="habit-form-save"
          icon="checkmark"
          label={t('common.save', { defaultValue: 'Save' })}
          onPress={submit}
          disabled={!valid}
          loading={create.isPending || update.isPending}
        />
      }
    >
      <GlowCard className="mb-3 p-4">
        <Field label={t('habits.nameLabel', { defaultValue: 'Name' })}>
          <TextInput
            testID="habit-form-name"
            value={name}
            onChangeText={setName}
            maxLength={50}
            placeholder={t('habits.namePlaceholder', {
              defaultValue: 'e.g. Evening stretching',
            })}
            placeholderTextColor={secondary}
            className={inputClass}
          />
        </Field>
        <Field
          label={t('habits.typeLabel', { defaultValue: 'Type' })}
          hint={
            existing
              ? t('habits.typeFixed', {
                  defaultValue: 'The type cannot change after creation.',
                })
              : undefined
          }
        >
          <SegmentedControl
            segments={[
              {
                key: 'completion',
                label: t('habits.typeCompletion', {
                  defaultValue: 'Done / not done',
                }),
              },
              {
                key: 'count',
                label: t('habits.typeCount', { defaultValue: 'Count' }),
              },
            ]}
            activeKey={type}
            onSelect={(key) => {
              if (!existing) setType(key as HabitType);
            }}
          />
        </Field>
        <Field
          label={t('habits.descriptionLabel', {
            defaultValue: 'Description (optional)',
          })}
        >
          <TextInput
            value={description}
            onChangeText={setDescription}
            maxLength={300}
            placeholderTextColor={secondary}
            className={inputClass}
          />
        </Field>
        {type === 'count' ? (
          <>
            <Field
              label={t('habits.unitLabel', { defaultValue: 'Unit (optional)' })}
            >
              <TextInput
                testID="habit-form-unit"
                value={unit}
                onChangeText={setUnit}
                maxLength={50}
                placeholder={t('habits.unitPlaceholder', {
                  defaultValue: 'e.g. reps, pages, minutes',
                })}
                placeholderTextColor={secondary}
                className={inputClass}
              />
            </Field>
            <Field
              label={t('habits.targetFieldLabel', {
                defaultValue: 'Daily target (optional)',
              })}
              hint={t('habits.targetHint', {
                defaultValue:
                  'Without a target, any saved value completes the day.',
              })}
            >
              <TextInput
                testID="habit-form-target"
                value={target}
                onChangeText={setTarget}
                keyboardType="decimal-pad"
                className={inputClass}
              />
            </Field>
            <Field
              label={t('habits.stepLabel', {
                defaultValue: '+/− step (optional)',
              })}
              hint={t('habits.stepHint', {
                defaultValue:
                  'Adds +/− buttons to the row. Values are still saved only when you tap Save.',
              })}
            >
              <TextInput
                testID="habit-form-step"
                value={step}
                onChangeText={setStep}
                keyboardType="decimal-pad"
                className={inputClass}
              />
            </Field>
          </>
        ) : null}
      </GlowCard>

      <GlowCard className="mb-3 p-4">
        <Field label={t('habits.daysLabel', { defaultValue: 'Days' })}>
          <View className="flex-row flex-wrap gap-2">
            {ALL_DAYS.map((day) => {
              const selected = days.includes(day);
              return (
                <Pressable
                  key={day}
                  testID={`habit-form-day-${day}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={weekdays[day]}
                  onPress={() =>
                    setDays((current) =>
                      selected
                        ? current.filter((item) => item !== day)
                        : [...current, day]
                    )
                  }
                  className="h-11 min-w-11 items-center justify-center rounded-full border px-2"
                  style={{
                    borderColor: selected ? scale.green : border,
                    backgroundColor: selected
                      ? withAlpha(scale.green, 0.18)
                      : 'transparent',
                  }}
                >
                  <Text className="text-sm text-text-primary">
                    {weekdays[day]?.slice(0, 2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text-primary">
              {t('habits.reminderLabel', { defaultValue: 'Reminder time' })}
            </Text>
            <Text className="text-xs text-text-secondary">
              {t('habits.reminderHint', {
                defaultValue:
                  'Used for ordering and, when habit reminders are on, a gentle notification.',
              })}
            </Text>
          </View>
          <Switch
            value={reminder !== null}
            onValueChange={(enabled) => {
              if (enabled) {
                setReminder('19:00');
                timeSheet.current?.present();
              } else {
                setReminder(null);
              }
            }}
          />
        </View>
        {reminder ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => timeSheet.current?.present()}
            className="min-h-11 flex-row items-center gap-2"
          >
            <Icon name="clock" size={16} color={scale.green} />
            <Text className="text-base text-text-link">
              {formatLocalizedTimeOfDay(
                reminder,
                undefined,
                preferences?.time_format
              )}
            </Text>
          </Pressable>
        ) : null}
      </GlowCard>

      <GlowCard className="mb-3 p-4">
        <Field label={t('habits.iconLabel', { defaultValue: 'Icon' })}>
          <View className="flex-row flex-wrap gap-2">
            {HABIT_ICON_OPTIONS.map((option) => {
              const selected = icon === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={option}
                  onPress={() => setIcon(option)}
                  className="h-11 w-11 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: selected ? scale.green : border,
                    backgroundColor: selected
                      ? withAlpha(scale.green, 0.18)
                      : 'transparent',
                  }}
                >
                  <Icon
                    name={option}
                    size={20}
                    color={selected ? scale.green : secondary}
                  />
                </Pressable>
              );
            })}
          </View>
        </Field>
        {existing ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-text-primary">
                {t('habits.activeLabel', { defaultValue: 'Active' })}
              </Text>
              <Text className="text-xs text-text-secondary">
                {t('habits.activeHint', {
                  defaultValue:
                    'Archived habits keep their history but leave today’s list.',
                })}
              </Text>
            </View>
            <Switch
              testID="habit-form-active"
              value={active}
              onValueChange={setActive}
            />
          </View>
        ) : null}
      </GlowCard>

      {existing ? (
        <NeonButton
          testID="habit-form-delete"
          variant="outline"
          color={scale.red}
          icon="trash"
          label={t('habits.deleteHabit', {
            defaultValue: 'Delete habit and history',
          })}
          onPress={confirmDelete}
          className="mb-3"
        />
      ) : null}

      <TimeSheet
        ref={timeSheet}
        value={reminder ?? ''}
        onSelectTime={setReminder}
        timeFormat={preferences?.time_format}
      />
    </TrackingScreen>
  );
};

export default HabitFormScreen;
