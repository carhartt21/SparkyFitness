import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CalorieRingCard from '../../src/components/CalorieRingCard';
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
