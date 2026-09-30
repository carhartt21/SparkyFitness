import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import DashboardRoute from '@/pages/Dashboard/Dashboard';

jest.mock('react-i18next', () =>
  jest.requireActual('@/tests/mocks/reactI18next')
);
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { t: (key: string, defaultValue?: string) => defaultValue || key },
}));

// The dashboard body needs live queries; these tests cover only the legacy
// redirect that runs before it mounts.
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => {
    throw new Error('Dashboard body should not mount for legacy links');
  },
}));

function DiaryProbe() {
  const location = useLocation();
  const state = location.state as { openFoodSearchForMeal?: string } | null;
  return (
    <div data-testid="diary">
      {location.pathname}
      {location.search}|{state?.openFoodSearchForMeal ?? ''}
    </div>
  );
}

function renderAt(entry: {
  pathname: string;
  search?: string;
  state?: unknown;
}) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<DashboardRoute />} />
        <Route path="/diary" element={<DiaryProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('DashboardRoute legacy Diary links', () => {
  it('forwards a dated root link to the Diary', () => {
    renderAt({ pathname: '/', search: '?date=2026-09-01' });
    expect(screen.getByTestId('diary')).toHaveTextContent(
      '/diary?date=2026-09-01|'
    );
  });

  it('forwards a food-search request with its navigation state', () => {
    renderAt({ pathname: '/', state: { openFoodSearchForMeal: 'lunch' } });
    expect(screen.getByTestId('diary')).toHaveTextContent('/diary|lunch');
  });
});
