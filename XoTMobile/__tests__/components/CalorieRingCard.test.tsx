import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import CalorieRingCard from '../../src/components/CalorieRingCard';

jest.mock('uniwind', () => ({
  useCSSVariable: (keys: string | string[]) =>
    Array.isArray(keys) ? keys.map(() => '#175b43') : '#175b43',
}));

jest.mock('../../src/components/ProgressRing', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="progress-ring" /> };
});

describe('CalorieRingCard', () => {
  it('keeps the moved goal action and all energy destinations working', () => {
    const editGoal = jest.fn();
    const consumed = jest.fn();
    const burned = jest.fn();
    const screen = render(
      <CalorieRingCard
        caloriesConsumed={600}
        caloriesBurned={0}
        burnedIncludesBmr={false}
        calorieGoal={2000}
        remainingCalories={1400}
        progressPercent={0.3}
        onEditGoal={editGoal}
        onConsumedPress={consumed}
        onBurnedPress={burned}
      />
    );
    fireEvent.press(screen.getByTestId('dashboard-edit-goal'));
    fireEvent.press(screen.getByTestId('dashboard-energy-goal'));
    fireEvent.press(screen.getByTestId('dashboard-energy-consumed'));
    fireEvent.press(screen.getByTestId('dashboard-energy-burned'));
    expect(editGoal).toHaveBeenCalledTimes(2);
    expect(consumed).toHaveBeenCalledTimes(1);
    expect(burned).toHaveBeenCalledTimes(1);
    expect(screen.getByText('remaining')).toBeTruthy();
  });
  it('distinguishes credited allowance from activity burn so the balance reconciles', () => {
    const screen = render(
      <CalorieRingCard
        caloriesConsumed={1500}
        caloriesBurned={500}
        burnedIncludesBmr={false}
        calorieGoal={2000}
        remainingCalories={800}
        progressPercent={0.6}
      />
    );

    expect(screen.getByText('Activity burned')).toBeTruthy();
    expect(screen.getByText(/Allowance adjustment/)).toBeTruthy();
    expect(screen.getByText(/\+300/)).toBeTruthy();
  });

  it('names total expenditure when BMR is included', () => {
    const screen = render(
      <CalorieRingCard
        caloriesConsumed={1500}
        caloriesBurned={1700}
        burnedIncludesBmr
        calorieGoal={2000}
        remainingCalories={2200}
        progressPercent={0}
      />
    );

    expect(screen.getByText('Total expenditure')).toBeTruthy();
  });
});
