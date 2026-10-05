import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Recaps } from '@/pages/Coaching/Recaps';
import * as api from '@/api/Coaching/coaching';
import { coachingRecapSchema } from '@workspace/shared';
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? _key,
    i18n: { language: 'de' },
  }),
}));
jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({ activeUserId: 'owner', isActingOnBehalf: false }),
}));
jest.mock('@/api/Coaching/coaching', () => ({
  loadCoachingRecaps: jest.fn(),
  loadCoachingRecap: jest.fn(),
  readCoachingRecap: jest.fn(),
  deleteCoachingRecap: jest.fn(),
}));
jest.mock('@/pages/Coaching/ActionFields', () => ({
  ActionFields: () => null,
}));
const recap = coachingRecapSchema.parse({
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'daily',
  from: '2026-10-04',
  to: '2026-10-04',
  createdAt: '2026-10-05T08:00:00Z',
  readAt: null,
  proposalIds: [],
  title: 'Dein Tagesrückblick',
  summary: 'Keine Änderung nötig.',
  observations: [],
  limitations: ['Fehlende Werte sind unbekannt.'],
  evidence: [],
});
const mount = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Recaps onRecommendations={jest.fn()} />
    </QueryClientProvider>
  );
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(api.loadCoachingRecaps)
    .mockResolvedValue({ recaps: [recap], unreadCount: 1, nextOffset: null });
  jest.mocked(api.loadCoachingRecap).mockResolvedValue(recap);
  jest
    .mocked(api.readCoachingRecap)
    .mockResolvedValue({ ...recap, readAt: '2026-10-05T09:00:00Z' });
  jest.mocked(api.deleteCoachingRecap).mockResolvedValue({ deleted: true });
});
it('opens a no-change recap, marks only it read and requires confirmation before deletion', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Open recap' }));
  expect(
    await screen.findByText('What this review cannot establish')
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(api.readCoachingRecap).toHaveBeenCalledWith(recap.id)
  );
  expect(
    screen.queryByRole('button', { name: 'Review suggestions' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Delete recap' }));
  expect(api.deleteCoachingRecap).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Delete recap' }));
  await waitFor(() =>
    expect(api.deleteCoachingRecap).toHaveBeenCalledWith(recap.id)
  );
  confirm.mockRestore();
});
it('shows a failure rather than a fabricated empty recap list', async () => {
  jest.mocked(api.loadCoachingRecaps).mockRejectedValue(new Error('offline'));
  mount();
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByText(/No recaps yet/)).not.toBeInTheDocument();
});
