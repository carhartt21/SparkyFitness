import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Alert, Dimensions } from 'react-native';
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

  it('does not save an abandoned keyboard draft on blur or unmount', () => {
    const { screen, onSave } = renderRow();
    const amount = screen.getByTestId('habit-amount-h1');
    fireEvent.changeText(amount, '5');
    fireEvent(amount, 'blur');
    screen.unmount();
    expect(onSave).not.toHaveBeenCalled();
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

describe('long German habit names', () => {
  const longName =
    'Tägliche Gleichgewichtsübungen mit langsamer Atmung und anschließendem Entspannungsspaziergang im Stadtpark';
  it.each([1, 2])(
    'keeps the literal name readable without shrinking at fontScale %s and preserves explicit draft actions',
    (fontScale) => {
      const window = Dimensions.get('window');
      const screenSize = Dimensions.get('screen');
      Dimensions.set({
        window: { ...window, width: 390, fontScale },
        screen: { ...screenSize, width: 390, fontScale },
      });
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      try {
        const { screen, onSave } = renderRow({
          habit: habit({ name: longName }),
        });
        const name = screen.getByText(longName);
        if (fontScale >= 1.5) {
          expect(
            screen.getByTestId('habit-name-block-h1').findAllByType(name.type)
          ).toHaveLength(1);
          expect(screen.getByTestId('habit-actions-h1')).toBeTruthy();
        } else {
          expect(screen.queryByTestId('habit-actions-h1')).toBeNull();
        }
        // RN's native contract: zero/omitted line limit allows natural height.
        // Jest has no Yoga/text rasterizer; this asserts the actual Text contract,
        // not a screenshot, pixel layout or physical Dynamic Type acceptance.
        expect(name.props.numberOfLines ?? 0).toBe(0);
        expect(name.props.allowFontScaling).not.toBe(false);
        expect(name.props.adjustsFontSizeToFit).not.toBe(true);
        expect(Dimensions.get('window').fontScale).toBe(fontScale);
        const amount = screen.getByTestId('habit-amount-h1');
        fireEvent.changeText(amount, '12,5');
        fireEvent(amount, 'blur');
        expect(onSave).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('habit-menu-h1'));
        expect(alert).toHaveBeenCalledWith(
          longName,
          undefined,
          expect.any(Array)
        );
        expect(onSave).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('habit-save-h1'));
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith(12.5);
        screen.unmount();
      } finally {
        alert.mockRestore();
        Dimensions.set({ window, screen: screenSize });
      }
    }
  );
});

describe('long completion habit names', () => {
  it.each([1, 2])(
    'keeps a long completion title readable at fontScale %s with explicit Done',
    (fontScale) => {
      const window = Dimensions.get('window');
      const screenSize = Dimensions.get('screen');
      Dimensions.set({
        window: { ...window, width: 390, fontScale },
        screen: { ...screenSize, width: 390, fontScale },
      });
      try {
        const name =
          'Abendliche Entspannungsroutine mit bewusstem Atemrhythmus und einer abschließenden ruhigen Dehnungsübung';
        const { screen, onSave } = renderRow({
          habit: habit({
            name,
            habit_type: 'completion',
            target: null,
            unit: null,
          }),
        });
        expect(screen.getByText(name).props.numberOfLines ?? 0).toBe(0);
        if (fontScale >= 1.5)
          expect(screen.getByTestId('habit-actions-h1')).toBeTruthy();
        expect(screen.getByText(name).props.allowFontScaling).not.toBe(false);
        expect(screen.getByText(name).props.adjustsFontSizeToFit).not.toBe(
          true
        );
        expect(onSave).not.toHaveBeenCalled();
        fireEvent.press(screen.getByTestId('habit-done-h1'));
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith(true);
        screen.unmount();
      } finally {
        Dimensions.set({ window, screen: screenSize });
      }
    }
  );
});
