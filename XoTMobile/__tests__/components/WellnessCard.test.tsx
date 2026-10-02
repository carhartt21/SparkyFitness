import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Habit, HabitLog } from '@workspace/shared';
import WellnessCard from '../../src/components/tracking/WellnessCard';
import * as api from '../../src/services/api/dailyTrackingApi';

jest.mock('../../src/hooks/useRefetchOnFocus', () => ({
  useRefetchOnFocus: jest.fn(),
}));
jest.mock('../../src/services/api/dailyTrackingApi', () => ({
  listHabits: jest.fn(),
  listHabitLogs: jest.fn(),
  createHabit: jest.fn(),
  logHabit: jest.fn(),
  updateHabit: jest.fn(),
  deleteHabit: jest.fn(),
}));
const activity: Habit = {
  id: 'sauna',
  name: 'Sauna',
  category: 'wellness',
  habit_type: 'completion',
  days: [],
  reminder_time: null,
  description: null,
  unit: null,
  target: null,
  step: null,
  active: true,
  sort_order: 0,
  icon: null,
};
let habits: Habit[];
let logs: HabitLog[];
const date = '2026-10-01';
const mount = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <WellnessCard date={date} />
    </QueryClientProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  habits = [];
  logs = [];
  jest.mocked(api.listHabits).mockImplementation(async () => [...habits]);
  jest.mocked(api.listHabitLogs).mockImplementation(async () => [...logs]);
  jest.mocked(api.createHabit).mockImplementation(async (body) => {
    const created = { ...activity, name: body.name };
    habits.push(created);
    return created;
  });
  jest.mocked(api.logHabit).mockImplementation(async (id, body) => {
    logs = logs.filter(
      (log) => log.habit_id !== id || log.entry_date !== body.entry_date
    );
    if (body.value === null) return null;
    const saved = {
      habit_id: id,
      entry_date: body.entry_date,
      value: 1,
      recorded_at: '2026-10-01T19:00:00Z',
    };
    logs.push(saved);
    return saved;
  });
});

it('logs and undoes a preset on the diary date', async () => {
  const screen = mount();
  fireEvent.press(await screen.findByLabelText('Log Sauna'));
  await waitFor(() =>
    expect(api.logHabit).toHaveBeenCalledWith('sauna', {
      entry_date: date,
      value: true,
    })
  );
  const undo = await screen.findByLabelText('Remove Sauna from this day');
  await waitFor(() =>
    expect(undo.props.accessibilityState.disabled).toBe(false)
  );
  fireEvent.press(undo);
  await waitFor(() =>
    expect(api.logHabit).toHaveBeenLastCalledWith('sauna', {
      entry_date: date,
      value: null,
    })
  );
});

it('logs a custom activity and collapses duplicate taps into one request', async () => {
  const screen = mount();
  await screen.findByText('No wellness activities logged for this day.');
  fireEvent.changeText(
    screen.getByLabelText('Custom activity'),
    'Atemübungen im Garten'
  );
  fireEvent.press(screen.getByLabelText('Log activity'));
  fireEvent.press(screen.getByLabelText('Log activity'));
  await screen.findByLabelText('Remove Atemübungen im Garten from this day');
  expect(api.createHabit).toHaveBeenCalledTimes(1);
  expect(api.createHabit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Atemübungen im Garten',
      category: 'wellness',
      days: [],
    })
  );
});

it('shows history only when expanded and keeps a different day empty', async () => {
  habits = [activity];
  logs = [
    {
      habit_id: activity.id,
      entry_date: '2026-09-30',
      value: 1,
      recorded_at: 'x',
    },
  ];
  const screen = mount();
  await screen.findByText('No wellness activities logged for this day.');
  expect(screen.queryByText('9/30/2026')).toBeNull();
  fireEvent.press(screen.getByText('History · last 30 days'));
  expect(screen.getByText('9/30/2026')).toBeTruthy();
});

it('keeps the custom name available for retry after a failed request', async () => {
  jest.mocked(api.createHabit).mockRejectedValue(new Error('offline'));
  const screen = mount();
  await screen.findByText('No wellness activities logged for this day.');
  fireEvent.changeText(screen.getByLabelText('Custom activity'), 'Hot bath');
  fireEvent.press(screen.getByLabelText('Log activity'));
  expect(
    await screen.findByText('Could not save the activity. Please try again.')
  ).toBeTruthy();
  expect(screen.getByLabelText('Custom activity').props.value).toBe('Hot bath');
});
