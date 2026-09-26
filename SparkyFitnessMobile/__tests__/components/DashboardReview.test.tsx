import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import DashboardHeader from '../../src/components/DashboardHeader';
import DashboardDayOverview from '../../src/components/DashboardDayOverview';
import CalorieRingCard from '../../src/components/CalorieRingCard';
import i18n, { initializeI18n } from '../../src/localization/i18n';
import de from '../../src/localization/locales/de/translation.json';
import en from '../../src/localization/locales/en/translation.json';
import { summaryFixture } from '../../review/fixtures';
import type { DailySummary } from '../../src/types/dailySummary';

jest.mock('../../src/hooks/useMealTypes', () => ({
  useMealTypes: () => ({ mealTypes: [] }),
}));
jest.mock('../../src/components/ProgressRing', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="progress-ring" /> };
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

it('localizes the actual dashboard date and keeps all date destinations operable', async () => {
  await initializeI18n('de');
  const handlers = {
    onPreviousDay: jest.fn(),
    onNextDay: jest.fn(),
    onToday: jest.fn(),
    onDatePress: jest.fn(),
  };
  const screen = render(
    <DashboardHeader selectedDate="2026-09-26" {...handlers} />
  );
  expect(screen.getByText(/Sa.*26.*Sept/)).toBeTruthy();
  expect(screen.getByText('Heute')).toBeTruthy();
  const buttons = screen.getAllByRole('button');
  buttons.forEach((button) => fireEvent.press(button));
  Object.values(handlers).forEach((handler) =>
    expect(handler).toHaveBeenCalledTimes(1)
  );
});

it('has German translations with matching interpolation variables for every dashboard key', () => {
  for (const [key, value] of Object.entries(en.dashboard)) {
    const translated = de.dashboard[key as keyof typeof de.dashboard];
    expect(typeof translated).toBe('string');
    expect(translated.match(/{{.*?}}/g)?.sort() ?? []).toEqual(
      value.match(/{{.*?}}/g)?.sort() ?? []
    );
  }
});

it('retains distinct historical meal IDs and reconciles meal calories without double counting', () => {
  const entries = [
    {
      ...summaryFixture.foodEntries[0],
      meal_type_id: 'old-a',
      meal_type: 'Review meal',
      calories: 600,
    },
    {
      ...summaryFixture.foodEntries[0],
      id: 'second',
      meal_type_id: 'old-b',
      meal_type: 'Review meal',
      calories: 250,
    },
  ];
  const open = jest.fn();
  const screen = render(
    <DashboardDayOverview
      summary={{ foodEntries: entries } as DailySummary}
      onOpenDiary={open}
    />
  );
  expect(screen.getAllByText('Review meal')).toHaveLength(2);
  expect(screen.getByText('600 kcal')).toBeTruthy();
  expect(screen.getByText('250 kcal')).toBeTruthy();
  fireEvent.press(screen.getAllByRole('button')[1]);
  expect(open).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/day may be incomplete/)).toBeTruthy();
});

it('shows over-target values without describing them as remaining allowance', () => {
  const screen = render(
    <CalorieRingCard
      caloriesConsumed={2300}
      caloriesBurned={0}
      burnedIncludesBmr={false}
      calorieGoal={2000}
      remainingCalories={-300}
      progressPercent={1.15}
    />
  );
  expect(screen.getByText('300')).toBeTruthy();
  expect(screen.getByText('over target')).toBeTruthy();
  expect(screen.queryByText('remaining')).toBeNull();
});

it('does not invent a remaining allowance when no target is configured', () => {
  const screen = render(
    <CalorieRingCard
      caloriesConsumed={600}
      caloriesBurned={0}
      burnedIncludesBmr={false}
      calorieGoal={0}
      remainingCalories={-600}
      progressPercent={0}
    />
  );
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.queryByText('remaining')).toBeNull();
  expect(screen.queryByText('over target')).toBeNull();
});
