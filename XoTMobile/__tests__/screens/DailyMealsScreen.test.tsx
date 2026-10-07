import React from 'react';
import { render } from '@testing-library/react-native';
import DailyMealsScreen from '../../src/screens/DailyMealsScreen';
import type FoodSummary from '../../src/components/FoodSummary';
let mockGoal = 0;
jest.mock('@workspace/shared', () => ({
  ...jest.requireActual('@workspace/shared'),
  todayInZone: () => '2026-10-07',
}));
let mockFoodProps: React.ComponentProps<typeof FoodSummary>;
jest.mock('../../src/hooks', () => ({
  useDailySummary: () => ({
    summary: {
      foodEntries: [],
      calorieGoal: mockGoal,
      calorieBalance: {
        eaten: 600,
        burned: 0,
        remaining: mockGoal - 600,
        goal: mockGoal,
      },
      protein: { consumed: 30 },
      carbs: { consumed: 70 },
      fat: { consumed: 20 },
    },
    refetch: jest.fn(),
  }),
  usePreferences: () => ({ preferences: { timezone: 'Europe/Berlin' } }),
  useMealTypes: () => ({ mealTypes: [], refetch: jest.fn() }),
  useServerConnection: () => ({ isConnected: true }),
}));
jest.mock('../../src/utils/dateUtils', () => ({
  ...jest.requireActual('../../src/utils/dateUtils'),
  getTodayDate: () => '2026-10-07',
}));
jest.mock('../../src/hooks/useDailyTracking', () => ({
  useMealTrackingStatus: () => ({ data: { meals: [] }, refetch: jest.fn() }),
  useSetMealStatus: () => ({ isPending: false, mutate: jest.fn() }),
}));
jest.mock('../../src/hooks/useDiaryFoodEditing', () => ({
  useDiaryFoodEditing: () => ({
    editingFoods: false,
    selectedFoodIds: new Set(),
    setEditingFoods: jest.fn(),
  }),
}));
jest.mock('../../src/hooks/useFoodDragScroll', () => ({
  useFoodDragScroll: () => ({}),
}));
jest.mock('../../src/hooks/useNutritionDiaryActions', () => ({
  useNutritionDiaryActions: () => ({
    actions: [],
    photoCompletionActions: [],
    photoActions: [],
  }),
}));
jest.mock('../../src/hooks/useNutritionCapturesByDate', () => ({
  useNutritionCapturesByDate: () => ({ captures: [] }),
}));
jest.mock('../../src/components/DailyDetailScreen', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) => <View>{children}</View>,
  };
});
jest.mock('../../src/components/FoodSummary', () => ({
  __esModule: true,
  default: (props: React.ComponentProps<typeof FoodSummary>) => {
    mockFoodProps = props;
    return null;
  },
}));
jest.mock('../../src/components/ServingAdjustSheet', () => {
  const React = require('react');
  return { __esModule: true, default: React.forwardRef(() => null) };
});
jest.mock('../../src/components/PendingNutritionActions', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/components/NutritionPhotoEntries', () => ({
  __esModule: true,
  default: () => null,
}));
const navigation = { navigate: jest.fn() } as never;
beforeEach(() => {
  mockGoal = 0;
});
it('shows known intake and an unset target without an over-target or remaining claim', () => {
  const view = render(
    <DailyMealsScreen
      navigation={navigation}
      route={{ params: { date: '2026-10-07' } } as never}
    />
  );
  expect(view.getByText(/600 kcal/)).toBeTruthy();
  expect(view.getByText('No daily calorie target set')).toBeTruthy();
  expect(view.queryByText(/over target|remaining|Daily allowance/)).toBeNull();
  mockGoal = 2000;
  view.rerender(
    <DailyMealsScreen
      navigation={navigation}
      route={{ params: { date: '2026-10-07' } } as never}
    />
  );
  expect(view.getByText(/remaining/)).toBeTruthy();
  expect(view.getByText(/Daily allowance/)).toBeTruthy();
});
it('retains future meal details while withholding recording state controls', () => {
  render(
    <DailyMealsScreen
      navigation={navigation}
      route={{ params: { date: '2026-10-08' } } as never}
    />
  );
  expect(mockFoodProps.onSetMealStatus).toBeUndefined();
  expect(mockFoodProps.onPressMealType).toEqual(expect.any(Function));
});
