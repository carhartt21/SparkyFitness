import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobilityDiaryCard from '@/pages/Diary/MobilityDiaryCard';
let mockDelegate = false;
const mockRefetch = jest.fn();
const mockQuery = {
  data: {
    timezone: 'Europe/Berlin',
    sessions: [
      {
        deleted: false,
        data: {
          id: 'session',
          routine: { name: 'Desk mobility' },
          state: 'finished',
          startedAt: '2026-10-03T22:30:00Z',
          outcomes: [{ result: 'completed' }],
        },
      },
    ],
  },
  isError: false,
  refetch: mockRefetch,
};
jest.mock('@/hooks/Mobility/useMobility', () => ({
  useMobility: () => ({ query: mockQuery }),
}));
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ timezone: 'Europe/Berlin' }),
}));
jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({ isActingOnBehalf: mockDelegate }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'de' },
    t: (key: string, values?: Record<string, number>) =>
      key === 'mobilityDiary.counts'
        ? `${values?.['completed']} abgeschlossen · ${values?.['skipped']} übersprungen`
        : key,
  }),
}));
beforeEach(() => {
  mockDelegate = false;
  mockQuery.isError = false;
  jest.clearAllMocks();
});
test('shows the account-local day and uses a real mobility link', () => {
  render(
    <MemoryRouter>
      <MobilityDiaryCard date="2026-10-04" />
    </MemoryRouter>
  );
  expect(screen.getByRole('link').getAttribute('href')).toBe('/mobility');
  expect(screen.getByText(/00:30 · 1 abgeschlossen/)).toBeTruthy();
});
test('hides other days and owner-only mobility when viewing another account', () => {
  const result = render(
    <MemoryRouter>
      <MobilityDiaryCard date="2026-10-03" />
    </MemoryRouter>
  );
  expect(screen.queryByRole('link')).toBeNull();
  mockDelegate = true;
  result.rerender(
    <MemoryRouter>
      <MobilityDiaryCard date="2026-10-04" />
    </MemoryRouter>
  );
  expect(screen.queryByRole('link')).toBeNull();
});
test('shows a retry action instead of hiding a failed load', () => {
  mockQuery.isError = true;
  render(
    <MemoryRouter>
      <MobilityDiaryCard date="2026-10-04" />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});
