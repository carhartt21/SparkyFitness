import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, type ActivityPlanningResponse } from '@workspace/shared';
import WeeklyActivityOverview from '@/components/WeeklyActivityOverview';
import { useActivityPlanning } from '@/hooks/Tracking/useActivityPlanning';
jest.mock('@/hooks/Tracking/useActivityPlanning');
jest.mock('@workspace/shared', () => ({
  ...jest.requireActual<typeof import('@workspace/shared')>(
    '@workspace/shared'
  ),
  todayInZone: () => '2026-10-01',
}));
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    timezone: 'UTC',
    formatDate: (day: string) => day.split('-').reverse().join('.'),
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en' },
  }),
}));
const load = jest.mocked(useActivityPlanning);
const mutate = jest.fn().mockResolvedValue({});
const refetch = jest.fn();
const data: ActivityPlanningResponse = {
  start_date: '2026-09-28',
  end_date: '2026-10-04',
  timezone: 'UTC',
  occurrences: [
    {
      id: 'workout:1:2:2026-10-01',
      date: '2026-10-01',
      source: 'workout',
      source_id: '1',
      assignment_id: 2,
      revision: 0,
      label: 'Evening walk',
      plan_label: 'Movement',
      activity_type: 'walking',
      state: 'pending',
      reason: 'not_recorded',
      recorded_at: null,
      evidence_ids: [],
      expected_sets: 1,
      completed_sets: 0,
    },
  ],
  records: [],
  summary: [
    {
      activity_type: 'walking',
      scheduled: 1,
      completed: 0,
      started: 0,
      pending: 1,
      unknown: 0,
      excluded: 0,
    },
  ],
  workout_plans: [],
  note: '',
};
// The hook's public output is mocked without emulating React Query internals.
const hook = () =>
  ({
    query: {
      data,
      isPending: false,
      isError: false,
      isFetching: false,
      refetch,
    },
    mutation: { mutateAsync: mutate, isPending: false },
    isActingOnBehalf: false,
  }) as unknown as ReturnType<typeof useActivityPlanning>;
beforeEach(() => {
  jest.clearAllMocks();
  load.mockReturnValue(hook());
});
const mount = () =>
  render(
    <MemoryRouter>
      <WeeklyActivityOverview />
    </MemoryRouter>
  );
it('navigates a calendar week and records an explicit skip with the revision', async () => {
  mount();
  const before = load.mock.calls.at(-1)!;
  fireEvent.click(
    screen.getByRole('button', { name: 'activityPlanning.next' })
  );
  expect(load.mock.calls.at(-1)).toEqual([
    addDays(before[0], 7),
    addDays(before[1], 7),
  ]);
  fireEvent.click(
    screen.getByRole('button', { name: 'activityPlanning.skip' })
  );
  await waitFor(() =>
    expect(mutate).toHaveBeenCalledWith({
      occurrence_id: data.occurrences[0]!.id,
      expected_revision: 0,
      action: 'skip',
    })
  );
  expect(
    screen.getByRole('link', { name: 'activityPlanning.openDiary' })
  ).toHaveAttribute('href', '/diary?date=2026-10-01');
});
it('shows a recoverable error and hides owner-only content in delegated context', () => {
  load.mockReturnValue({
    ...hook(),
    query: { ...hook().query, isError: true },
  } as ReturnType<typeof useActivityPlanning>);
  const view = mount();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'activityPlanning.loadError'
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'activityPlanning.retry' })
  );
  expect(refetch).toHaveBeenCalled();
  load.mockReturnValue({ ...hook(), isActingOnBehalf: true });
  view.rerender(
    <MemoryRouter>
      <WeeklyActivityOverview />
    </MemoryRouter>
  );
  expect(
    screen.queryByTestId('weekly-activity-overview')
  ).not.toBeInTheDocument();
});
it('reports a failed write without claiming completion', async () => {
  mutate.mockRejectedValueOnce(new Error('Conflict'));
  mount();
  fireEvent.click(
    screen.getByRole('button', { name: 'activityPlanning.skip' })
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'activityPlanning.saveError'
  );
  expect(
    screen.getByText('activityPlanning.state.pending')
  ).toBeInTheDocument();
});

it('uses the configured calendar-date format for the range and occurrence', () => {
  mount();
  expect(screen.getByText('28.09.2026 – 04.10.2026')).toBeInTheDocument();
  expect(screen.getByText(/01\.10\.2026/)).toBeInTheDocument();
});
