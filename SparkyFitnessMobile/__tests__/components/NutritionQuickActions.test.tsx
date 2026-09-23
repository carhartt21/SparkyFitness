import { fireEvent, render, waitFor } from '@testing-library/react-native';
import NutritionQuickActions from '../../src/components/NutritionQuickActions';
import { useCachedNutritionFavorites } from '../../src/hooks/useCachedNutritionFavorites';
import {
  logFavoriteFood,
  logQuickNutrition,
} from '../../src/services/quickNutritionLog';

jest.mock('../../src/hooks/useCachedNutritionFavorites', () => ({
  useCachedNutritionFavorites: jest.fn(),
}));
jest.mock('../../src/services/quickNutritionLog', () => ({
  logFavoriteFood: jest.fn().mockResolvedValue({}),
  logQuickNutrition: jest.fn().mockResolvedValue({}),
}));

const mockCache = useCachedNutritionFavorites as jest.Mock;

describe('NutritionQuickActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.mockReturnValue({
      storageError: false,
      cache: {
        version: 1,
        updatedAt: '2026-09-23T12:00:00.000Z',
        foods: [{ id: 'food-1', name: 'Synthetic bar', default_variant: {} }],
        mealTypes: [{ id: 'lunch', is_visible: true }],
      },
    });
  });

  test('one tap logs a cached favorite through the shared service', async () => {
    const screen = render(<NutritionQuickActions />);
    fireEvent.press(screen.getByLabelText('Log Synthetic bar'));
    await waitFor(() => expect(logFavoriteFood).toHaveBeenCalledWith('food-1'));
  });

  test('manual calories leave absent macros unspecified', async () => {
    const screen = render(<NutritionQuickActions />);
    fireEvent.press(screen.getByText('+ Calories and macros'));
    fireEvent.changeText(screen.getByPlaceholderText('Calories'), '140');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() =>
      expect(logQuickNutrition).toHaveBeenCalledWith({
        calories: 140,
        protein: undefined,
        carbs: undefined,
        fat: undefined,
      })
    );
  });
});
