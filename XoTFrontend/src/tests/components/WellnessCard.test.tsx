import { fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Habit, HabitLog } from '@workspace/shared';
import WellnessCard from '@/pages/Diary/WellnessCard';
import * as api from '@/api/Tracking/trackingService';
import { renderWithClient } from '@/tests/test-utils';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: jest.requireActual('@/tests/mocks/reactI18next').translateForTest,
    i18n: { language: 'en' },
  }),
}));
let mockWrite = true;
jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({
    activeUserId: 'owner',
    hasPermission: () => true,
    hasWritePermission: () => mockWrite,
  }),
}));
jest.mock('@/api/Tracking/trackingService', () => ({
  listHabits: jest.fn(),
  listHabitLogs: jest.fn(),
  createHabit: jest.fn(),
  logHabit: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockWrite = true;
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

it('logs a preset on the selected day and undo removes only that day', async () => {
  renderWithClient(<WellnessCard date={date} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Log Sauna' }));
  await waitFor(() =>
    expect(api.logHabit).toHaveBeenCalledWith('sauna', {
      entry_date: date,
      value: true,
    })
  );
  expect(api.createHabit).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Sauna', category: 'wellness', days: [] })
  );
  const undo = await screen.findByRole('button', {
    name: 'Remove Sauna from this day',
  });
  await waitFor(() => expect(undo).toBeEnabled());
  fireEvent.click(undo);
  await waitFor(() =>
    expect(api.logHabit).toHaveBeenLastCalledWith('sauna', {
      entry_date: date,
      value: null,
    })
  );
});

it('preserves custom names and offers them again without session fields', async () => {
  renderWithClient(<WellnessCard date={date} />);
  await screen.findByText('No wellness activities logged for this day.');
  fireEvent.change(screen.getByLabelText('Custom activity'), {
    target: { value: 'Atemübungen im Garten' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));
  await waitFor(() =>
    expect(api.createHabit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Atemübungen im Garten' })
    )
  );
  expect(
    await screen.findByRole('button', {
      name: 'Remove Atemübungen im Garten from this day',
    })
  ).toBeInTheDocument();
  expect(
    screen.queryByLabelText(/duration|temperature/i)
  ).not.toBeInTheDocument();
});

it('shows dated history while keeping an unlogged day empty', async () => {
  habits = [activity];
  logs = [
    {
      habit_id: activity.id,
      entry_date: '2026-09-30',
      value: 1,
      recorded_at: 'x',
    },
  ];
  renderWithClient(<WellnessCard date={date} />);
  expect(
    await screen.findByText('No wellness activities logged for this day.')
  ).toBeInTheDocument();
  expect(screen.getByText('9/30/2026')).toBeInTheDocument();
  expect(api.listHabitLogs).toHaveBeenCalledWith('2026-09-02', date);
});

it('hides mutations for a read-only check-in delegate', async () => {
  mockWrite = false;
  habits = [activity];
  logs = [
    { habit_id: activity.id, entry_date: date, value: 1, recorded_at: 'x' },
  ];
  renderWithClient(<WellnessCard date={date} />);
  expect(await screen.findByLabelText('Logged activities')).toHaveTextContent(
    'Sauna'
  );
  expect(
    screen.queryByRole('button', { name: 'Log Sauna' })
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Custom activity')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Remove/ })
  ).not.toBeInTheDocument();
});

it('retains the custom input after a failed save', async () => {
  jest.mocked(api.createHabit).mockRejectedValue(new Error('offline'));
  renderWithClient(<WellnessCard date={date} />);
  await screen.findByText('No wellness activities logged for this day.');
  fireEvent.change(screen.getByLabelText('Custom activity'), {
    target: { value: 'Hot bath' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));
  await waitFor(() => expect(api.createHabit).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Log activity' })).toBeEnabled()
  );
  expect(screen.getByLabelText('Custom activity')).toHaveValue('Hot bath');
});
