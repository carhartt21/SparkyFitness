import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DailyProgress } from '@workspace/shared';
import { DailyProgressCard } from '@/pages/Dashboard/DailyProgressCard';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);

const base: DailyProgress = {
  version: 1,
  date: '2026-09-28',
  applicable: 2,
  completed: 1,
  percent: 50,
  coverage: {
    checkin: { applicable: 1, completed: 1 },
    habit: { applicable: 0, completed: 0 },
    measurement: { applicable: 0, completed: 0 },
    supplement: { applicable: 1, completed: 0 },
    meal: { applicable: 0, completed: 0 },
  },
  items: [
    {
      id: 'checkin:2026-09-28',
      domain: 'checkin',
      label: 'Daily check-in',
      date: '2026-09-28',
      applicable: true,
      state: 'complete',
      reference_id: 'c',
      recorded_at: 't',
      reason: 'checkin_completed',
    },
    {
      id: 'supplement:s:2026-09-28',
      domain: 'supplement',
      label: 'Vitamin D3',
      date: '2026-09-28',
      applicable: true,
      state: 'pending',
      reference_id: 's',
      recorded_at: null,
      reason: 'not_recorded',
    },
  ],
};

describe('DailyProgressCard', () => {
  it('states the explicit denominator and each item state', () => {
    render(<DailyProgressCard progress={base} dayLabel="Today" />);
    expect(screen.getByTestId('dash-daily-progress-count')).toHaveTextContent(
      'Today · 1 of 2 complete'
    );
    expect(screen.getByText('Vitamin D3')).toBeInTheDocument();
    expect(screen.getByText('Not recorded yet')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Daily Progress: 50%' })
    ).toBeInTheDocument();
  });

  it('renders a neutral X with an explanation when nothing applies', () => {
    render(
      <DailyProgressCard
        progress={{
          ...base,
          items: [],
          applicable: 0,
          completed: 0,
          percent: null,
        }}
        dayLabel="Today"
      />
    );
    expect(screen.getByTestId('dash-daily-progress-count')).toHaveTextContent(
      'Today · no tracking tasks'
    );
    expect(
      screen.getByRole('img', { name: 'Daily Progress: No tasks today' })
    ).toBeInTheDocument();
  });
});
