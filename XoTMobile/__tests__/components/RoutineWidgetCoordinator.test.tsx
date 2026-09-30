jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { iosAppGroup: 'group.test' } } },
}));

jest.mock('@bacons/apple-targets', () => {
  const set = jest.fn();
  const remove = jest.fn();
  const reload = jest.fn();
  class ExtensionStorage {
    set = set;
    remove = remove;
    static reloadWidget = reload;
  }
  return { ExtensionStorage, mocks: { set, remove, reload } };
});

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('../../src/hooks/useServerConnection', () => ({
  useServerConnection: jest.fn(() => ({ isConnected: true })),
}));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
  subscribeNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

import { act, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../../src/services/nutritionIdentity';
import RoutineWidgetCoordinator from '../../src/components/RoutineWidgetCoordinator';

const storageMocks = (
  jest.requireMock('@bacons/apple-targets') as {
    mocks: { set: jest.Mock; remove: jest.Mock; reload: jest.Mock };
  }
).mocks;
const mockQuery = useQuery as jest.Mock;
const mockIdentity = getActiveNutritionIdentity as jest.Mock;
const mockSubscribe = subscribeNutritionIdentity as jest.Mock;

describe('RoutineWidgetCoordinator', () => {
  let identityChanged: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });
    mockSubscribe.mockImplementation((listener: () => void) => {
      identityChanged = listener;
      return jest.fn();
    });
    mockIdentity.mockResolvedValue({
      serverConfigId: 'server-a',
      userId: 'user-a',
    });
    mockQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => ({
      data:
        queryKey[3] === 'user-a'
          ? { pagination: { totalCount: 7 } }
          : undefined,
      dataUpdatedAt: 1_790_000_000_000,
      isError: false,
    }));
  });

  it('publishes only a scoped count and reloads the routine widget', async () => {
    render(<RoutineWidgetCoordinator />);

    await waitFor(() => {
      expect(storageMocks.set).toHaveBeenCalledWith('routineWidgetSnapshot', {
        version: 1,
        scope: '["server-a","user-a"]',
        total: 7,
        generatedAt: 1_790_000_000,
      });
    });
    expect(storageMocks.set).toHaveBeenCalledWith(
      'routineWidgetScope',
      '["server-a","user-a"]'
    );
    expect(storageMocks.reload).toHaveBeenCalledWith('routineWidget');
  });

  it('removes the previous snapshot while a new account has no result', async () => {
    render(<RoutineWidgetCoordinator />);
    await waitFor(() => {
      expect(storageMocks.set).toHaveBeenCalledWith(
        'routineWidgetSnapshot',
        expect.objectContaining({ total: 7 })
      );
    });

    let resolveIdentity!: (identity: {
      serverConfigId: string;
      userId: string;
    }) => void;
    mockIdentity.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        resolveIdentity = resolve;
      });
    });
    storageMocks.remove.mockClear();
    storageMocks.reload.mockClear();
    act(() => identityChanged());

    expect(storageMocks.remove).toHaveBeenNthCalledWith(
      1,
      'routineWidgetScope'
    );
    expect(storageMocks.remove).toHaveBeenNthCalledWith(
      2,
      'routineWidgetSnapshot'
    );
    expect(storageMocks.reload).toHaveBeenCalledWith('routineWidget');

    await act(async () => {
      resolveIdentity({ serverConfigId: 'server-a', userId: 'user-b' });
    });

    expect(storageMocks.remove).toHaveBeenCalledWith('routineWidgetSnapshot');
    expect(storageMocks.set).toHaveBeenCalledWith(
      'routineWidgetScope',
      '["server-a","user-b"]'
    );
    expect(storageMocks.set).not.toHaveBeenCalledWith(
      'routineWidgetSnapshot',
      expect.objectContaining({ scope: '["server-a","user-b"]' })
    );
  });
});
