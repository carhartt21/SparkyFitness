import { Text, Animated } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import MotionPressable from '../../src/components/ui/MotionPressable';
import ValueChangeFade from '../../src/components/ui/ValueChangeFade';
import MacroCard from '../../src/components/MacroCard';
import * as Reanimated from 'react-native-reanimated';

let mockMotion = { active: true, reducedMotion: false };
jest.mock('../../src/hooks/useMotionPreferences', () => ({
  useMotionPreferences: () => mockMotion,
}));

describe('widget motion', () => {
  beforeEach(() => {
    mockMotion = { active: true, reducedMotion: false };
  });
  afterEach(() => jest.restoreAllMocks());

  it('compresses/reverses a press and forwards the existing action callbacks', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const onPress = jest.fn(),
      onPressIn = jest.fn(),
      onPressOut = jest.fn();
    const { getByRole } = render(
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="Log"
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Text>Log</Text>
      </MotionPressable>
    );
    const button = getByRole('button');
    fireEvent(button, 'pressIn');
    expect(timing).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 0.985,
        duration: 100,
        useNativeDriver: true,
      })
    );
    fireEvent(button, 'pressOut');
    expect(timing).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, duration: 150 })
    );
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it.each(['reduced', 'hidden', 'disabled'] as const)(
    'does not compress when %s',
    (mode) => {
      mockMotion = {
        active: mode !== 'hidden',
        reducedMotion: mode === 'reduced',
      };
      const timing = jest.spyOn(Animated, 'timing');
      const onPress = jest.fn();
      const { getByRole } = render(
        <MotionPressable
          disabled={mode === 'disabled'}
          accessibilityRole="button"
          accessibilityLabel="Log"
          onPress={onPress}
        >
          <Text>Log</Text>
        </MotionPressable>
      );
      const button = getByRole('button');
      fireEvent(button, 'pressIn');
      fireEvent(button, 'pressOut');
      expect(timing).not.toHaveBeenCalled();
      fireEvent.press(button);
      expect(onPress).toHaveBeenCalledTimes(mode === 'disabled' ? 0 : 1);
    }
  );

  it('fades only actual changes, with immediately accurate text and no re-focus replay', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const { rerender, getByText, queryByText } = render(
      <ValueChangeFade changeKey={20}>
        <Text>20 kcal</Text>
      </ValueChangeFade>
    );
    expect(timing).not.toHaveBeenCalled();
    rerender(
      <ValueChangeFade changeKey={30}>
        <Text>30 kcal</Text>
      </ValueChangeFade>
    );
    expect(getByText('30 kcal')).toBeTruthy();
    expect(queryByText('20 kcal')).toBeNull();
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      })
    );
    timing.mockClear();
    rerender(
      <ValueChangeFade changeKey={30}>
        <Text>30 kcal</Text>
      </ValueChangeFade>
    );
    mockMotion.active = false;
    rerender(
      <ValueChangeFade changeKey={40}>
        <Text>40 kcal</Text>
      </ValueChangeFade>
    );
    mockMotion.active = true;
    rerender(
      <ValueChangeFade changeKey={40}>
        <Text>40 kcal</Text>
      </ValueChangeFade>
    );
    expect(timing).not.toHaveBeenCalled();
  });

  it('updates status without fading under Reduce Motion', () => {
    mockMotion.reducedMotion = true;
    const timing = jest.spyOn(Animated, 'timing');
    const { rerender, getByText } = render(
      <ValueChangeFade changeKey="pending">
        <Text>Pending</Text>
      </ValueChangeFade>
    );
    rerender(
      <ValueChangeFade changeKey="done">
        <Text>Done</Text>
      </ValueChangeFade>
    );
    expect(getByText('Done')).toBeTruthy();
    expect(timing).not.toHaveBeenCalled();
  });

  const macro = {
    label: 'Protein',
    consumed: 50,
    goal: 100,
    color: '#60A5FA',
    overfillColor: '#60A5FA',
  };
  it.each([true, false])(
    'shows the initial macro value without a zero entrance (row=%s)',
    (row) => {
      const timing = jest.spyOn(Reanimated, 'withTiming');
      const { rerender } = render(<MacroCard {...macro} row={row} />);
      expect(timing).not.toHaveBeenCalled();
      rerender(<MacroCard {...macro} row={row} consumed={70} />);
      expect(timing).toHaveBeenLastCalledWith(
        0.7,
        expect.objectContaining({ duration: 300 })
      );
      rerender(<MacroCard {...macro} row={row} consumed={40} />);
      expect(timing).toHaveBeenLastCalledWith(
        0.4,
        expect.objectContaining({ duration: 300 })
      );
      timing.mockClear();
      mockMotion.active = false;
      rerender(<MacroCard {...macro} row={row} consumed={30} />);
      mockMotion.active = true;
      rerender(<MacroCard {...macro} row={row} consumed={30} />);
      rerender(<MacroCard {...macro} row={row} consumed={30} />);
      expect(timing).not.toHaveBeenCalled();
    }
  );
});
