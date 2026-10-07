import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CalorieRingCard from '../../src/components/CalorieRingCard';
import { StyleSheet } from 'react-native';
import { useCSSVariable } from 'uniwind';
const base = {
  caloriesConsumed: 600,
  caloriesBurned: 0,
  burnedIncludesBmr: false,
  calorieGoal: 2000,
  remainingCalories: 1400,
  progressPercent: 0.3,
};
it('opens meals from the gauge and keeps editing the target separate', () => {
  const meals = jest.fn(),
    edit = jest.fn();
  const view = render(
    <CalorieRingCard {...base} onConsumedPress={meals} onEditGoal={edit} />
  );
  fireEvent.press(view.getByTestId('dashboard-energy-consumed'));
  expect(meals).toHaveBeenCalledTimes(1);
  expect(edit).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('dashboard-edit-goal'));
  expect(edit).toHaveBeenCalledTimes(1);
  expect(view.getByText('600')).toBeTruthy();
  expect(view.getByTestId('dashboard-energy-goal')).toHaveTextContent('2,000');
  expect(view.getByTestId('dashboard-energy-consumed')).toHaveAccessibleName(
    '600 kcal, of 2,000 kcal. Open daily meals.'
  );
  expect(view.queryByTestId('dashboard-energy-burned')).toBeNull();
});
it('uses the existing credited allowance without crediting burned energy again', () => {
  const view = render(
    <CalorieRingCard
      {...base}
      caloriesConsumed={1500}
      caloriesBurned={500}
      remainingCalories={800}
    />
  );
  expect(view.getByText('1,500')).toBeTruthy();
  expect(view.getByText('2,300')).toBeTruthy();
  expect(view.queryByText('800')).toBeNull();
});
it('keeps actual intake visible above goal and distinguishes an unavailable goal', () => {
  const view = render(<CalorieRingCard {...base} remainingCalories={-200} />);
  expect(view.getByText('600')).toBeTruthy();
  expect(view.getByText('400')).toBeTruthy();
  view.rerender(
    <CalorieRingCard {...base} calorieGoal={0} remainingCalories={0} />
  );
  expect(view.getByText('600')).toBeTruthy();
  expect(view.getByText('No daily calorie target set')).toBeTruthy();
  expect(view.queryByText('of')).toBeNull();
});

it('shows separate bounded progress for macros and water with actual amounts in accessible names', () => {
  const view = render(
    <CalorieRingCard
      {...base}
      protein={{ consumed: 30, goal: 150 }}
      carbs={{ consumed: 80, goal: 250 }}
      fat={{ consumed: 100, goal: 67 }}
      water={{ consumed: 1000, goal: 2500 }}
    />
  );
  expect(view.getByTestId('intake-progress-protein')).toHaveAccessibleName(
    'Protein: 30 of 150 g, 20%.'
  );
  expect(view.getByTestId('intake-progress-water')).toHaveAccessibleName(
    'Water: 1,000 of 2,500 ml, 40%.'
  );
  expect(view.getByTestId('intake-progress-fat')).toHaveProp(
    'accessibilityValue',
    { min: 0, max: 100, now: 100, text: '149%' }
  );
  expect(
    StyleSheet.flatten(view.getByTestId('intake-progress-fat-fill').props.style)
      .width
  ).toBe('100%');
});

it('distinguishes unknown values and missing denominators from known zero progress', () => {
  const view = render(
    <CalorieRingCard
      {...base}
      protein={{ consumed: 0, goal: 150 }}
      carbs={{ consumed: 80, goal: 0 }}
      water={{ consumed: NaN, goal: 2500 }}
    />
  );
  expect(view.getByTestId('intake-progress-protein')).toHaveAccessibleName(
    'Protein: 0 of 150 g, 0%.'
  );
  expect(view.getByTestId('intake-progress-carbs')).toHaveAccessibleName(
    'Carbs: 80 g. No target set.'
  );
  expect(view.getByTestId('intake-progress-fat')).toHaveAccessibleName(
    'Fat unavailable.'
  );
  expect(view.getByTestId('intake-progress-water')).toHaveAccessibleName(
    'Water unavailable.'
  );
  expect(view.getByTestId('intake-progress-water')).not.toHaveProp(
    'accessibilityValue'
  );
});

it('changes only the intake glow against the adjusted allowance and omits it without a goal', () => {
  const original = jest.mocked(useCSSVariable).getMockImplementation();
  const colors: Record<string, string> = {
    '--color-neon-green': '#11cc66',
    '--color-neon-red': '#ee3344',
  };
  jest
    .mocked(useCSSVariable)
    .mockImplementation((variables) =>
      Array.isArray(variables)
        ? variables.map((key) => colors[key] ?? '#888888')
        : (colors[variables] ?? '#888888')
    );
  try {
    const view = render(
      <CalorieRingCard
        {...base}
        caloriesConsumed={2200}
        remainingCalories={300}
      />
    );
    expect(
      StyleSheet.flatten(
        view.getByTestId('dashboard-energy-intake').props.style
      ).textShadowColor
    ).toMatch(/^#11cc66/);
    view.rerender(
      <CalorieRingCard
        {...base}
        caloriesConsumed={2200}
        remainingCalories={-200}
      />
    );
    expect(
      StyleSheet.flatten(
        view.getByTestId('dashboard-energy-intake').props.style
      ).textShadowColor
    ).toMatch(/^#ee3344/);
    view.rerender(
      <CalorieRingCard {...base} calorieGoal={0} remainingCalories={0} />
    );
    expect(
      StyleSheet.flatten(
        view.getByTestId('dashboard-energy-intake').props.style
      )?.textShadowColor
    ).toBeUndefined();
  } finally {
    jest.mocked(useCSSVariable).mockImplementation(original!);
  }
});
