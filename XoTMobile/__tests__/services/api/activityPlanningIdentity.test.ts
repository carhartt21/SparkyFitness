import { apiFetch } from '../../../src/services/api/apiClient';
import { getActiveServerConfig } from '../../../src/services/storage';
import { getActiveNutritionIdentity } from '../../../src/services/nutritionIdentity';
import { fetchWithTimeout } from '../../../src/utils/concurrency';
jest.mock('../../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
  proxyHeadersToRecord: () => ({}),
}));
jest.mock('../../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../../src/services/api/authService', () => ({
  getAuthHeaders: () => ({}),
  notifySessionExpired: jest.fn(),
}));
jest.mock('../../../src/services/LogService', () => ({ addLog: jest.fn() }));
jest.mock('../../../src/utils/concurrency', () => ({
  DEFAULT_API_TIMEOUT_MS: 1000,
  fetchWithTimeout: jest.fn(),
}));
const config = jest.mocked(getActiveServerConfig);
const identity = jest.mocked(getActiveNutritionIdentity);
const fetcher = jest.mocked(fetchWithTimeout);
const scope = { serverConfigId: 'test-A', userId: 'synthetic-A' };
const options = {
  endpoint: '/api/v2/activity-planning',
  serviceName: 'Activity',
  operation: 'resolve',
  method: 'PUT' as const,
  expectedIdentity: scope,
};
beforeEach(() => {
  jest.resetAllMocks();
  config.mockResolvedValue({
    id: 'test-A',
    url: 'https://a.example.test',
    apiKey: '',
  });
  identity.mockResolvedValue(scope);
});
it('rejects switching between config capture and dispatch without sending a write', async () => {
  identity.mockResolvedValue({
    serverConfigId: 'test-B',
    userId: 'synthetic-B',
  });
  await expect(apiFetch(options)).rejects.toThrow('Account changed');
  expect(fetcher).not.toHaveBeenCalled();
});
it('binds destination to captured credentials and discards late responses', async () => {
  let active = scope;
  identity.mockImplementation(async () => active);
  fetcher.mockImplementation(async (url) => {
    expect(url).toBe('https://a.example.test/api/v2/activity-planning');
    active = { serverConfigId: 'test-B', userId: 'synthetic-B' };
    return {
      ok: true,
      status: 200,
      json: async () => ({ private: 'synthetic-A' }),
    } as Response;
  });
  await expect(apiFetch(options)).rejects.toThrow('Account changed');
});
it('also rejects a same-server user switch while decoding the response', async () => {
  let active = scope;
  identity.mockImplementation(async () => active);
  fetcher.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      active = { ...scope, userId: 'synthetic-B' };
      return { private: 'synthetic-A' };
    },
  } as Response);
  await expect(apiFetch({ ...options, method: 'GET' })).rejects.toThrow(
    'Account changed'
  );
});
