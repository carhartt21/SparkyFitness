import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  createQueryWrapper,
  createTestQueryClient,
} from '../hooks/queryTestUtils';
import SwipeableFoodRow from '../../src/components/SwipeableFoodRow';
import type { FoodEntry } from '../../src/types/foodEntries';
import i18n, { initializeI18n } from '../../src/localization/i18n';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const createEntry = (overrides: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'entry-1',
  food_id: 'food-1',
  user_id: 'user-1',
  meal_type: 'breakfast',
  quantity: 100,
  unit: 'g',
  variant_id: 'variant-1',
  food_name: 'Greek Yogurt',
  brand_name: 'Sparky',
  entry_date: '2026-05-06',
  serving_size: 100,
  serving_unit: 'g',
  calories: 120,
  protein: 15,
  carbs: 8,
  fat: 2,
  ...overrides,
});

describe('SwipeableFoodRow', () => {
  beforeAll(async () => {
    await initializeI18n('en');
  });
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });
  const renderRow = (ui: React.ReactElement) =>
    render(ui, { wrapper: createQueryWrapper(createTestQueryClient()) });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['de', 'en'])(
    'formats fractional quantities consistently for sight and speech in %s',
    async (locale) => {
      await i18n.changeLanguage(locale);
      const entry = createEntry({ quantity: 3 * 7.1 });
      const quantityLabel = locale === 'de' ? '21,3 g' : '21.3 g';
      const screen = renderRow(
        <SwipeableFoodRow
          entry={entry}
          nutrition={{ calories: 72, protein: 0, carbs: 0, fat: 0 }}
        />
      );
      expect(screen.getByText(quantityLabel)).toBeTruthy();
      fireEvent.press(screen.getByLabelText(`Greek Yogurt, ${quantityLabel}`));
      expect(mockNavigate).toHaveBeenCalledWith('FoodEntryView', { entry });
      expect(entry.quantity).toBe(21.299999999999997);
    }
  );

  it('opens serving adjustment from the calorie affordance', () => {
    const entry = createEntry();
    const onAdjustServing = jest.fn();

    const screen = renderRow(
      <SwipeableFoodRow
        entry={entry}
        nutrition={{ calories: 120, protein: 15, carbs: 8, fat: 2 }}
        onAdjustServing={onAdjustServing}
      />
    );

    fireEvent.press(screen.getByText(/120 Cal/));

    expect(onAdjustServing).toHaveBeenCalledWith(entry);
  });

  it('opens the food entry view from the row body for standalone entries', () => {
    const entry = createEntry();

    const screen = renderRow(
      <SwipeableFoodRow
        entry={entry}
        nutrition={{ calories: 120, protein: 15, carbs: 8, fat: 2 }}
        onAdjustServing={jest.fn()}
      />
    );

    fireEvent.press(screen.getByText(/Greek Yogurt/));

    expect(mockNavigate).toHaveBeenCalledWith('FoodEntryView', { entry });
  });

  it('shows an imported entry source and exposes the full row as an edit action', () => {
    const entry = createEntry({
      food_name: 'Greek yogurt with berries and toasted oats',
      source: 'health_connect',
    });
    const screen = renderRow(
      <SwipeableFoodRow
        entry={entry}
        nutrition={{ calories: 120, protein: 15, carbs: 8, fat: 2 }}
      />
    );
    expect(screen.getByText('Health Connect')).toBeTruthy();
    fireEvent.press(
      screen.getByLabelText('Greek yogurt with berries and toasted oats, 100 g')
    );
    expect(mockNavigate).toHaveBeenCalledWith('FoodEntryView', { entry });
  });

  it('keeps a preset meal accessible in edit mode and exposes its whole-meal move handle', () => {
    const entry = createEntry({ id: 'fem-1', food_entry_meal_id: 'fem-1' });
    const screen = renderRow(
      <SwipeableFoodRow
        entry={entry}
        nutrition={{ calories: 120, protein: 15, carbs: 8, fat: 2 }}
        selectionMode
        onDragEnd={jest.fn()}
      />
    );
    expect(screen.getByTestId('food-drag-fem-1')).toBeTruthy();
    fireEvent.press(screen.getByText(/Greek Yogurt/));
    expect(mockNavigate).toHaveBeenCalledWith('EditLoggedMeal', {
      foodEntryMealId: 'fem-1',
    });
  });

  it('routes meal-component tap to EditLoggedMeal', () => {
    const entry = createEntry({ food_entry_meal_id: 'fem-1' });

    const screen = renderRow(
      <SwipeableFoodRow
        entry={entry}
        nutrition={{ calories: 120, protein: 15, carbs: 8, fat: 2 }}
        onAdjustServing={jest.fn()}
      />
    );

    fireEvent.press(screen.getByText(/Greek Yogurt/));

    expect(mockNavigate).toHaveBeenCalledWith('EditLoggedMeal', {
      foodEntryMealId: 'fem-1',
    });
  });

  it('does not surface the quick-adjust affordance for meal components', () => {
    const entry = createEntry({ food_entry_meal_id: 'fem-1' });
    const onAdjustServing = jest.fn();

    const screen = renderRow(
      <SwipeableFoodRow
        entry={entry}
        nutrition={{ calories: 120, protein: 15, carbs: 8, fat: 2 }}
        onAdjustServing={onAdjustServing}
      />
    );

    // Just text — no button.
    fireEvent.press(screen.getByText(/120 Cal/));
    expect(onAdjustServing).not.toHaveBeenCalled();
  });

  it('omits "Adjust serving" from the long-press menu for meal components', () => {
    const entry = createEntry({ food_entry_meal_id: 'fem-1' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const screen = renderRow(
      <SwipeableFoodRow
        entry={entry}
        nutrition={{ calories: 120, protein: 15, carbs: 8, fat: 2 }}
        onAdjustServing={jest.fn()}
      />
    );

    fireEvent(screen.getByText(/Greek Yogurt/), 'longPress');

    expect(alertSpy).toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0][2] as { text: string }[];
    const labels = buttons.map((b) => b.text);
    expect(labels).not.toContain('Adjust serving');
    expect(labels).toEqual(expect.arrayContaining(['Delete', 'Cancel']));

    alertSpy.mockRestore();
  });
});
