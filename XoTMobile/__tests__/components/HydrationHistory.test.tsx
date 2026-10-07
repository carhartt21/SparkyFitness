import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { HydrationDayDetails } from '@workspace/shared';
import HydrationHistory from '../../src/components/HydrationHistory';
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockNavigate = jest.fn();
const mockRetry = jest.fn();
const mockInvalidate = jest.fn();
const mockMutate = jest.fn();
let mockQuery: {
  data?: HydrationDayDetails;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: typeof mockRetry;
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQuery,
  useMutation: () => ({ mutate: mockMutate, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
const data: HydrationDayDetails = {
  date: '2026-10-02',
  timezone: 'Europe/Berlin',
  totals: {
    water_ml: 750,
    manual_ml: 0,
    ledger_ml: 0,
    food_ml: 750,
    drink_ml: 250,
    supplement_ml: 500,
    solid_food_ml: 160,
    unknown_count: 1,
  },
  entries: [
    {
      id: 'drink',
      entry_date: '2026-10-02',
      kind: 'drink',
      name: 'Energy drink',
      water_ml: 250,
      logged_at: '2026-10-02T08:30:00Z',
      source: 'manual',
      water_entry_id: null,
      food_entry_id: 'food',
      medication_id: null,
      amount_basis: 'recorded',
      counts_toward_goal: true,
    },
    {
      id: 'unknown',
      entry_date: '2026-10-02',
      kind: 'food',
      name: 'Unknown food',
      water_ml: null,
      logged_at: null,
      source: 'manual',
      water_entry_id: null,
      food_entry_id: null,
      medication_id: null,
      amount_basis: 'unknown',
      counts_toward_goal: false,
    },
  ],
};
const props = {
  visible: true,
  date: data.date,
  unit: 'ml',
  goal: 2500,
  onClose: jest.fn(),
  onConfigure: jest.fn(),
};
beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = {
    data,
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: mockRetry,
  };
});
it('keeps recorded goal water and solid-food water separate, and unknown content explicit', () => {
  render(<HydrationHistory {...props} />);
  expect(screen.getByText('750 ml')).toBeTruthy();
  expect(screen.getByText('160 ml')).toBeTruthy();
  expect(screen.getByText('Water content unknown')).toBeTruthy();
  expect(screen.getByText(/10:30/)).toBeTruthy();
  expect(screen.queryByText(/AM|PM/)).toBeNull();
});
it('opens the actual meals day from a drink source', () => {
  render(<HydrationHistory {...props} />);
  fireEvent.press(screen.getByText('Open daily meals'));
  expect(props.onClose).toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith('DailyMeals', {
    date: '2026-10-02',
  });
});
it('offers retry instead of claiming an empty history on failure', () => {
  mockQuery = {
    isPending: false,
    isError: true,
    isSuccess: false,
    refetch: mockRetry,
  };
  render(<HydrationHistory {...props} />);
  fireEvent.press(screen.getByText('Retry'));
  expect(mockRetry).toHaveBeenCalled();
  expect(screen.queryByText('0 ml')).toBeNull();
});

it('shows an explicit offline state instead of a perpetual loading message for a disabled uncached query', () => {
  mockQuery = {
    isPending: true,
    isError: false,
    isSuccess: false,
    refetch: mockRetry,
  };
  render(<HydrationHistory {...props} visible={false} />);
  expect(
    screen.getByText(
      'No history saved for this day. Connect to your server to load it.'
    )
  ).toBeTruthy();
  expect(screen.queryByText('Loading...')).toBeNull();
  expect(screen.queryByText('0 ml')).toBeNull();
});
it('retains cached history offline', () => {
  render(<HydrationHistory {...props} visible={false} />);
  expect(screen.getByText('750 ml')).toBeTruthy();
  expect(screen.queryByText(/No history saved/)).toBeNull();
  expect(screen.queryByText('Loading...')).toBeNull();
});
