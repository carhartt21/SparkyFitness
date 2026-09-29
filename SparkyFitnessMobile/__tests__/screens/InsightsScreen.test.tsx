import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import InsightsScreen from '../../src/screens/InsightsScreen';
import { useServerConnection } from '../../src/hooks';
import { useNutritionTrends } from '../../src/hooks/useNutritionTrends';
import { useMeasurementsRange } from '../../src/hooks/useMeasurementsRange';

type ScreenProps = React.ComponentProps<typeof InsightsScreen>;

const navigation = {
  navigate: jest.fn(),
} as unknown as ScreenProps['navigation'];
const route = {
  key: 'Insights-1',
  name: 'Insights',
  params: undefined,
} as unknown as ScreenProps['route'];

jest.mock('../../src/hooks', () => ({
  useServerConnection: jest.fn(),
  usePreferences: () => ({ preferences: { default_weight_unit: 'kg' } }),
  useDailySummary: () => ({ summary: { calorieGoal: 2000 } }),
}));
jest.mock('../../src/hooks/useNutritionTrends', () => ({
  useNutritionTrends: jest.fn(),
}));
jest.mock('../../src/hooks/useMeasurementsRange', () => ({
  useMeasurementsRange: jest.fn(),
}));
jest.mock('../../src/hooks/useDailyTracking', () => ({
  useDailyCheckinsRange: () => ({ data: [] }),
}));
jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: () => 0,
}));
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSTabsActive: () => false,
}));
jest.mock('../../src/components/NutrientBarChart', () => () => null);
jest.mock('../../src/components/WeightLineChart', () => () => null);
jest.mock('../../src/components/MacroCompositionRing', () => () => null);
jest.mock('../../src/utils/dateUtils', () => ({
  ...jest.requireActual('../../src/utils/dateUtils'),
  getTodayDate: () => '2026-09-28',
}));

const mockUseServerConnection = useServerConnection as jest.MockedFunction<
  typeof useServerConnection
>;
const mockUseNutritionTrends = useNutritionTrends as jest.MockedFunction<
  typeof useNutritionTrends
>;
const mockUseMeasurementsRange = useMeasurementsRange as jest.MockedFunction<
  typeof useMeasurementsRange
>;

const renderScreen = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <InsightsScreen navigation={navigation} route={route} />
    </SafeAreaProvider>
  );

describe('InsightsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseServerConnection.mockReturnValue({
      isConnected: true,
      isLoading: false,
    } as ReturnType<typeof useServerConnection>);
    mockUseNutritionTrends.mockReturnValue({
      data: [
        { date: '2026-09-27', calories: 0, protein: 0, carbs: 0, fat: 0 },
        {
          date: '2026-09-28',
          calories: 1800,
          protein: 90,
          carbs: 200,
          fat: 60,
        },
      ],
      recordedDates: new Set(['2026-09-28']),
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useNutritionTrends>);
    mockUseMeasurementsRange.mockReturnValue({
      stepsData: [],
      weightData: [
        { day: '2026-09-01', weight: 80 },
        { day: '2026-09-28', weight: 78.5 },
      ],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useMeasurementsRange>);
  });

  it('shows averages, goal difference, weight change and logging consistency from real data', () => {
    const screen = renderScreen();

    expect(screen.getByTestId('insights-average-calories')).toHaveTextContent(
      /1,800/
    );
    expect(screen.getByTestId('insights-vs-goal')).toHaveTextContent(/-200/);
    expect(screen.getByTestId('insights-weight-change')).toHaveTextContent(
      /-1.5 kg/
    );
    expect(screen.getByTestId('insights-consistency')).toHaveTextContent(
      'You logged food on 1 of the last 2 days.'
    );
  });

  it('opens Settings from the upper-left button and details with today', () => {
    const screen = renderScreen();

    fireEvent.press(screen.getByTestId('open-settings'));
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');

    fireEvent.press(screen.getByText('View details'));
    expect(navigation.navigate).toHaveBeenCalledWith('DailyNutritionDetails', {
      date: '2026-09-28',
    });
  });

  it('explains when the server is not connected', () => {
    mockUseServerConnection.mockReturnValue({
      isConnected: false,
      isLoading: false,
    } as ReturnType<typeof useServerConnection>);

    const screen = renderScreen();

    expect(screen.getByText('Insights unavailable')).toBeTruthy();
    fireEvent.press(screen.getByText('Go to Settings'));
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');
  });
});
