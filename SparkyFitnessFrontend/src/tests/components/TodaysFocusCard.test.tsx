import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  LoggingStreakBadge,
  TodaysFocusCard,
} from '@/pages/Diary/TodaysFocusCard';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    energyUnit: 'kcal' as const,
    convertEnergy: (value: number) => value,
    water_display_unit: 'ml' as const,
  }),
}));

// The real module initializes app i18n on import; only the ml conversion is used.
jest.mock('@/utils/nutritionCalculations', () => ({
  convertMlToSelectedUnit: (ml: number) => ml,
}));

jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({ activeUserId: 'user-1' }),
}));

const mockTrendData = jest.fn();
jest.mock('@/hooks/Foods/useFoods', () => ({
  useMiniNutritionTrendData: (...args: unknown[]) => mockTrendData(...args),
}));

describe('TodaysFocusCard', () => {
  it('lists only configured goals with their progress and opens Goals', () => {
    const onEditGoals = jest.fn();
    render(
      <TodaysFocusCard
        caloriesEaten={1420}
        calorieGoal={2200}
        proteinConsumed={80}
        proteinGoal={0}
        waterMl={1800}
        waterGoalMl={2500}
        foodEntryCount={3}
        onEditGoals={onEditGoals}
      />
    );

    expect(screen.getByTestId('focus-energy')).toHaveTextContent(
      '1,420 of 2,200 kcal'
    );
    expect(screen.getByTestId('focus-energy')).toHaveTextContent('Done');
    expect(screen.queryByTestId('focus-protein')).not.toBeInTheDocument();
    expect(screen.getByTestId('focus-water')).toHaveTextContent('Not yet');
    expect(screen.getByTestId('focus-logged')).toHaveTextContent('3 entries');

    fireEvent.click(screen.getByRole('button', { name: /edit goals/i }));
    expect(onEditGoals).toHaveBeenCalledTimes(1);
  });
});

describe('LoggingStreakBadge', () => {
  it('shows the consecutive logged days ending at the selected day', () => {
    mockTrendData.mockReturnValue({
      data: [
        { date: '2026-09-26' },
        { date: '2026-09-27' },
        { date: '2026-09-28' },
      ],
      isLoading: false,
      isError: false,
    });
    render(<LoggingStreakBadge selectedDate="2026-09-28" />);

    expect(screen.getByTestId('logging-streak')).toHaveTextContent('3');
    expect(mockTrendData).toHaveBeenCalledWith(
      'user-1',
      '2026-07-01',
      '2026-09-28'
    );
  });

  it('renders nothing without a current streak', () => {
    mockTrendData.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    const { container } = render(
      <LoggingStreakBadge selectedDate="2026-09-28" />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
