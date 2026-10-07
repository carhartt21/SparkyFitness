import { useRef, useState } from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  Text,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  habitDayState,
  todayInZone,
  type DailyProgressItem,
} from '@workspace/shared';
import Toast from 'react-native-toast-message';
import {
  useHabits,
  useHabitLogs,
  useLogHabit,
  useMealTrackingStatus,
  useSetMealStatus,
} from '../../hooks/useDailyTracking';
import { usePreferences, useServerConnection } from '../../hooks';
import Icon, { type IconName } from '../Icon';
import HabitRow from './HabitRow';
import MealStatusControl from './MealStatusControl';
import Button from '../ui/Button';

type Props = {
  item: DailyProgressItem;
  date: string;
  label: string;
  icon: IconName;
  color: string;
  onOpen: () => void;
};
function ActionButton({
  item,
  label,
  icon,
  color,
  onOpen,
  disabled = false,
}: { disabled?: boolean } & Omit<Props, 'date'>) {
  const { t } = useTranslation();
  return (
    <Pressable
      testID={`progress-action-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={t('progress.openAction', {
        defaultValue: 'Open action for {{name}}',
        name: label,
      })}
      disabled={disabled}
      onPress={onOpen}
      className="min-h-11 min-w-11 items-center justify-center"
    >
      <Icon name={icon} size={22} color={color} />
    </Pressable>
  );
}
function HabitAction(props: Props) {
  const { t } = useTranslation();
  const { isConnected } = useServerConnection();
  const { preferences } = usePreferences();
  const today = () =>
    todayInZone(
      preferences?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  const [editing, setEditing] = useState(false);
  const busy = useRef(false);
  const habits = useHabits({ enabled: isConnected });
  const logs = useHabitLogs(props.date, props.date, { enabled: isConnected });
  const save = useLogHabit(props.date, props.date);
  const habit = habits.data?.find((row) => row.id === props.item.reference_id);
  const log = logs.data?.find(
    (row) => row.habit_id === props.item.reference_id
  );
  const saveHabit = (value: boolean | number | null) => {
    if (!habit || busy.current || props.date > today()) return;
    busy.current = true;
    save.mutate(
      { habitId: habit.id, body: { entry_date: props.date, value } },
      {
        onSuccess: () => setEditing(false),
        onError: () =>
          Toast.show({
            type: 'error',
            text1: t('habits.saveFailed', {
              defaultValue: 'Could not save. Please try again.',
            }),
          }),
        onSettled: () => {
          busy.current = false;
        },
      }
    );
  };
  const act = () => {
    if (props.date > today()) {
      props.onOpen();
      return;
    }
    if (habit && isConnected) {
      if (
        habit.habit_type === 'completion' &&
        habitDayState(habit, log) !== 'complete'
      )
        saveHabit(true);
      else setEditing(true);
    } else props.onOpen();
  };
  return (
    <>
      <ActionButton {...props} disabled={save.isPending} onOpen={act} />
      <Modal
        visible={editing}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center bg-black/50 p-4"
        >
          <View
            className="rounded-2xl bg-surface p-4 gap-3"
            style={{ maxHeight: '85%' }}
          >
            <Text className="text-lg font-bold text-text-primary">
              {props.label}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {habit && (
                <HabitRow
                  habit={habit}
                  log={log}
                  timeLabel={null}
                  tint={props.color}
                  saving={save.isPending}
                  onSave={saveHabit}
                  onEdit={() => {
                    setEditing(false);
                    props.onOpen();
                  }}
                  showDivider={false}
                />
              )}
            </ScrollView>
            <Button variant="secondary" onPress={() => setEditing(false)}>
              {t('common.close', { defaultValue: 'Close' })}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
function MealAction(props: Props) {
  const { t } = useTranslation();
  const { isConnected } = useServerConnection();
  const { preferences } = usePreferences();
  const today = () =>
    todayInZone(
      preferences?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  const meals = useMealTrackingStatus(props.date, { enabled: isConnected });
  const save = useSetMealStatus(props.date);
  const meal = meals.data?.meals.find(
    (row) => row.meal_type_id === props.item.reference_id
  );
  return meal && isConnected && props.date <= today() ? (
    <MealStatusControl
      mealLabel={props.label}
      state={meal.state}
      busy={save.isPending}
      onChange={(status) => {
        if (props.date > today()) return;
        save.mutate(
          { entry_date: props.date, meal_type_id: meal.meal_type_id, status },
          {
            onError: () =>
              Toast.show({
                type: 'error',
                text1: t('mealStatus.saveFailed', {
                  defaultValue: 'Could not save the meal status.',
                }),
              }),
          }
        );
      }}
    />
  ) : (
    <ActionButton {...props} />
  );
}
/** Separate recording controls from detail navigation; numeric goals are never auto-completed. */
export default function ProgressItemAction(props: Props) {
  if (props.item.domain === 'habit') return <HabitAction {...props} />;
  if (props.item.domain === 'meal') return <MealAction {...props} />;
  return <ActionButton {...props} />;
}
