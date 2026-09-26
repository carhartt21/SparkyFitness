import React from 'react';
import { render } from '@testing-library/react-native';
import CalorieRingCard from '../../src/components/CalorieRingCard';

jest.mock('uniwind', () => ({
  useCSSVariable: (keys: string[]) => keys.map(() => '#175b43'),
}));

jest.mock('../../src/components/ProgressRing', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="progress-ring" /> };
});

describe('CalorieRingCard', () => {
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
