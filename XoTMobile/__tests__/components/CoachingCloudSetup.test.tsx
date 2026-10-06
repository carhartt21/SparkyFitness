import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  createCoachingClientV2,
  defaultCoachingSettingsV2,
} from '@workspace/shared';
import CloudSetup from '../../src/components/coaching/CloudSetup';
import { getActiveServerConfig } from '../../src/services/storage';

jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
}));
jest.mock('../../src/components/BottomSheetPicker', () => () => null);
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? _key,
    i18n: { language: 'de' },
  }),
}));

it('copies the proposal-only coaching address for the active server, without a trailing slash', async () => {
  jest.mocked(getActiveServerConfig).mockResolvedValue({
    url: 'https://example.test/',
  } as NonNullable<Awaited<ReturnType<typeof getActiveServerConfig>>>);
  const api = createCoachingClientV2(
    async () => ({ connections: [] }),
    () => 'fixture'
  );
  const view = render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <CloudSetup
        api={api}
        scope="fixture"
        settings={defaultCoachingSettingsV2}
        timezone="Europe/Berlin"
      />
    </QueryClientProvider>
  );
  await waitFor(() =>
    expect(view.getByText('https://example.test/mcp/coaching')).toBeTruthy()
  );
  fireEvent.press(view.getByRole('button', { name: 'Copy MCP address' }));
  expect(Clipboard.setString).toHaveBeenCalledWith(
    'https://example.test/mcp/coaching'
  );
  await waitFor(() =>
    expect(
      view.getByText(/No coaching connection is authorized yet/)
    ).toBeTruthy()
  );
});
