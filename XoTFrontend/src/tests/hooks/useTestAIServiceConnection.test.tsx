import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTestAIServiceConnection } from '@/hooks/AI/useTestAIServiceConnection';
import { testAIServiceConnection } from '@/api/Settings/aiServiceSettingsService';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/api/Settings/aiServiceSettingsService', () => ({
  testAIServiceConnection: jest.fn(),
}));

const mockTestConnection = jest.mocked(testAIServiceConnection);

function renderConnectionHook() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useTestAIServiceConnection(), { wrapper });
}

describe('AI service connection diagnostics', () => {
  afterEach(() => jest.clearAllMocks());

  it.each([
    [401, undefined, 'unauthorized'],
    [404, undefined, 'notFound'],
    [403, 'model_not_found', 'modelUnavailable'],
    [429, 'credit_balance_exhausted', 'quota'],
    [429, undefined, 'rateLimit'],
    [undefined, 'network_unreachable', 'unreachable'],
  ])('maps status %s and code %s to %s', async (status, code, message) => {
    mockTestConnection.mockResolvedValue({
      ok: false,
      category: 'upstream_error',
      status,
      code,
    });
    const { result } = renderConnectionHook();

    act(() => result.current.testConnection({ service_type: 'openai' }));

    await waitFor(() =>
      expect(result.current.status).toEqual({
        state: 'error',
        message: `settings.aiService.test.categories.${message}`,
      })
    );
  });
});
