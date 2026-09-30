import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert, AppState } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import { useLaunchIconActions } from '../../src/hooks/useLaunchIconActions';
import { getActiveServerConfig } from '../../src/services/storage';
import { navigationRef } from '../../src/components/ActiveWorkoutBar';

jest.mock('expo-quick-actions', () => ({
  initial: { id: 'scan', title: 'Scan' },
  maxCount: 4,
  isSupported: jest.fn().mockResolvedValue(true),
  setItems: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  navigationRef: {
    isReady: jest.fn(() => true),
    getRootState: jest.fn(() => ({ routes: [{ name: 'Tabs' }] })),
    addListener: jest.fn(() => jest.fn()),
  },
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn().mockResolvedValue({ id: 'synthetic' }),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

const emit = async (id: string) => {
  const callback = jest.mocked(QuickActions.addListener).mock.calls.at(-1)![0];
  await act(async () => callback({ id, title: id }));
};
const refreshNavigation = async () => {
  const callback = jest
    .mocked(navigationRef.addListener)
    .mock.calls.find(([type]) => type === 'state')![1];
  await act(async () =>
    callback({ type: 'state', data: { state: undefined } })
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() });
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
  });
  jest.mocked(navigationRef.isReady).mockReturnValue(true);
  jest
    .mocked(getActiveServerConfig)
    .mockResolvedValue({ id: 'synthetic' } as Awaited<
      ReturnType<typeof getActiveServerConfig>
    >);
});

it('holds a cold-start action through onboarding and consumes it once after navigation is ready', async () => {
  const onAction = jest.fn();
  jest.mocked(navigationRef.isReady).mockReturnValue(false);
  const { rerender } = renderHook(
    ({ enabled }) => useLaunchIconActions({ enabled, onAction }),
    { initialProps: { enabled: false } }
  );
  await act(async () => {});
  expect(onAction).not.toHaveBeenCalled();
  rerender({ enabled: true });
  expect(onAction).not.toHaveBeenCalled();
  jest.mocked(navigationRef.isReady).mockReturnValue(true);
  await refreshNavigation();
  await waitFor(() => expect(onAction).toHaveBeenCalledWith('scan'));
  await emit('scan'); // Duplicate initial native event.
  await refreshNavigation();
  expect(onAction).toHaveBeenCalledTimes(1);
});

it('does not replay the process initial action on a root remount', async () => {
  const onAction = jest.fn();
  renderHook(() => useLaunchIconActions({ enabled: true, onAction }));
  await act(async () => {});
  expect(onAction).not.toHaveBeenCalled();
  await emit('food');
  expect(onAction).toHaveBeenCalledWith('food');
});

it('holds the latest intent while a sign-in modal is present', async () => {
  const onAction = jest.fn();
  const { rerender } = renderHook(
    ({ enabled }) => useLaunchIconActions({ enabled, onAction }),
    { initialProps: { enabled: false } }
  );
  await emit('food');
  await emit('measurements');
  expect(onAction).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(onAction).toHaveBeenCalledWith('measurements'));
  expect(onAction).toHaveBeenCalledTimes(1);
});

it('does not bypass a missing server config; retries after setup navigation', async () => {
  const onAction = jest.fn();
  jest.mocked(getActiveServerConfig).mockResolvedValue(null);
  renderHook(() => useLaunchIconActions({ enabled: true, onAction }));
  await emit('food');
  expect(onAction).not.toHaveBeenCalled();
  jest
    .mocked(getActiveServerConfig)
    .mockResolvedValue({ id: 'synthetic' } as Awaited<
      ReturnType<typeof getActiveServerConfig>
    >);
  await refreshNavigation();
  expect(onAction).toHaveBeenCalledWith('food');
});

it('rejects unknown identifiers, without treating native params as navigation URLs', async () => {
  const onAction = jest.fn();
  renderHook(() => useLaunchIconActions({ enabled: true, onAction }));
  await emit('https://untrusted.invalid');
  expect(onAction).not.toHaveBeenCalled();
});

it('reports dispatch errors without crashing or endlessly replaying', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let reject!: (reason: Error) => void;
  const onAction = jest.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      })
  );
  renderHook(() => useLaunchIconActions({ enabled: true, onAction }));
  await emit('activity');
  // Intent has been consumed and its effect cleaned up before a network error.
  await act(async () => reject(new Error('synthetic')));
  await waitFor(() => expect(alert).toHaveBeenCalled());
  await refreshNavigation();
  expect(onAction).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});

it('waits for foreground before opening a warm shortcut', async () => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'background',
  });
  const subscription = jest.spyOn(AppState, 'addEventListener');
  const onAction = jest.fn();
  renderHook(() => useLaunchIconActions({ enabled: true, onAction }));
  await emit('food');
  expect(onAction).not.toHaveBeenCalled();
  const foreground = subscription.mock.calls.at(-1)![1];
  await act(async () => foreground('active'));
  expect(onAction).toHaveBeenCalledWith('food');
  subscription.mockRestore();
});

it('cancels a pending config read when authentication becomes unavailable', async () => {
  let resolve!: (
    value: Awaited<ReturnType<typeof getActiveServerConfig>>
  ) => void;
  jest.mocked(getActiveServerConfig).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const onAction = jest.fn();
  const { rerender } = renderHook(
    ({ enabled }) => useLaunchIconActions({ enabled, onAction }),
    { initialProps: { enabled: true } }
  );
  await emit('food');
  rerender({ enabled: false });
  await act(async () =>
    resolve({ id: 'synthetic' } as Awaited<
      ReturnType<typeof getActiveServerConfig>
    >)
  );
  expect(onAction).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(onAction).toHaveBeenCalledWith('food'));
  expect(onAction).toHaveBeenCalledTimes(1);
});

it('installs four generic native menu items and removes listeners on unmount', async () => {
  const onAction = jest.fn();
  const { unmount } = renderHook(() =>
    useLaunchIconActions({ enabled: true, onAction })
  );
  await waitFor(() => expect(QuickActions.setItems).toHaveBeenCalled());
  const items = jest.mocked(QuickActions.setItems).mock.calls.at(-1)![0]!;
  expect(items.map((item) => item.id)).toEqual([
    'scan',
    'food',
    'activity',
    'measurements',
  ]);
  expect(items.every((item) => !item.params && !item.subtitle)).toBe(true);
  const subscription = jest
    .mocked(QuickActions.addListener)
    .mock.results.at(-1)!.value;
  unmount();
  expect(subscription.remove).toHaveBeenCalled();
});
