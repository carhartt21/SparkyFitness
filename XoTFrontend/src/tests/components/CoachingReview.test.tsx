import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { CoachingAction, CoachingProposal } from '@workspace/shared';
import Coaching from '@/pages/Coaching/Coaching';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import * as hooks from '@/hooks/Coaching/useCoaching';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ timezone: 'Europe/Berlin' }),
}));
jest.mock('@/contexts/ActiveUserContext', () => ({ useActiveUser: jest.fn() }));
jest.mock('@/hooks/Coaching/useCoaching', () => ({
  useCoachingSettings: jest.fn(),
  useCoachingActions: jest.fn(),
  useCoachingEvidence: jest.fn(),
  useCoachingInbox: jest.fn(),
  useCoachingRefresh: jest.fn(),
  useCoachingPlanning: jest.fn(),
}));
jest.mock('@/pages/Coaching/CoachingSettings', () => ({
  CoachingSettings: () => null,
}));
const id = '00000000-0000-4000-8000-000000000001';
const proposal: CoachingProposal = {
  id,
  runId: id,
  agentId: id,
  snapshotId: id,
  revision: 0,
  status: 'pending',
  topic: 'synthetic',
  domain: 'nutrition',
  title: 'Review diary',
  rationale: 'Recorded days have limited coverage.',
  benefit: 'Improve recording coverage.',
  impact: 4,
  effort: 'low',
  confidence: 0.4,
  evidence: [
    {
      rowIds: ['coverage:nutrition'],
      from: '2026-09-25',
      to: '2026-10-01',
      coverage: 0,
      freshness: 'unknown',
      unit: null,
      limitation: 'Missing days are unknown.',
    },
  ],
  success: {
    metric: 'protein',
    subjectId: null,
    unit: 'g',
    baseline: null,
    target: 80,
    direction: 'minimum',
    minimumCoverage: 0.7,
    reviewDay: '2026-10-08',
  },
  action: {
    kind: 'task',
    title: 'Record diary',
    description: '',
    dueDay: '2026-10-02',
    reminderTime: null,
  },
  expiresDay: '2026-10-15',
  createdAt: '2026-10-01T10:00:00Z',
  publishedAt: '2026-10-01T10:00:00Z',
  reviewedAt: null,
  reviewReason: null,
  activationId: null,
  acceptedAction: null,
};
const preview = jest.fn(
  async (_id: string, _revision: number, action: CoachingAction) => ({
    proposalId: id,
    revision: 0,
    previewToken: 'synthetic-preview',
    action,
    effects: [{ label: 'task', before: null, after: action, unit: null }],
    warnings: [],
  })
);
const review = jest.fn(async () => proposal);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useActiveUser).mockReturnValue({
    activeUserId: id,
    isActingOnBehalf: false,
  } as ReturnType<typeof useActiveUser>);
  jest.mocked(hooks.useCoachingSettings).mockReturnValue({
    data: { featureEnabled: true, settings: { enabled: true } },
    isPending: false,
  } as unknown as ReturnType<typeof hooks.useCoachingSettings>);
  jest.mocked(hooks.useCoachingInbox).mockReturnValue({
    data: { pages: [{ proposals: [proposal], commitments: [] }] },
    isPending: false,
  } as unknown as ReturnType<typeof hooks.useCoachingInbox>);
  jest.mocked(hooks.useCoachingEvidence).mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof hooks.useCoachingEvidence>);
  jest
    .mocked(hooks.useCoachingRefresh)
    .mockReturnValue(jest.fn(async () => undefined));
  jest.mocked(hooks.useCoachingActions).mockReturnValue({
    previewCoaching: preview,
    reviewCoaching: review,
  } as unknown as unknown as ReturnType<typeof hooks.useCoachingActions>);
  window.scrollTo = jest.fn();
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: () => id,
  });
});
it('requires a fresh preview after editing and submits the displayed action and token', async () => {
  render(<Coaching />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Review recommendation' })
  );
  expect(
    screen.queryByRole('button', { name: 'Accept and activate' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Changes to confirm' }));
  await screen.findByRole('button', { name: 'Accept and activate' });
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: 'Record lunch' },
  });
  expect(
    screen.queryByRole('button', { name: 'Accept and activate' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Changes to confirm' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Accept and activate' })
  );
  await waitFor(() =>
    expect(review).toHaveBeenCalledWith(
      id,
      expect.objectContaining({
        decision: 'accept',
        expectedRevision: 0,
        previewToken: 'synthetic-preview',
        action: expect.objectContaining({ title: 'Record lunch' }),
      })
    )
  );
});
it('blocks preview on missing evidence and clears the review after an account switch', () => {
  jest
    .mocked(hooks.useCoachingEvidence)
    .mockReturnValue({ isPending: false, isError: true } as ReturnType<
      typeof hooks.useCoachingEvidence
    >);
  const view = render(<Coaching />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Review recommendation' })
  );
  expect(
    screen.getByRole('button', { name: 'Changes to confirm' })
  ).toBeDisabled();
  expect(preview).not.toHaveBeenCalled();
  jest.mocked(useActiveUser).mockReturnValue({
    activeUserId: 'other-owner',
    isActingOnBehalf: true,
  } as ReturnType<typeof useActiveUser>);
  view.rerender(<Coaching />);
  expect(
    screen.queryByRole('button', { name: 'Decline' })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Switch to your own account'
  );
});
