import React from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../hooks/queryTestUtils';
import Toast from 'react-native-toast-message';
import type { MealTrackingStatus } from '@workspace/shared';
import i18n, { initializeI18n } from '../../src/localization/i18n';
import {
  getMealTrackingStatus,
  setMealDayStatus,
} from '../../src/services/api/dailyTrackingApi';
import {
  dailyProgressQueryKey,
  mealTrackingStatusQueryKey,
} from '../../src/hooks/queryKeys';
import MealTypeDetailScreen from '../../src/screens/MealTypeDetailScreen';
import {
  useDailySummary,
  useServerConnection,
  useMealTypes,
} from '../../src/hooks';
import { usePreferences } from '../../src/hooks/usePreferences';
import { useCopyFoodEntries } from '../../src/hooks/useCopyFoodEntries';
import type { FoodEntry } from '../../src/types/foodEntries';
import type { MealType } from '../../src/types/mealTypes';
import type { RootStackScreenProps } from '../../src/types/navigation';

type ScreenProps = RootStackScreenProps<'MealTypeDetail'>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
} as unknown as ScreenProps['navigation'];

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

jest.mock('../../src/hooks', () => ({
  useDailySummary: jest.fn(),
  useServerConnection: jest.fn(),
  useMealTypes: jest.fn(),
}));

jest.mock('../../src/services/api/dailyTrackingApi', () => ({
  ...jest.requireActual('../../src/services/api/dailyTrackingApi'),
  getMealTrackingStatus: jest.fn(),
  setMealDayStatus: jest.fn(),
}));
jest.mock('../../src/hooks/useRefetchOnFocus', () => ({
  useRefetchOnFocus: jest.fn(),
}));
jest.mock('../../src/components/ActionSheet', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return ReactModule.forwardRef(
    (
      {
        items,
      }: { items: { key: string; label: string; onPress: () => void }[] },
      ref: React.Ref<unknown>
    ) => {
      const [visible, setVisible] = ReactModule.useState(false);
      ReactModule.useImperativeHandle(ref, () => ({
        present: () => setVisible(true),
      }));
      return visible
        ? items.map((item) => (
            <Pressable
              key={item.key}
              testID={`status-option-${item.key}`}
              onPress={item.onPress}
            >
              <Text>{item.label}</Text>
            </Pressable>
          ))
        : null;
    }
  );
});

jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: jest.fn(),
}));

jest.mock('../../src/hooks/useCopyFoodEntries', () => ({
  useCopyFoodEntries: jest.fn(),
}));

jest.mock('../../src/hooks/useScreenHeader', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    useScreenHeader: (config: {
      right?:
        | { accessibilityLabel?: string; onPress?: () => void }
        | { accessibilityLabel?: string; onPress?: () => void }[];
    }) => {
      const items = Array.isArray(config.right)
        ? config.right
        : config.right
          ? [config.right]
          : [];
      return ReactModule.createElement(
        ReactModule.Fragment,
        null,
        items.map((item, i) =>
          ReactModule.createElement(Pressable, {
            key: i,
            accessibilityLabel: item.accessibilityLabel,
            onPress: item.onPress,
          })
        )
      );
    },
  };
});

jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
}));

jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: () => 0,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../src/components/ServingAdjustSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(() => <View testID="serving-sheet" />),
  };
});

jest.mock('../../src/components/CopyMealSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      (_props: unknown, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          present: jest.fn(),
          dismiss: jest.fn(),
        }));
        return <View testID="copy-sheet" />;
      }
    ),
  };
});

jest.mock('../../src/components/FoodNutritionSummary', () => {
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }: { name?: string }) => (
      <View testID="nutrition-summary">
        <Text>{name}</Text>
      </View>
    ),
  };
});

jest.mock('../../src/components/SwipeableFoodRow', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="food-row" /> };
});

jest.mock('../../src/components/Icon', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="icon" /> };
});

const mockUseDailySummary = useDailySummary as jest.MockedFunction<
  typeof useDailySummary
>;
const mockUseServerConnection = useServerConnection as jest.MockedFunction<
  typeof useServerConnection
>;
const mockUseMealTypes = useMealTypes as jest.MockedFunction<
  typeof useMealTypes
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseCopyFoodEntries = useCopyFoodEntries as jest.MockedFunction<
  typeof useCopyFoodEntries
>;

const mealTypes: MealType[] = [
  {
    id: 'sys-b',
    name: 'breakfast',
    sort_order: 0,
    user_id: null,
    created_at: '',
    is_visible: true,
    show_in_quick_log: true,
  },
  {
    id: 'custom-pw',
    name: 'Pre-Workout',
    sort_order: 0,
    user_id: 'user1',
    created_at: '',
    is_visible: true,
    show_in_quick_log: true,
  },
  // A CUSTOM category deliberately named like a system type.
  {
    id: 'custom-d',
    name: 'dinner',
    sort_order: 2,
    user_id: 'user1',
    created_at: '',
    is_visible: true,
    show_in_quick_log: true,
  },
];

const entry = (
  id: string,
  meal_type_id: string,
  meal_type: string
): FoodEntry => ({ id, meal_type_id, meal_type }) as FoodEntry;

const setSummary = (foodEntries: FoodEntry[]) => {
  mockUseDailySummary.mockReturnValue({
    summary: {
      foodEntries,
      exerciseEntries: [],
      goals: null,
      calorieGoal: 0,
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as never);
};

const mockGetStatus = jest.mocked(getMealTrackingStatus);
const mockSetStatus = jest.mocked(setMealDayStatus);
const clients: QueryClient[] = [];
const statusFor = (
  date: string,
  state: MealTrackingStatus['meals'][number]['state'] = 'pending'
): MealTrackingStatus => ({
  entry_date: date,
  meals: mealTypes.map((meal) => ({
    meal_type_id: meal.id,
    name: meal.name,
    state,
    logged_item_count: 0,
    updated_at: null,
  })),
  coverage: {
    total: 3,
    resolved: state === 'pending' ? 0 : 3,
    complete: state === 'complete' ? 3 : 0,
    skipped: state === 'skipped' ? 3 : 0,
    incomplete: state === 'incomplete' ? 3 : 0,
    pending: state === 'pending' ? 3 : 0,
  },
});

const renderScreen = (
  params: ScreenProps['route']['params'],
  seeded = true
) => {
  mockUseMealTypes.mockReturnValue({
    mealTypes,
    defaultMealTypeId: 'sys-b',
  } as never);
  mockUseServerConnection.mockReturnValue({
    isConnected: true,
    isLoading: false,
  } as never);
  mockUsePreferences.mockReturnValue({
    preferences: {},
    isLoading: false,
  } as never);
  mockUseCopyFoodEntries.mockReturnValue({
    copyMeal: jest.fn(),
    isPending: false,
  } as never);
  const queryClient = createTestQueryClient({
    queries: { retry: false, gcTime: Infinity },
    mutations: { retry: false },
  });
  clients.push(queryClient);
  if (seeded)
    queryClient.setQueryData(
      mealTrackingStatusQueryKey(params.date),
      statusFor(params.date)
    );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MealTypeDetailScreen
        navigation={mockNavigation}
        route={{ key: 'MealTypeDetail-key', name: 'MealTypeDetail', params }}
      />
    </QueryClientProvider>
  );
  return { ...view, queryClient };
};

describe('MealTypeDetailScreen', () => {
  beforeEach(async () => {
    await act(async () => {
      await initializeI18n('en');
      await i18n.changeLanguage('en');
    });
    jest.clearAllMocks();
    mockGetStatus.mockImplementation(async (date) => statusFor(date));
    mockSetStatus.mockImplementation(async (body) =>
      statusFor(body.entry_date, body.status ?? 'pending')
    );
    setSummary([
      entry('1', 'custom-pw', 'Pre-Workout'),
      entry('2', 'sys-b', 'breakfast'),
    ]);
  });

  afterEach(async () => {
    await cleanupAsync();
    clients.splice(0).forEach((client) => client.clear());
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('filters entries by canonical meal type id and renders the literal custom label', () => {
    const view = renderScreen({
      date: '2026-01-01',
      mealTypeId: 'custom-pw',
      mealType: 'Pre-Workout',
    });

    expect(view.getByText('Pre-Workout')).toBeTruthy();
    expect(view.getAllByTestId('food-row')).toHaveLength(1);
  });

  it('renders the localized system label when filtering a system type by id', () => {
    const view = renderScreen({
      date: '2026-01-01',
      mealTypeId: 'sys-b',
      mealType: 'breakfast',
    });

    expect(view.getByText('Breakfast')).toBeTruthy();
    expect(view.getAllByTestId('food-row')).toHaveLength(1);
  });

  it('falls back to the literal historical name for a deleted type', () => {
    setSummary([entry('9', 'gone-id', 'Gone Meal')]);
    const view = renderScreen({
      date: '2026-01-01',
      mealTypeId: 'gone-id',
      mealType: 'Gone Meal',
      mealLabel: 'Gone Meal',
    });

    expect(view.getByText('Gone Meal')).toBeTruthy();
    expect(view.getAllByTestId('food-row')).toHaveLength(1);
  });

  it('resolves the label from the active type when only the id is passed', () => {
    const view = renderScreen({ date: '2026-01-01', mealTypeId: 'custom-pw' });

    expect(view.getByText('Pre-Workout')).toBeTruthy();
  });

  it('renders a custom type named dinner literally and filters by its id', () => {
    setSummary([
      entry('1', 'custom-d', 'dinner'),
      entry('2', 'sys-b', 'breakfast'),
    ]);
    const view = renderScreen({
      date: '2026-01-01',
      mealTypeId: 'custom-d',
      mealType: 'dinner',
    });

    // Literal custom name — never the localized system "Kolacja"/"Dinner".
    expect(view.getByText('dinner')).toBeTruthy();
    expect(view.queryByText('Dinner')).toBeNull();
    expect(view.getAllByTestId('food-row')).toHaveLength(1);
  });

  it('Add Food header action navigates to FoodSearch preserving the canonical mealTypeId', () => {
    const view = renderScreen({
      date: '2026-01-01',
      mealTypeId: 'custom-pw',
      mealType: 'Pre-Workout',
    });
    fireEvent.press(view.getAllByLabelText('Add Food')[0]);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('FoodSearch', {
      date: '2026-01-01',
      mealTypeId: 'custom-pw',
    });
  });

  it('Add Food never passes a stale hidden/deleted id (resolvedType missing -> no id)', () => {
    const view = renderScreen({
      date: '2026-01-01',
      mealTypeId: 'gone-id',
      mealType: 'Old Custom',
    });
    fireEvent.press(view.getAllByLabelText('Add Food')[0]);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('FoodSearch', {
      date: '2026-01-01',
      mealTypeId: undefined,
    });
  });

  it('saves the selected day and canonical meal, updates shared status and invalidates Goals', async () => {
    const date = '2026-01-01';
    const view = renderScreen({ date, mealTypeId: 'custom-pw' });
    view.queryClient.setQueryData(dailyProgressQueryKey(date), {
      marker: 'cached-goals',
    });
    fireEvent.press(view.getByTestId('meal-status-control'));
    await waitFor(() =>
      expect(mockSetStatus).toHaveBeenCalledWith({
        entry_date: date,
        meal_type_id: 'custom-pw',
        status: 'complete',
      })
    );
    await waitFor(() =>
      expect(
        view.getByTestId('meal-status-control').props.accessibilityLabel
      ).toContain('Complete')
    );
    expect(
      view.queryClient.getQueryData<MealTrackingStatus>(
        mealTrackingStatusQueryKey(date)
      )?.meals[1].state
    ).toBe('complete');
    expect(
      view.queryClient.getQueryState(dailyProgressQueryKey(date))?.isInvalidated
    ).toBe(true);
  });

  it('lets an empty meal be skipped with a long press and keeps its Add Food destination', async () => {
    setSummary([]);
    const view = renderScreen({ date: '2026-01-01', mealTypeId: 'sys-b' });
    expect(view.getByText('No foods logged for Breakfast')).toBeTruthy();
    fireEvent(view.getByTestId('meal-status-control'), 'longPress');
    expect(mockSetStatus).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId('status-option-skipped'));
    await waitFor(() =>
      expect(mockSetStatus).toHaveBeenCalledWith({
        entry_date: '2026-01-01',
        meal_type_id: 'sys-b',
        status: 'skipped',
      })
    );
    fireEvent.press(view.getByText('Add Food'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('FoodSearch', {
      date: '2026-01-01',
      mealTypeId: 'sys-b',
    });
  });

  it('renders natural German empty copy and preserves a custom meal name', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
    });
    setSummary([]);
    const view = renderScreen({ date: '2026-01-01', mealTypeId: 'custom-pw' });
    expect(
      view.getByText('Noch keine Lebensmittel für Pre-Workout erfasst')
    ).toBeTruthy();
    expect(
      view.getByText(
        /Für diese Mahlzeit wurden noch keine Lebensmittel erfasst/
      )
    ).toBeTruthy();
    expect(
      view.getByTestId('meal-status-control').props.accessibilityLabel
    ).toContain('Pre-Workout');
    expect(view.queryByTestId('nutrition-summary')).toBeNull();
  });

  it('shows unknown status during loading, then recovers from a read error with Retry', async () => {
    let rejectRead: (reason: Error) => void = () => {};
    mockGetStatus.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRead = reject;
        })
    );
    const view = renderScreen(
      { date: '2026-01-01', mealTypeId: 'sys-b' },
      false
    );
    expect(view.getByText('Loading status…')).toBeTruthy();
    expect(view.queryByTestId('meal-status-control')).toBeNull();
    await act(async () => {
      rejectRead(new Error('offline'));
    });
    await waitFor(() =>
      expect(view.getByText('Could not load the meal status.')).toBeTruthy()
    );
    expect(view.queryByTestId('meal-status-control')).toBeNull();
    fireEvent.press(view.getByText('Retry'));
    await waitFor(() =>
      expect(view.getByTestId('meal-status-control')).toBeTruthy()
    );
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it('blocks duplicate taps during saving and leaves the last persisted state after failure', async () => {
    let rejectSave: (reason: Error) => void = () => {};
    mockSetStatus.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        })
    );
    const view = renderScreen({ date: '2026-01-01', mealTypeId: 'sys-b' });
    fireEvent.press(view.getByTestId('meal-status-control'));
    await waitFor(() =>
      expect(
        view.getByTestId('meal-status-control').props.accessibilityState
          .disabled
      ).toBe(true)
    );
    fireEvent.press(view.getByTestId('meal-status-control'));
    expect(mockSetStatus).toHaveBeenCalledTimes(1);
    await act(async () => {
      rejectSave(new Error('offline'));
    });
    await waitFor(() =>
      expect(Toast.show).toHaveBeenCalledWith({
        type: 'error',
        text1: 'Could not save the meal status.',
      })
    );
    expect(
      view.queryClient.getQueryData<MealTrackingStatus>(
        mealTrackingStatusQueryKey('2026-01-01')
      )?.meals[0].state
    ).toBe('pending');
  });

  it('does not offer a status write for a historical meal without an active identity', () => {
    const view = renderScreen({
      date: '2026-01-01',
      mealTypeId: 'gone-id',
      mealType: 'Gone Meal',
    });
    expect(view.queryByTestId('meal-status-control')).toBeNull();
    expect(mockGetStatus).not.toHaveBeenCalled();
    expect(mockSetStatus).not.toHaveBeenCalled();
  });
});
