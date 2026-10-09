import Button from '../ui/Button';
import { useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import { habitDayState, type Habit, type HabitLog } from '@workspace/shared';
import Icon from '../Icon';
import { habitIcon } from './habitIcons';
import { withAlpha } from '../ui/glow';
import { formatLocalizedNumber } from '../../localization';

interface HabitRowProps {
  habit: Habit;
  log: HabitLog | undefined;
  /** Localized reminder time, or null for "any time". */
  timeLabel: string | null;
  tint: string;
  saving: boolean;
  onSave: (value: boolean | number | null) => void;
  onEdit: () => void;
  showDivider: boolean;
}

function parseAmount(text: string): number | null {
  const normalized = text.replace(',', '.').trim();
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * One habit for one day. Nothing is saved until the user taps Done, Save or
 * a menu action; the count field starts from the saved value, never from a
 * suggestion.
 */
export default function HabitRow({
  habit,
  log,
  timeLabel,
  tint,
  saving,
  onSave,
  onEdit,
  showDivider,
}: HabitRowProps) {
  const { t } = useTranslation();
  const amountRef = useRef<TextInput>(null);
  const [textPrimary, textSecondary, green, border] = useCSSVariable([
    '--color-text-primary',
    '--color-text-secondary',
    '--color-neon-green',
    '--color-border-subtle',
  ]) as [string, string, string, string];
  const state = habitDayState(habit, log);
  const complete = state === 'complete';
  const savedText = log ? String(log.value) : '';
  const [text, setText] = useState(savedText);

  const [syncedFrom, setSyncedFrom] = useState(savedText);
  // A newly saved or cleared value replaces the field; typing does not.
  if (syncedFrom !== savedText) {
    setSyncedFrom(savedText);
    setText(savedText);
  }

  const pending = parseAmount(text);
  const changed =
    habit.habit_type === 'count' &&
    pending !== null &&
    (log === undefined || pending !== log.value);
  const unit = habit.unit ?? '';
  const detail = [
    habit.description,
    habit.target != null
      ? t('habits.targetLabel', {
          defaultValue: 'Target {{value}} {{unit}}',
          value: formatLocalizedNumber(habit.target),
          unit,
        }).trim()
      : unit || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const openMenu = () => {
    const buttons: Parameters<typeof Alert.alert>[2] = [
      {
        text: t('habits.editHabit', { defaultValue: 'Edit habit' }),
        onPress: onEdit,
      },
    ];
    if (habit.habit_type === 'completion' && state !== 'not_done') {
      buttons.push({
        text: t('habits.markNotDone', { defaultValue: 'Record as not done' }),
        onPress: () => onSave(false),
      });
    }
    if (log) {
      buttons.push({
        text: t('habits.clearRecord', { defaultValue: 'Clear today’s record' }),
        style: 'destructive',
        onPress: () => onSave(null),
      });
    }
    buttons.push({
      text: t('common.cancel', { defaultValue: 'Cancel' }),
      style: 'cancel',
    });
    Alert.alert(habit.name, undefined, buttons);
  };

  const stepBy = (direction: 1 | -1) => {
    if (!habit.step) return;
    const base = pending ?? 0;
    const next = Math.max(0, base + direction * habit.step);
    setText(String(Math.round(next * 1000) / 1000));
  };

  return (
    <View
      testID={`habit-row-${habit.id}`}
      // Controls wrap under the name on narrow rows instead of squeezing it.
      className="flex-row flex-wrap items-center gap-x-3 gap-y-2 py-3"
      style={
        showDivider ? { borderTopWidth: 1, borderTopColor: border } : undefined
      }
    >
      <Pressable
        testID={`habit-state-${habit.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('progress.openAction', {
          defaultValue: 'Open action for {{name}}',
          name: habit.name,
        })}
        disabled={saving}
        onPress={() =>
          habit.habit_type === 'completion'
            ? complete
              ? openMenu()
              : onSave(true)
            : amountRef.current?.focus()
        }
        onLongPress={openMenu}
        className="h-11 w-11 items-center justify-center rounded-full"
        style={
          complete
            ? { backgroundColor: green }
            : { borderWidth: 2, borderColor: withAlpha(tint, 0.9) }
        }
      >
        {complete ? <Icon name="checkmark" size={16} color="#08130d" /> : null}
      </Pressable>
      <Icon name={habitIcon(habit.icon)} size={24} color={tint} />
      <View
        className={`flex-1 ${habit.habit_type === 'count' ? 'min-w-[45%]' : ''}`}
      >
        <Text
          className="text-base font-semibold text-text-primary"
          numberOfLines={2}
        >
          {habit.name}
        </Text>
        {detail ? (
          <Text className="text-xs text-text-secondary" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
        <View className="mt-0.5 flex-row items-center gap-1">
          <Icon name="clock" size={11} color={textSecondary} />
          <Text className="text-xs text-text-secondary">
            {timeLabel ?? t('habits.anyTime', { defaultValue: 'Any time' })}
          </Text>
          {state === 'not_done' ? (
            <Text className="text-xs text-text-secondary">
              {' · '}
              {t('habits.recordedNotDone', {
                defaultValue: 'Recorded as not done',
              })}
            </Text>
          ) : null}
        </View>
      </View>

      {habit.habit_type === 'completion' ? (
        <Button
          variant={complete ? 'primary' : 'secondary'}
          testID={`habit-done-${habit.id}`}
          accessibilityRole="button"
          accessibilityState={{ selected: complete, busy: saving }}
          accessibilityLabel={
            complete
              ? t('habits.doneA11y', {
                  defaultValue: '{{name}} done. Tap to undo.',
                  name: habit.name,
                })
              : t('habits.markDoneA11y', {
                  defaultValue: 'Mark {{name}} done',
                  name: habit.name,
                })
          }
          disabled={saving}
          onPress={() => onSave(complete ? null : true)}
          className="min-h-11 flex-row items-center gap-1 px-4"
        >
          {complete ? <Icon name="checkmark" size={14} color={green} /> : null}
          <Text
            className="text-sm font-semibold"
            style={{ color: complete ? green : textPrimary }}
          >
            {complete
              ? t('habits.done', { defaultValue: 'Done' })
              : t('habits.markDone', { defaultValue: 'Mark done' })}
          </Text>
        </Button>
      ) : (
        <View className="ml-auto flex-row flex-wrap items-center gap-1.5 max-w-full">
          {habit.step ? (
            <Pressable
              testID={`habit-decrement-${habit.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('habits.decrease', {
                defaultValue: 'Decrease',
              })}
              onPress={() => stepBy(-1)}
              className="h-11 w-11 items-center justify-center rounded-lg border border-border-subtle"
            >
              <Icon name="remove" size={16} color={textPrimary} />
            </Pressable>
          ) : null}
          <View className="items-center rounded-lg border border-border-subtle px-2">
            <TextInput
              ref={amountRef}
              testID={`habit-amount-${habit.id}`}
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder="–"
              placeholderTextColor={textSecondary}
              accessibilityLabel={t('habits.amountA11y', {
                defaultValue: '{{name}} amount',
                name: habit.name,
              })}
              className="min-h-9 w-14 text-center text-lg font-semibold text-text-primary"
            />
            <Text
              className="pb-1 text-[10px] text-text-secondary"
              numberOfLines={1}
            >
              {habit.target != null
                ? `/ ${formatLocalizedNumber(habit.target)} ${unit}`.trim()
                : unit}
            </Text>
          </View>
          {habit.step ? (
            <Pressable
              testID={`habit-increment-${habit.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('habits.increase', {
                defaultValue: 'Increase',
              })}
              onPress={() => stepBy(1)}
              className="h-11 w-11 items-center justify-center rounded-lg border border-border-subtle"
            >
              <Icon name="add" size={16} color={textPrimary} />
            </Pressable>
          ) : null}
          <Button
            variant="secondary"
            testID={`habit-save-${habit.id}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !changed || saving }}
            disabled={!changed || saving}
            onPress={() => pending !== null && onSave(pending)}
            className="min-h-11 justify-center px-3"
            textClassName="text-sm font-semibold"
          >
            {log && !changed
              ? t('habits.saved', { defaultValue: 'Saved' })
              : t('common.save', { defaultValue: 'Save' })}
          </Button>
        </View>
      )}
      <Pressable
        testID={`habit-menu-${habit.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('habits.moreActions', {
          defaultValue: 'More actions for {{name}}',
          name: habit.name,
        })}
        onPress={openMenu}
        className="h-11 w-11 items-center justify-center"
      >
        <Icon name="ellipsis-horizontal" size={18} color={textPrimary} />
      </Pressable>
    </View>
  );
}
