import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import DailyProgressCard from '../../src/components/DailyProgressCard';
import type { DailyProgressItem } from '@workspace/shared';

const mockRefetch = jest.fn();
const mockOpenItem = jest.fn();
let mockQuery: {
  progress: {
    items: DailyProgressItem[];
    applicable: number;
    completed: number;
    percent: number | null;
  } | null;
  isError: boolean;
  refetch: typeof mockRefetch;
};
jest.mock('../../src/hooks/useProjectedDailyProgress', () => ({
  useProjectedDailyProgress: () => mockQuery,
}));
jest.mock('../../src/hooks/useProgressActions', () => ({
  ...jest.requireActual('../../src/hooks/useProgressActions'),
  useProgressActions: () => ({
    itemLabel: (item: DailyProgressItem) => item.label,
    openItem: mockOpenItem,
  }),
}));
jest.mock('../../src/components/brand/ProgressTrackX', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="preview-x" /> };
});
jest.mock('uniwind', () => ({
  useCSSVariable: (keys: string | string[]) =>
    Array.isArray(keys) ? keys.map(() => '#8899aa') : '#8899aa',
}));
const props = {
  date: '2026-09-29',
  enabled: true,
  onOpenProgress: jest.fn(),
  onOpenHydration: jest.fn(),
};
const task: DailyProgressItem = {
  id: 'meal-id',
  label: 'Synthetic snack',
  domain: 'meal',
  state: 'pending',
  reference_id: 'type-id',
  recorded_at: null,
  reason: 'synthetic',
};
beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = { progress: null, isError: false, refetch: mockRefetch };
});
it('distinguishes loading and failed reads and offers a working retry', () => {
  const view = render(<DailyProgressCard {...props} />);
  expect(view.getByText('Loading...')).toBeTruthy();
  expect(view.queryByText('No tasks today')).toBeNull();
  mockQuery.isError = true;
  view.rerender(<DailyProgressCard {...props} />);
  fireEvent.press(view.getByText('Retry'));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});
it('opens the actual pending task and drops it from the preview after resolution', () => {
  mockQuery.progress = {
    applicable: 1,
    completed: 0,
    percent: 0,
    items: [task],
  };
  const view = render(<DailyProgressCard {...props} />);
  fireEvent.press(view.getByLabelText(task.label));
  expect(mockOpenItem).toHaveBeenCalledWith(task);
  fireEvent.press(view.getByTestId('dashboard-progress-open'));
  expect(props.onOpenProgress).toHaveBeenCalledTimes(1);
  mockQuery.progress = {
    applicable: 1,
    completed: 1,
    percent: 100,
    items: [{ ...task, state: 'complete' }],
  };
  view.rerender(<DailyProgressCard {...props} />);
  expect(view.queryByLabelText(task.label)).toBeNull();
  expect(view.getByText('All applicable tasks are resolved.')).toBeTruthy();
});
it('marks cached tasks as stale and keeps known zero distinct from no applicable tasks', () => {
  mockQuery = {
    progress: { applicable: 1, completed: 0, percent: 0, items: [task] },
    isError: true,
    refetch: mockRefetch,
  };
  const view = render(<DailyProgressCard {...props} />);
  expect(
    view.getByText('Saved tasks. Refresh to check recent changes.')
  ).toBeTruthy();
  expect(view.getByLabelText(task.label)).toBeTruthy();
  mockQuery.progress = {
    applicable: 0,
    completed: 0,
    percent: null,
    items: [],
  };
  mockQuery.isError = false;
  view.rerender(<DailyProgressCard {...props} />);
  expect(view.getByText('No tasks today')).toBeTruthy();
  expect(view.queryByText('All applicable tasks are resolved.')).toBeNull();
});
