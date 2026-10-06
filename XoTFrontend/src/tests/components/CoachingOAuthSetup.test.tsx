import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { defaultCoachingSettingsV2 } from '@workspace/shared';
import { CloudSetup } from '@/pages/Coaching/CloudSetup';
import McpConsent from '@/pages/Auth/McpConsent';
import * as coaching from '@/api/Coaching/coaching';
import * as auth from '@/api/Auth/auth';
import { readMcpAuthorizationRedirect } from '@/api/Auth/mcpAuthorizationResponse';
import de from '../../../public/locales/de/translation.json';

jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({ activeUserId: 'owner', isActingOnBehalf: false }),
}));
jest.mock('@/hooks/useAuth', () => {
  const user = { id: 'owner' };
  return { useAuth: () => ({ user, loading: false }) };
});
jest.mock('@/api/Coaching/coaching', () => ({
  loadCoachingConnections: jest.fn(),
  addCoachingAgent: jest.fn(),
}));
jest.mock('@/api/Auth/auth', () => ({
  fetchMcpPublicClient: jest.fn(),
  submitMcpConsent: jest.fn(),
}));
jest.mock('@/api/Auth/mcpAuthorizationResponse', () => ({
  readMcpAuthorizationRedirect: jest.fn(),
}));

const language = createInstance();
beforeAll(async () => {
  await language.init({
    lng: 'de',
    resources: { de: { translation: de } },
    interpolation: { escapeValue: false },
  });
});
beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, '', '/');
  jest.mocked(coaching.loadCoachingConnections).mockResolvedValue({
    connections: [],
  });
  jest.mocked(auth.fetchMcpPublicClient).mockResolvedValue({
    ok: true,
    json: async () => ({ client_name: 'ChatGPT' }),
  } as Response);
});
const mount = (child: React.ReactNode) =>
  render(
    <I18nextProvider i18n={language}>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        {child}
      </QueryClientProvider>
    </I18nextProvider>
  );

it('shows the separate coaching address and explains missing proposal authorization in German', async () => {
  mount(
    <CloudSetup settings={defaultCoachingSettingsV2} timezone="Europe/Berlin" />
  );
  expect(
    screen.getByText(`${window.location.origin}/mcp/coaching`)
  ).toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent(
    de.coachingLoop.noAuthorizedConnection
  );
  expect(screen.getByText(de.coachingLoop.cloudStep1)).toBeInTheDocument();
});

it('shows connection loading failures separately from a successful empty list', async () => {
  jest
    .mocked(coaching.loadCoachingConnections)
    .mockRejectedValue(new Error('offline'));
  mount(
    <CloudSetup settings={defaultCoachingSettingsV2} timezone="Europe/Berlin" />
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    de.coachingLoop.connectionsError
  );
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('identifies a legacy consent request and uses the actual OAuth client name', async () => {
  window.history.replaceState(
    {},
    '',
    '/assistant/consent?client_id=fixture&sig=fixture&scope=mcp%3Aread%20mcp%3Awrite'
  );
  mount(<McpConsent />);
  expect(
    await screen.findByText('ChatGPT mit X on Track verbinden?')
  ).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    de.coachingLoop.legacyConsent
  );
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

it('requires at least one selected review area and binds only approved areas at protocol 2', async () => {
  window.history.replaceState(
    {},
    '',
    '/assistant/consent?client_id=fixture&sig=fixture&scope=mcp%3Aread%20mcp%3Apropose'
  );
  jest
    .mocked(auth.submitMcpConsent)
    .mockResolvedValue({ ok: true } as Response);
  jest
    .mocked(readMcpAuthorizationRedirect)
    .mockResolvedValue('https://example.test/callback');
  // Simulate a recoverable binding error so this fixture never navigates away.
  jest
    .mocked(coaching.addCoachingAgent)
    .mockRejectedValue(new Error('fixture binding error'));
  mount(<McpConsent />);
  await screen.findByText('ChatGPT mit X on Track verbinden?');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByText(/Auf deine Anweisung/)).not.toBeInTheDocument();
  for (const checkbox of screen.getAllByRole('checkbox'))
    fireEvent.click(checkbox);
  expect(screen.getByRole('button', { name: 'Verbinden' })).toBeDisabled();
  fireEvent.click(
    screen.getByRole('checkbox', { name: de.coaching.domains.nutrition })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Verbinden' }));
  await waitFor(() =>
    expect(coaching.addCoachingAgent).toHaveBeenCalledWith({
      name: 'ChatGPT',
      domains: ['nutrition'],
      oauthClientId: 'fixture',
      protocolVersion: 2,
      contextPermissions: [],
    })
  );
  expect(auth.submitMcpConsent).toHaveBeenCalledWith(
    'client_id=fixture&sig=fixture&scope=mcp%3Aread%20mcp%3Apropose',
    true
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'fixture binding error'
  );
});
