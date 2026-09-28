import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Habit } from '@workspace/shared';
import TrackingScreen from '../components/tracking/TrackingScreen';
import { habitIcon } from '../components/tracking/habitIcons';
import { useNeonScale } from '../components/tracking/useNeonScale';
import GlowCard from '../components/ui/GlowCard';
import NeonButton from '../components/ui/NeonButton';
import StatusView from '../components/StatusView';
import Icon from '../components/Icon';
import { useHabitMutations, useHabits } from '../hooks/useDailyTracking';
import { localizedWeekdayLabels } from '../utils/medicationScheduleLocalization';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'HabitsManage'>;

/** All habits, including archived ones, with order controls. */
const HabitsManageScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const scale = useNeonScale();
  const [primary, secondary, border] = useCSSVariable([
    '--color-text-primary',
    '--color-text-secondary',
    '--color-border-subtle',
  ]) as [string, string, string];
  const habitsQuery = useHabits({ includeInactive: true });
  const { update } = useHabitMutations();
  const habits = habitsQuery.data ?? [];
  const weekdays = localizedWeekdayLabels(t);

  const scheduleLabel = (habit: Habit) =>
    habit.days === null || habit.days.length === 7
      ? t('habits.everyDay', { defaultValue: 'Every day' })
      : habit.days
          .slice()
          .sort()
          .map((day) => weekdays[day]?.slice(0, 3))
          .join(', ');

  // Swap with the neighbour, then renumber by position and save only rows
  // whose stored order changed.
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= habits.length) return;
    const reordered = habits.slice();
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    reordered.forEach((habit, position) => {
      if (habit.sort_order !== position) {
        update.mutate({ id: habit.id, body: { sort_order: position } });
      }
    });
  };

  return (
    <TrackingScreen
      testID="habits-manage-screen"
      title={t('habits.editHabits', { defaultValue: 'Edit habits' })}
      subtitle={t('habits.manageListSubtitle', {
        defaultValue: 'Order, schedule and archive your habits.',
      })}
      onBack={navigation.goBack}
      onRefresh={() => habitsQuery.refetch()}
    >
      <NeonButton
        testID="habits-manage-add"
        icon="add"
        label={t('habits.addHabit', { defaultValue: 'Add habit' })}
        onPress={() => navigation.navigate('HabitForm')}
        className="mb-3"
      />
      {habitsQuery.isLoading ? (
        <StatusView
          loading
          title={t('habits.loading', { defaultValue: 'Loading habits…' })}
        />
      ) : (
        <GlowCard className="px-4">
          {habits.length === 0 ? (
            <Text className="py-4 text-sm text-text-secondary">
              {t('habits.emptyTitle', { defaultValue: 'No habits yet' })}
            </Text>
          ) : (
            habits.map((habit, index) => (
              <View
                key={habit.id}
                className="flex-row items-center gap-3 py-3"
                style={
                  index > 0
                    ? { borderTopWidth: 1, borderTopColor: border }
                    : undefined
                }
              >
                <Icon
                  name={habitIcon(habit.icon)}
                  size={22}
                  color={habit.active ? scale.green : secondary}
                />
                <Pressable
                  className="flex-1"
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate('HabitForm', { habitId: habit.id })
                  }
                  testID={`habits-manage-row-${habit.id}`}
                >
                  <Text className="text-base font-semibold text-text-primary">
                    {habit.name}
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    {[
                      habit.habit_type === 'count'
                        ? t('habits.typeCount', { defaultValue: 'Count' })
                        : t('habits.typeCompletion', {
                            defaultValue: 'Done / not done',
                          }),
                      scheduleLabel(habit),
                      habit.active
                        ? null
                        : t('habits.archived', { defaultValue: 'Archived' }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('habits.moveUp', {
                    defaultValue: 'Move {{name}} up',
                    name: habit.name,
                  })}
                  disabled={index === 0}
                  onPress={() => move(index, -1)}
                  className="h-11 w-9 items-center justify-center"
                  style={{ opacity: index === 0 ? 0.3 : 1 }}
                >
                  <Icon name="chevron-up" size={18} color={primary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('habits.moveDown', {
                    defaultValue: 'Move {{name}} down',
                    name: habit.name,
                  })}
                  disabled={index === habits.length - 1}
                  onPress={() => move(index, 1)}
                  className="h-11 w-9 items-center justify-center"
                  style={{ opacity: index === habits.length - 1 ? 0.3 : 1 }}
                >
                  <Icon name="chevron-down" size={18} color={primary} />
                </Pressable>
              </View>
            ))
          )}
        </GlowCard>
      )}
    </TrackingScreen>
  );
};

export default HabitsManageScreen;
