import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import {
  isWellnessActivity,
  recordWellnessActivity,
  wellnessEntries,
} from '@workspace/shared';
import {
  useHabitLogs,
  useHabits,
  useHabitMutations,
  useLogHabit,
} from '../../hooks/useDailyTracking';
import { addDays } from '../../utils/dateUtils';
import { useAppLocale } from '../../localization';
import GlowCard from '../ui/GlowCard';
import NeonButton from '../ui/NeonButton';
import Icon from '../Icon';

export default function WellnessCard({ date }: { date: string }) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const secondary = useCSSVariable('--color-text-secondary') as string;
  const [name, setName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<'save' | 'remove' | null>(null);
  const inFlight = useRef(false);
  const habits = useHabits({ includeInactive: true });
  const startDate = addDays(date, -29);
  const logs = useHabitLogs(startDate, date);
  const { create } = useHabitMutations();
  const log = useLogHabit(startDate, date);
  const entries = wellnessEntries(habits.data ?? [], logs.data ?? []);
  const today = entries.filter((entry) => entry.date === date);
  const presets = [
    t('wellness.sauna', { defaultValue: 'Sauna' }),
    t('wellness.massage', { defaultValue: 'Massage' }),
    t('wellness.meditation', { defaultValue: 'Meditation' }),
  ];
  const choices = [
    ...new Set([
      ...presets,
      ...(habits.data ?? [])
        .filter((habit) => isWellnessActivity(habit) && habit.active)
        .map((habit) => habit.name),
    ]),
  ];
  const loading = habits.isPending || logs.isPending;
  const failed = habits.isError || logs.isError;
  const blocked = saving || loading || failed;

  const record = async (activity: string, custom = false) => {
    if (inFlight.current || blocked || !activity.trim()) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await recordWellnessActivity({
        name: activity,
        date,
        habits: habits.data ?? [],
        create: (body) => create.mutateAsync(body),
        log: (habitId, body) => log.mutateAsync({ habitId, body }),
      });
      if (custom) setName('');
    } catch {
      setError('save');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const undo = async (habitId: string) => {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await log.mutateAsync({
        habitId,
        body: { entry_date: date, value: null },
      });
    } catch {
      setError('remove');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <GlowCard className="mx-4 mb-3 p-4" testID="wellness-card">
      <View className="mb-1 flex-row items-center gap-2">
        <Icon name="wellness" size={20} color={secondary} />
        <Text
          accessibilityRole="header"
          className="text-lg font-semibold text-text-primary"
        >
          {t('wellness.title', { defaultValue: 'Wellness' })}
        </Text>
      </View>
      <Text className="mb-3 text-sm text-text-secondary">
        {t('wellness.subtitle', {
          defaultValue: 'Log an activity for this day.',
        })}
      </Text>
      {loading ? (
        <Text className="text-text-secondary">
          {t('wellness.loading', {
            defaultValue: 'Loading wellness activities…',
          })}
        </Text>
      ) : failed ? (
        <View className="gap-2">
          <Text accessibilityRole="alert" className="text-text-secondary">
            {t('wellness.loadFailed', {
              defaultValue:
                'Could not load wellness activities. Please try again.',
            })}
          </Text>
          <NeonButton
            label={t('wellness.retry', { defaultValue: 'Try again' })}
            variant="subtle"
            onPress={() => {
              void habits.refetch();
              void logs.refetch();
            }}
          />
        </View>
      ) : (
        <>
          {today.length > 0 ? (
            today.map((entry) => (
              <View
                key={entry.activityId}
                className="mb-2 min-h-12 flex-row flex-wrap items-center gap-3"
              >
                <Text className="min-w-40 grow basis-40 text-base text-text-primary">
                  {entry.name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('wellness.removeActivity', {
                    defaultValue: 'Remove {{name}} from this day',
                    name: entry.name,
                  })}
                  accessibilityState={{ disabled: saving }}
                  disabled={saving}
                  onPress={() => void undo(entry.activityId)}
                  className="ml-auto min-h-11 min-w-11 shrink-0 justify-center px-3"
                >
                  <Text className="font-medium text-accent-primary">
                    {t('wellness.undo', { defaultValue: 'Undo' })}
                  </Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text className="mb-3 text-sm text-text-secondary">
              {t('wellness.empty', {
                defaultValue: 'No wellness activities logged for this day.',
              })}
            </Text>
          )}
          <View className="mb-4 flex-row flex-wrap gap-2">
            {choices.map((choice) => {
              const recorded = today.some(
                (entry) => entry.name.toLowerCase() === choice.toLowerCase()
              );
              return (
                <Pressable
                  key={choice}
                  accessibilityRole="button"
                  accessibilityLabel={t('wellness.logActivity', {
                    defaultValue: 'Log {{name}}',
                    name: choice,
                  })}
                  accessibilityState={{
                    disabled: blocked || recorded,
                    selected: recorded,
                  }}
                  disabled={blocked || recorded}
                  onPress={() => void record(choice)}
                  className="min-h-12 max-w-full justify-center rounded-xl border border-border-subtle bg-raised px-3 py-2"
                  style={{ opacity: blocked ? 0.5 : 1 }}
                >
                  <Text className="text-base text-text-primary">
                    {choice}
                    {recorded
                      ? ` · ${t('wellness.recorded', { defaultValue: 'Logged' })}`
                      : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="mb-1 text-sm font-semibold text-text-primary">
            {t('wellness.custom', { defaultValue: 'Custom activity' })}
          </Text>
          <TextInput
            testID="wellness-name"
            accessibilityLabel={t('wellness.custom', {
              defaultValue: 'Custom activity',
            })}
            value={name}
            onChangeText={setName}
            maxLength={50}
            editable={!saving}
            placeholder={t('wellness.placeholder', {
              defaultValue: 'Activity name',
            })}
            placeholderTextColor={secondary}
            className="mb-2 min-h-12 rounded-xl border border-border-subtle bg-raised px-3 text-base text-text-primary"
            onSubmitEditing={() => void record(name, true)}
            returnKeyType="done"
          />
          <NeonButton
            label={t('wellness.log', { defaultValue: 'Log activity' })}
            variant="subtle"
            disabled={blocked || !name.trim()}
            loading={saving}
            onPress={() => void record(name, true)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showHistory }}
            className="mt-3 min-h-11 justify-center border-t border-border-subtle py-3"
            onPress={() => setShowHistory(!showHistory)}
          >
            <Text className="font-semibold text-accent-primary">
              {t('wellness.history', {
                defaultValue: 'History · last 30 days',
              })}
            </Text>
          </Pressable>
          {showHistory &&
            (entries.length > 0 ? (
              entries.map((entry) => (
                <View
                  key={`${entry.activityId}:${entry.date}`}
                  className="mb-2 flex-row flex-wrap justify-between gap-x-3 gap-y-1"
                >
                  <Text className="shrink text-sm text-text-primary">
                    {entry.name}
                  </Text>
                  <Text className="text-sm text-text-secondary">
                    {new Date(`${entry.date}T12:00:00`).toLocaleDateString(
                      locale
                    )}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="text-sm text-text-secondary">
                {t('wellness.historyEmpty', {
                  defaultValue:
                    'No wellness activities recorded in this period.',
                })}
              </Text>
            ))}
        </>
      )}
      {error && (
        <Text
          accessibilityRole="alert"
          className="mt-2 text-sm text-text-danger"
        >
          {error === 'save'
            ? t('wellness.saveFailed', {
                defaultValue: 'Could not save the activity. Please try again.',
              })
            : t('wellness.removeFailed', {
                defaultValue:
                  'Could not remove the activity. Please try again.',
              })}
        </Text>
      )}
    </GlowCard>
  );
}
