import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { Habit, HabitLog } from '@workspace/shared';
import HabitRow from '../../src/components/tracking/HabitRow';

const habit = (overrides: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  name: 'Pull-ups',
  habit_type: 'count',
  description: null,
  unit: 'reps',
  target: 10,
  step: null,
  days: null,
  reminder_time: null,
  active: true,
  sort_order: 0,
  icon: null,
  ...overrides,
});

const log = (value: number): HabitLog => ({
  habit_id: 'h1',
  entry_date: '2026-09-28',
  value,
  recorded_at: 't',
});

const renderRow = (
  props: Partial<React.ComponentProps<typeof HabitRow>> = {}
) => {
  const onSave = jest.fn();
  const screen = render(
    <HabitRow
      habit={habit()}
      log={undefined}
      timeLabel={null}
      tint="#3ff276"
      saving={false}
      onSave={onSave}
      onEdit={jest.fn()}
      showDivider={false}
      {...props}
    />
  );
  return { screen, onSave };
};

describe('HabitRow', () => {
  it('saves a count only after an explicit Save', () => {
    const { screen, onSave } = renderRow();
    fireEvent.changeText(screen.getByTestId('habit-amount-h1'), '14');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('habit-save-h1'));
    expect(onSave).toHaveBeenCalledWith(14);
  });

  it('keeps an explicit 0 as a value to save', () => {
    const { screen, onSave } = renderRow();
    fireEvent.changeText(screen.getByTestId('habit-amount-h1'), '0');
    fireEvent.press(screen.getByTestId('habit-save-h1'));
    expect(onSave).toHaveBeenCalledWith(0);
  });

  it('starts from the saved value, not a suggestion, and offers no Save until it changes', () => {
    const { screen, onSave } = renderRow({ log: log(12) });
    expect(screen.getByTestId('habit-amount-h1').props.value).toBe('12');
    fireEvent.press(screen.getByTestId('habit-save-h1'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows +/− only when a step is configured and never saves from them', () => {
    const plain = renderRow();
    expect(plain.screen.queryByTestId('habit-increment-h1')).toBeNull();
    const stepped = renderRow({ habit: habit({ step: 2 }) });
    fireEvent.press(stepped.screen.getByTestId('habit-increment-h1'));
    fireEvent.press(stepped.screen.getByTestId('habit-increment-h1'));
    expect(stepped.onSave).not.toHaveBeenCalled();
    expect(stepped.screen.getByTestId('habit-amount-h1').props.value).toBe('4');
    fireEvent.press(stepped.screen.getByTestId('habit-save-h1'));
    expect(stepped.onSave).toHaveBeenCalledWith(4);
  });

  it('marks a completion habit done and undoes it', () => {
    const completion = habit({
      habit_type: 'completion',
      target: null,
      unit: null,
    });
    const open = renderRow({ habit: completion });
    fireEvent.press(open.screen.getByTestId('habit-done-h1'));
    expect(open.onSave).toHaveBeenCalledWith(true);
    const done = renderRow({ habit: completion, log: log(1) });
    fireEvent.press(done.screen.getByTestId('habit-done-h1'));
    expect(done.onSave).toHaveBeenCalledWith(null);
  });
});
