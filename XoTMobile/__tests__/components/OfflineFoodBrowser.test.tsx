import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import OfflineFoodBrowser from '../../src/components/foodSearch/OfflineFoodBrowser';
import { useCachedNutritionFavorites } from '../../src/hooks/useCachedNutritionFavorites';
import { offlineMeal } from '../helpers/offlineMealFixtures';

const mockPresent = jest.fn();
jest.mock('../../src/hooks/useCachedNutritionFavorites', () => ({
  useCachedNutritionFavorites: jest.fn(),
}));
jest.mock('../../src/components/foodSearch/QuickAddFoodSheet', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ present: mockPresent }));
      return null;
    }),
  };
});
const food = {
  id: 'favorite',
  name: 'Test apple',
  brand: 'Orchard',
  default_variant: {
    serving_size: 100,
    serving_unit: 'g',
    calories: 55,
    protein: 0.2,
    carbs: 12,
    fat: 0.1,
  },
};
const cache = {
  version: 1,
  updatedAt: '2026-10-12T12:00:00Z',
  foods: [food],
  savedFoods: [{ ...food, id: 'saved', name: 'Test pear' }],
  meals: [offlineMeal],
  favoriteMealIds: [offlineMeal.id],
  mealTypes: [
    {
      id: 'breakfast',
      name: 'Breakfast',
      sort_order: 0,
      is_visible: true,
      show_in_quick_log: true,
    },
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  (useCachedNutritionFavorites as jest.Mock).mockReturnValue({
    cache,
    identity: { serverConfigId: 'a', userId: 'owner' },
    isLoading: false,
    storageError: false,
  });
});
it('includes complete favorite meals and only the selected cached food scope', () => {
  const screen = render(
    <OfflineFoodBrowser search="" favoritesOnly date="2026-10-11" />
  );
  expect(screen.getByText('Test apple')).toBeTruthy();
  expect(screen.getByText(offlineMeal.name)).toBeTruthy();
  expect(screen.queryByText('Test pear')).toBeNull();
  fireEvent.press(screen.getByTestId(`offline-meal-${offlineMeal.id}`));
  expect(mockPresent).toHaveBeenCalledWith(
    expect.objectContaining({
      offlineMeal,
      default_variant: expect.objectContaining({ calories: 175 }),
    })
  );
});
it('searches local saved names and brands without a server lookup', () => {
  const screen = render(
    <OfflineFoodBrowser search="PEAR" favoritesOnly={false} date="2026-10-11" />
  );
  expect(screen.getByText('Test pear')).toBeTruthy();
  expect(screen.queryByText('Test apple')).toBeNull();
});
it('shows missing meal categories explicitly and cannot open a logging sheet', () => {
  (useCachedNutritionFavorites as jest.Mock).mockReturnValue({
    cache: { ...cache, mealTypes: [] },
    identity: { serverConfigId: 'a', userId: 'owner' },
    isLoading: false,
    storageError: false,
  });
  const screen = render(
    <OfflineFoodBrowser search="" favoritesOnly date="2026-10-11" />
  );
  fireEvent.press(screen.getByTestId('offline-food-favorite'));
  expect(mockPresent).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').props.children).toContain('meal categories');
});
it('does not present stale account data after a read failure', () => {
  (useCachedNutritionFavorites as jest.Mock).mockReturnValue({
    cache: null,
    identity: null,
    isLoading: false,
    storageError: true,
  });
  const screen = render(
    <OfflineFoodBrowser search="" favoritesOnly date="2026-10-11" />
  );
  expect(screen.queryByText('Test apple')).toBeNull();
  expect(screen.getByRole('alert').props.children).toContain(
    'could not be read'
  );
});
