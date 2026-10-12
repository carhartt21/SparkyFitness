import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';
import QuickAddFoodSheet, {
  type QuickAddFoodSheetRef,
} from '../../src/components/foodSearch/QuickAddFoodSheet';
import type { FoodItem } from '../../src/types/foods';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockAddEntryAsync = jest.fn();
const mockLogCachedFood = jest.fn();
const mockLogCachedMeal = jest.fn();
jest.mock('../../src/services/quickNutritionLog', () => ({
  logCachedFood: (...args: unknown[]) => mockLogCachedFood(...args),
  logCachedMeal: (...args: unknown[]) => mockLogCachedMeal(...args),
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, TextInput } = require('react-native');
  const MockBottomSheetModal = React.forwardRef(
    ({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        present: mockPresent,
        dismiss: mockDismiss,
      }));
      return <View>{children}</View>;
    }
  );
  MockBottomSheetModal.displayName = 'MockBottomSheetModal';
  return {
    __esModule: true,
    BottomSheetBackdrop: () => <View />,
    BottomSheetTextInput: TextInput,
    BottomSheetScrollView: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    BottomSheetModal: MockBottomSheetModal,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock('../../src/components/ui/sheetChrome', () => ({
  sheetContainer: undefined,
  useSheetBackdrop: () => () => null,
}));

jest.mock('../../src/hooks/useFoodVariants', () => ({
  useFoodVariants: () => ({
    variants: [
      {
        id: 'variant-g',
        food_id: 'food-1',
        serving_size: 100,
        serving_unit: 'g',
        calories: 62,
        protein: 11,
        carbs: 4,
        fat: 0.2,
      },
      {
        id: 'variant-cup',
        food_id: 'food-1',
        serving_size: 1,
        serving_unit: 'cup',
        calories: 150,
        protein: 26,
        carbs: 10,
        fat: 0.5,
      },
    ],
  }),
}));

jest.mock('../../src/hooks/useMealTypes', () => ({
  useMealTypes: () => ({
    mealTypes: [
      { id: 'breakfast', name: 'breakfast', user_id: null },
      { id: 'lunch', name: 'lunch', user_id: null },
    ],
    defaultMealTypeId: 'breakfast',
  }),
}));

jest.mock('../../src/hooks/useAddFoodEntry', () => ({
  useAddFoodEntry: () => ({
    addEntryAsync: mockAddEntryAsync,
    isPending: false,
  }),
}));

const food = {
  id: 'food-1',
  name: 'Skyr',
  brand: 'Plain',
  is_custom: false,
  default_variant: {
    id: 'variant-g',
    serving_size: 100,
    serving_unit: 'g',
    calories: 62,
    protein: 11,
    carbs: 4,
    fat: 0.2,
  },
} as FoodItem;

function renderSheet(
  props: Partial<React.ComponentProps<typeof QuickAddFoodSheet>> = {}
) {
  const ref = React.createRef<QuickAddFoodSheetRef>();
  const onMoreOptions = jest.fn();
  const screen = render(
    <QuickAddFoodSheet
      ref={ref}
      date="2026-09-28"
      onMoreOptions={onMoreOptions}
      {...props}
    />
  );
  act(() => ref.current?.present(food));
  return { screen, onMoreOptions };
}

describe('QuickAddFoodSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddEntryAsync.mockResolvedValue({ id: 'entry-1' });
  });

  it('durably queues a decimal offline portion before showing success and ignores duplicate taps', async () => {
    let resolve: () => void = () => undefined;
    mockLogCachedFood.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    const onLogged = jest.fn();
    const identity = { serverConfigId: 'server', userId: 'owner' };
    const { screen } = renderSheet({
      offline: {
        identity,
        mealTypes: [
          {
            id: 'lunch',
            name: 'Lunch',
            sort_order: 1,
            is_visible: true,
            show_in_quick_log: true,
          },
        ],
      },
      onLogged,
    });
    const input = screen.getByTestId('quick-add-offline-quantity');
    fireEvent.changeText(input, '75,5');
    const add = screen.getByRole('button', { name: 'Add' });
    fireEvent.press(add);
    fireEvent.press(add);
    expect(mockLogCachedFood).toHaveBeenCalledTimes(1);
    expect(mockLogCachedFood).toHaveBeenCalledWith(
      food.id,
      expect.objectContaining({
        quantity: 75.5,
        entryDate: '2026-09-28',
        identity,
      })
    );
    expect(Toast.show).not.toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();
    await act(async () => resolve());
    expect(onLogged).toHaveBeenCalledTimes(1);
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: 'Saved on this device' })
    );
    expect(mockAddEntryAsync).not.toHaveBeenCalled();
  });

  it('keeps the offline portion open after a storage failure and rejects invalid quantities', async () => {
    mockLogCachedFood.mockRejectedValueOnce(new Error('disk full'));
    const { screen } = renderSheet({
      offline: {
        identity: { serverConfigId: 'server', userId: 'owner' },
        mealTypes: [
          {
            id: 'lunch',
            name: 'Lunch',
            sort_order: 1,
            is_visible: true,
            show_in_quick_log: true,
          },
        ],
      },
    });
    fireEvent.changeText(
      screen.getByTestId('quick-add-offline-quantity'),
      '-1'
    );
    fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(mockLogCachedFood).not.toHaveBeenCalled();
    fireEvent.changeText(
      screen.getByTestId('quick-add-offline-quantity'),
      '20'
    );
    fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      )
    );
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(screen.queryByText('More options')).toBeNull();
  });

  it('shows serving presets with live nutrition for the selected amount', () => {
    const { screen } = renderSheet();

    expect(mockPresent).toHaveBeenCalled();
    expect(screen.getByText('Skyr')).toBeTruthy();
    expect(screen.getByText('50 g')).toBeTruthy();
    expect(screen.getByText('200 g')).toBeTruthy();
    expect(screen.getByTestId('quick-add-summary')).toHaveTextContent(/62/);

    fireEvent.press(screen.getByTestId('quick-add-amount-2'));
    expect(screen.getByTestId('quick-add-summary')).toHaveTextContent(/124/);
  });

  it('logs the chosen serving, amount and meal directly to the diary', async () => {
    const { screen } = renderSheet();

    fireEvent.press(screen.getByTestId('quick-add-amount-1.5'));
    fireEvent.press(screen.getByTestId('quick-add-meal-lunch'));
    fireEvent.press(screen.getByTestId('quick-add-confirm'));

    await waitFor(() => expect(mockAddEntryAsync).toHaveBeenCalledTimes(1));
    expect(mockAddEntryAsync).toHaveBeenCalledWith({
      createEntryPayload: expect.objectContaining({
        food_id: 'food-1',
        variant_id: 'variant-g',
        quantity: 150,
        unit: 'g',
        meal_type_id: 'lunch',
        entry_date: '2026-09-28',
      }),
    });
    await waitFor(() => expect(mockDismiss).toHaveBeenCalled());
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
  });

  it('switches to another stored serving and uses the caller meal by default', async () => {
    const { screen } = renderSheet({ mealTypeId: 'lunch' });

    fireEvent.press(screen.getByTestId('quick-add-serving-1'));
    fireEvent.press(screen.getByTestId('quick-add-confirm'));

    await waitFor(() =>
      expect(mockAddEntryAsync).toHaveBeenCalledWith({
        createEntryPayload: expect.objectContaining({
          variant_id: 'variant-cup',
          quantity: 1,
          meal_type_id: 'lunch',
        }),
      })
    );
  });

  it('keeps the sheet open when adding fails', async () => {
    mockAddEntryAsync.mockRejectedValueOnce(new Error('offline'));
    const { screen } = renderSheet();

    fireEvent.press(screen.getByTestId('quick-add-confirm'));

    await waitFor(() => expect(mockAddEntryAsync).toHaveBeenCalled());
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it('opens the full entry screen for more options', () => {
    const { screen, onMoreOptions } = renderSheet();

    expect(screen.getByText('Options')).toBeTruthy();
    expect(screen.getByText('Add')).toBeTruthy();
    expect(screen.getByTestId('quick-add-more').props.accessibilityLabel).toBe(
      'More options'
    );
    expect(
      screen.getByTestId('quick-add-confirm').props.accessibilityLabel
    ).toBe('Add to diary');

    fireEvent.press(screen.getByTestId('quick-add-more'));

    expect(onMoreOptions).toHaveBeenCalledWith(food);
  });
});
