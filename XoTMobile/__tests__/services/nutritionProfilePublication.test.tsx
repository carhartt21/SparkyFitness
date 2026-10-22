import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { fetchProfile } from '../../src/services/api/profileApi';
import { IdentityChangedError } from '../../src/services/api/apiClient';
import { notifySessionExpired } from '../../src/services/api/authService';
import { retryPendingWorkoutExports } from '../../src/services/workoutHealthExport';
import {
  clearSessionToken,
  deleteServerConfig,
  saveServerConfig,
  setActiveServerConfig,
  getActiveServerConfig,
  clearServerConfigCache,
  type ServerConfig,
} from '../../src/services/storage';
import {
  getActiveNutritionIdentity,
  forgetActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../../src/services/nutritionIdentity';
import {
  beginNutritionIdentityChange,
  nutritionConfigChanging,
  nutritionIdentityBlocked,
} from '../../src/services/nutritionIdentityLifecycle';
import * as identityModule from '../../src/services/nutritionIdentity';
import { readMealFoodHistory } from '../../src/services/mealFoodSuggestions';
import { useMealFoodHistory } from '../../src/hooks/useMealFoodHistory';
import {
  createTestQueryClient,
  createQueryWrapper,
} from '../hooks/queryTestUtils';

jest.mock('../../src/services/workoutHealthExport', () => ({
  retryPendingWorkoutExports: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));
jest.mock('../../src/services/api/authService', () => ({
  getAuthHeaders: (c: ServerConfig) => ({
    Authorization: `Bearer ${c.authType === 'session' && c.sessionToken ? c.sessionToken : c.apiKey}`,
  }),
  notifySessionExpired: jest.fn(),
}));
// Real storage/config/profile/identity/binder/history/hook; only native persistence,
// fetch and export are replaced. One synthetic owner plus account-switch sentinels.
const owner = { serverConfigId: 'synthetic-config', userId: 'synthetic-owner' };
const configA: ServerConfig = {
  id: owner.serverConfigId,
  url: 'https://synthetic.invalid',
  apiKey: 'fixture-key',
  proxyHeaders: [{ name: 'X-Proxy', value: 'fixture-proxy' }],
};
const key = '@SparkyFitness/nutrition-identity/v1/synthetic-config';
const rows = [
  {
    id: 'synthetic-row',
    food_id: 'synthetic-food',
    meal_type_id: 'synthetic-meal',
    entry_date: '2026-10-12',
  },
];
let data: Map<string, string>;
let secure: Map<string, string>;
let beforeRead: ((k: string) => Promise<void>) | undefined;
let beforeWrite: ((k: string, value: string) => Promise<void>) | undefined;
let beforeRemove: ((k: string) => Promise<void>) | undefined;
let profileOwner: string;
const fetchMock = jest.fn<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>();
const originalFetch = global.fetch;
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const ok = (value: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => value,
    text: async () => 'synthetic error',
  }) as Response;
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
async function establish() {
  await fetchProfile();
  jest.mocked(retryPendingWorkoutExports).mockClear();
  fetchMock.mockClear();
}
function delayedProfile() {
  const entered = deferred<void>();
  const body = deferred<unknown>();
  fetchMock.mockResolvedValueOnce({
    ...ok({}),
    json: async () => {
      entered.resolve();
      return body.promise;
    },
  } as Response);
  const request = fetchProfile();
  const rejected = expect(request).rejects.toBeInstanceOf(IdentityChangedError);
  return { entered, body, rejected };
}
beforeEach(async () => {
  data = new Map();
  secure = new Map();
  beforeRead = undefined;
  beforeWrite = undefined;
  beforeRemove = undefined;
  profileOwner = owner.userId;
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockImplementation(async (k) => {
    const v = data.get(k) ?? null;
    await beforeRead?.(k);
    return v;
  });
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (k, v) => {
    await beforeWrite?.(k, v);
    data.set(k, v);
  });
  jest.mocked(AsyncStorage.removeItem).mockImplementation(async (k) => {
    await beforeRemove?.(k);
    data.delete(k);
  });
  jest
    .mocked(AsyncStorage.getAllKeys)
    .mockImplementation(async () => [...data.keys()]);
  jest
    .mocked(AsyncStorage.multiGet)
    .mockImplementation(async (keys) =>
      keys.map((k) => [k, data.get(k) ?? null])
    );
  jest
    .mocked(SecureStore.getItemAsync)
    .mockImplementation(async (k) => secure.get(k) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (k, v) => {
    secure.set(k, v);
  });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (k) => {
    secure.delete(k);
  });
  clearServerConfigCache();
  await saveServerConfig({
    ...configA,
    proxyHeaders: configA.proxyHeaders?.map((h) => ({ ...h })),
  });
  jest.mocked(retryPendingWorkoutExports).mockResolvedValue(undefined);
  fetchMock.mockReset().mockImplementation(async (url, init) => {
    if (init?.method !== 'GET')
      throw new Error('No synthetic mutation allowed');
    if (String(url).endsWith('/api/identity/profiles'))
      return ok({ id: profileOwner });
    if (String(url).includes('/api/food-entries/range/')) return ok(rows);
    throw new Error('Unexpected synthetic endpoint');
  });
  global.fetch = fetchMock;
});
afterAll(() => {
  global.fetch = originalFetch;
});

it.each(['apiKey', 'session'] as const)(
  'cold %s bootstrap and ordinary refresh succeed without self-invalidating',
  async (authType) => {
    await saveServerConfig({
      ...configA,
      authType,
      sessionToken: 'fixture-session',
    });
    expect(await getActiveNutritionIdentity()).toBeNull();
    const observed: Promise<unknown>[] = [];
    const stop = subscribeNutritionIdentity(() => {
      observed.push(getActiveNutritionIdentity());
    });
    try {
      await expect(fetchProfile()).resolves.toMatchObject({ id: owner.userId });
      await expect(fetchProfile()).resolves.toMatchObject({ id: owner.userId });
      expect(await getActiveNutritionIdentity()).toEqual(owner);
      expect(await Promise.all(observed)).toEqual([owner]);
      expect(retryPendingWorkoutExports).toHaveBeenCalledTimes(2);
      for (const [url, init] of fetchMock.mock.calls) {
        expect(url).toBe('https://synthetic.invalid/api/identity/profiles');
        expect(init?.headers).toMatchObject({
          authorization:
            authType === 'session'
              ? 'Bearer fixture-session'
              : 'Bearer fixture-key',
          'x-proxy': 'fixture-proxy',
        });
        expect(init?.credentials).toBe('omit');
      }
    } finally {
      stop();
    }
  }
);
it('late profile JSON rejects after a different config establishes its own identity', async () => {
  const old = delayedProfile();
  await old.entered.promise;
  await saveServerConfig({
    ...configA,
    id: 'switch-config',
    url: 'https://switch.invalid',
    apiKey: 'switch-key',
  });
  profileOwner = 'switch-owner';
  await fetchProfile();
  old.body.resolve({ id: owner.userId });
  await old.rejected;
  expect(await getActiveNutritionIdentity()).toEqual({
    serverConfigId: 'switch-config',
    userId: 'switch-owner',
  });
  expect(retryPendingWorkoutExports).toHaveBeenCalledTimes(1);
  expect(
    data.get('@SparkyFitness/nutrition-identity/v1/switch-config')
  ).not.toContain(owner.userId);
});
it.each(['url', 'apiKey', 'sessionToken', 'authType', 'proxyHeaders'] as const)(
  'actual same-ID %s replacement invalidates a pending profile body',
  async (field) => {
    await saveServerConfig({
      ...configA,
      authType: 'session',
      sessionToken: 'fixture-session',
    });
    const old = delayedProfile();
    await old.entered.promise;
    const next: ServerConfig = {
      ...configA,
      authType: 'session',
      sessionToken: 'fixture-session',
    };
    if (field === 'url') next.url = 'https://switch.invalid';
    if (field === 'apiKey') {
      next.authType = 'apiKey';
      next.apiKey = 'switch-key';
    }
    if (field === 'sessionToken') next.sessionToken = 'switch-session';
    if (field === 'authType') next.authType = 'apiKey';
    if (field === 'proxyHeaders')
      next.proxyHeaders = [{ name: 'X-Proxy', value: 'switch-proxy' }];
    await saveServerConfig(next);
    old.body.resolve({ id: owner.userId });
    await old.rejected;
    expect(await getActiveNutritionIdentity()).toBeNull();
    expect(data.has(key)).toBe(false);
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  }
);
it('actual server ABA cannot revive a pending bootstrap with equal final values', async () => {
  const old = delayedProfile();
  await old.entered.promise;
  await saveServerConfig({ ...configA, id: 'switch-config' });
  await setActiveServerConfig(configA.id);
  expect((await getActiveServerConfig())?.apiKey).toBe(configA.apiKey);
  old.body.resolve({ id: owner.userId });
  await old.rejected;
  expect(data.has(key)).toBe(false);
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
});
it('a delayed identity reader cannot expose its old snapshot after reauthentication', async () => {
  await establish();
  const entered = deferred<void>();
  const release = deferred<void>();
  beforeRead = async (k) => {
    if (k === key) {
      beforeRead = undefined;
      entered.resolve();
      await release.promise;
    }
  };
  const stale = getActiveNutritionIdentity();
  await entered.promise;
  await saveServerConfig({ ...configA, apiKey: 'switch-key' });
  profileOwner = 'switch-owner';
  await fetchProfile();
  release.resolve();
  expect(await stale).toBeNull();
  expect((await getActiveNutritionIdentity())?.userId).toBe('switch-owner');
});
it.each(['same', 'different'] as const)(
  'a deferred native write settles before the %s-key new profile publication and cannot erase it',
  async (destination) => {
    const entered = deferred<void>();
    const release = deferred<void>();
    beforeWrite = async (k, value) => {
      if (k === key && JSON.parse(value).userId === owner.userId) {
        beforeWrite = undefined;
        entered.resolve();
        await release.promise;
      }
    };
    const old = fetchProfile();
    const rejected = expect(old).rejects.toBeInstanceOf(IdentityChangedError);
    await entered.promise;
    const switched = saveServerConfig({
      ...configA,
      id: destination === 'same' ? configA.id : 'switch-config',
      apiKey: 'switch-key',
    });
    const next = switched.then(async () => {
      profileOwner = 'switch-owner';
      return fetchProfile();
    });
    await tick();
    expect(await getActiveNutritionIdentity()).toBeNull();
    release.resolve();
    await rejected;
    await next;
    expect((await getActiveNutritionIdentity())?.userId).toBe('switch-owner');
    expect(retryPendingWorkoutExports).toHaveBeenCalledTimes(1);
    const currentKey =
      destination === 'same'
        ? key
        : '@SparkyFitness/nutrition-identity/v1/switch-config';
    expect(JSON.parse(data.get(currentKey) ?? '{}').userId).toBe(
      'switch-owner'
    );
  }
);
it('forget invalidates before its delayed removal, then cannot erase the newer same-ID profile', async () => {
  await establish();
  const entered = deferred<void>();
  const release = deferred<void>();
  beforeRemove = async (k) => {
    if (k === key) {
      beforeRemove = undefined;
      entered.resolve();
      await release.promise;
    }
  };
  const forgotten = forgetActiveNutritionIdentity();
  await entered.promise;
  expect(await getActiveNutritionIdentity()).toBeNull();
  const next = saveServerConfig({ ...configA, apiKey: 'switch-key' }).then(
    async () => {
      profileOwner = 'switch-owner';
      return fetchProfile();
    }
  );
  release.resolve();
  await forgotten;
  await next;
  expect((await getActiveNutritionIdentity())?.userId).toBe('switch-owner');
  expect(retryPendingWorkoutExports).toHaveBeenCalledTimes(1);
});
it('late config hydration cannot poison the active cache after a real config switch', async () => {
  clearServerConfigCache();
  const entered = deferred<void>();
  const release = deferred<void>();
  beforeRead = async (k) => {
    if (k === 'activeServerConfigId') {
      beforeRead = undefined;
      entered.resolve();
      await release.promise;
    }
  };
  const stale = getActiveServerConfig();
  await entered.promise;
  await saveServerConfig({
    ...configA,
    id: 'switch-config',
    url: 'https://switch.invalid',
  });
  release.resolve();
  expect(await stale).toBeNull();
  expect((await getActiveServerConfig())?.id).toBe('switch-config');
});
it.each([401, 403, 503])(
  'profile HTTP%s preserves error semantics without publication or export',
  async (status) => {
    fetchMock.mockResolvedValue(ok({}, status));
    await expect(fetchProfile()).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: status,
    });
    expect(data.has(key)).toBe(false);
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  }
);
it.each(['fetch', 'json', 'missing-owner'] as const)(
  'profile %s failure cannot establish identity',
  async (failure) => {
    if (failure === 'fetch')
      fetchMock.mockRejectedValue(new Error('synthetic offline'));
    if (failure === 'json')
      fetchMock.mockResolvedValue({
        ...ok({}),
        json: async () => {
          throw new SyntaxError('synthetic JSON');
        },
      } as Response);
    if (failure === 'missing-owner') fetchMock.mockResolvedValue(ok({}));
    await expect(fetchProfile()).rejects.toThrow();
    expect(data.has(key)).toBe(false);
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  }
);
it('a late session401 error body cannot expire the replacement account', async () => {
  await saveServerConfig({
    ...configA,
    authType: 'session',
    sessionToken: 'fixture-session',
  });
  const entered = deferred<void>();
  const release = deferred<string>();
  fetchMock.mockResolvedValue({
    ...ok({}, 401),
    text: async () => {
      entered.resolve();
      return release.promise;
    },
  } as Response);
  const old = fetchProfile();
  const rejected = expect(old).rejects.toBeInstanceOf(IdentityChangedError);
  await entered.promise;
  await saveServerConfig({
    ...configA,
    authType: 'session',
    sessionToken: 'switch-session',
  });
  release.resolve('obsolete401');
  await rejected;
  expect(notifySessionExpired).not.toHaveBeenCalled();
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
});

it('ACTUAL integrated history issues profile then range with the same scoped transport and no publication/export', async () => {
  await establish();
  const writes = jest
    .mocked(AsyncStorage.setItem)
    .mock.calls.filter(([k]) => k === key).length;
  const stopFns: jest.Mock[] = [];
  const subscribe = identityModule.subscribeNutritionIdentity;
  const spy = jest
    .spyOn(identityModule, 'subscribeNutritionIdentity')
    .mockImplementation((listener) => {
      const stop = jest.fn(subscribe(listener));
      stopFns.push(stop);
      return stop;
    });
  try {
    expect(
      await readMealFoodHistory(owner, '2026-09-15', '2026-10-12')
    ).toEqual(rows);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://synthetic.invalid/api/identity/profiles',
      'https://synthetic.invalid/api/food-entries/range/2026-09-15/2026-10-12',
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.method).toBe('GET');
      expect(init?.credentials).toBe('omit');
      expect(init?.headers).toMatchObject({
        authorization: 'Bearer fixture-key',
        'x-proxy': 'fixture-proxy',
      });
    }
    expect(stopFns).toHaveLength(2);
    for (const stop of stopFns) expect(stop).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(AsyncStorage.setItem).mock.calls.filter(([k]) => k === key)
    ).toHaveLength(writes);
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
});
it('ACTUAL integrated profile mismatch stops before the history range read', async () => {
  await establish();
  profileOwner = 'switch-owner';
  await expect(
    readMealFoodHistory(owner, '2026-09-15', '2026-10-12')
  ).rejects.toThrow('History identity changed');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
});
it.each(['profile', 'range', 'ABA'] as const)(
  'ACTUAL integrated history drops a %s-body switch, including late whole-range data',
  async (phase) => {
    await establish();
    const entered = deferred<void>();
    const release = deferred<unknown>();
    fetchMock.mockImplementation(async (url) => {
      const isRange = String(url).includes('/range/');
      if (isRange === (phase === 'range'))
        return {
          ...ok({}),
          json: async () => {
            entered.resolve();
            return release.promise;
          },
        } as Response;
      return isRange ? ok(rows) : ok({ id: owner.userId });
    });
    const request = readMealFoodHistory(owner, '2026-09-15', '2026-10-12');
    const rejected = expect(request).rejects.toThrow();
    await entered.promise;
    await saveServerConfig({ ...configA, apiKey: 'switch-key' });
    if (phase === 'ABA') await saveServerConfig(configA);
    release.resolve(phase === 'range' ? rows : { id: owner.userId });
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(phase === 'range' ? 2 : 1);
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  }
);
it.each(['403', 'offline'] as const)(
  'ACTUAL history preserves %s refusal for ordinary-list fallback',
  async (failure) => {
    await establish();
    if (failure === '403') fetchMock.mockResolvedValue(ok({}, 403));
    else fetchMock.mockRejectedValue(new Error('synthetic offline'));
    await expect(
      readMealFoodHistory(owner, '2026-09-15', '2026-10-12')
    ).rejects.toThrow();
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  }
);
it('ACTUAL history hook never exposes old in-flight range data after a same-ID owner switch', async () => {
  await establish();
  const entered = deferred<void>();
  const release = deferred<unknown>();
  fetchMock.mockImplementation(async (url) =>
    String(url).includes('/range/')
      ? ({
          ...ok({}),
          json: async () => {
            entered.resolve();
            return release.promise;
          },
        } as Response)
      : ok({ id: profileOwner })
  );
  const query = createTestQueryClient();
  const hook = renderHook(
    ({ user }) => useMealFoodHistory(user, '2026-10-12', true),
    { initialProps: { user: owner.userId }, wrapper: createQueryWrapper(query) }
  );
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/range/'))
    ).toBe(true)
  );
  await entered.promise;
  await act(async () => {
    await saveServerConfig({ ...configA, apiKey: 'switch-key' });
    profileOwner = 'switch-owner';
    release.resolve(rows);
  });
  hook.rerender({ user: 'switch-owner' });
  await act(async () => {
    await tick();
  });
  expect(hook.result.current.entries).toEqual([]);
  expect(
    query
      .getQueryCache()
      .getAll()
      .every((q) => !q.queryKey.includes('switch-owner') || !q.state.data)
  ).toBe(true);
  hook.unmount();
  query.clear();
});
it('ACTUAL history hook succeeds on its owner/window key and falls back when disabled', async () => {
  await establish();
  const query = createTestQueryClient();
  const hook = renderHook(
    ({ enabled }) => useMealFoodHistory(owner.userId, '2026-10-12', enabled),
    { initialProps: { enabled: true }, wrapper: createQueryWrapper(query) }
  );
  await waitFor(() => expect(hook.result.current.entries).toEqual(rows));
  const keys = query
    .getQueryCache()
    .getAll()
    .map((q) => q.queryKey);
  expect(
    keys.some(
      (k) =>
        k.includes(owner.serverConfigId) &&
        k.includes(owner.userId) &&
        k.includes('2026-10-12')
    )
  ).toBe(true);
  hook.rerender({ enabled: false });
  expect(hook.result.current.entries).toEqual([]);
  hook.unmount();
  query.clear();
});

it.each(['clear-session', 'delete'] as const)(
  'actual %s boundary invalidates a pending profile before credential removal',
  async (change) => {
    await saveServerConfig({
      ...configA,
      authType: 'session',
      sessionToken: 'fixture-session',
    });
    const old = delayedProfile();
    await old.entered.promise;
    if (change === 'clear-session') await clearSessionToken(configA.id);
    else await deleteServerConfig(configA.id);
    old.body.resolve({ id: owner.userId });
    await old.rejected;
    expect(await getActiveNutritionIdentity()).toBeNull();
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  }
);
it('a delayed profile-publication read cannot publish after same-ID reauthentication', async () => {
  const entered = deferred<void>();
  const release = deferred<void>();
  beforeRead = async (k) => {
    if (k === key) {
      beforeRead = undefined;
      entered.resolve();
      await release.promise;
    }
  };
  const old = fetchProfile();
  const rejected = expect(old).rejects.toBeInstanceOf(IdentityChangedError);
  await entered.promise;
  const next = saveServerConfig({ ...configA, apiKey: 'switch-key' }).then(
    async () => {
      profileOwner = 'switch-owner';
      await fetchProfile();
    }
  );
  expect(await getActiveNutritionIdentity()).toBeNull();
  release.resolve();
  await rejected;
  await next;
  expect((await getActiveNutritionIdentity())?.userId).toBe('switch-owner');
  expect(retryPendingWorkoutExports).toHaveBeenCalledTimes(1);
});
it.each(['mismatch', '403', 'offline', 'late-switch'] as const)(
  'ACTUAL history releases both observers on %s failure',
  async (failure) => {
    await establish();
    const stopFns: jest.Mock[] = [];
    const subscribe = identityModule.subscribeNutritionIdentity;
    const spy = jest
      .spyOn(identityModule, 'subscribeNutritionIdentity')
      .mockImplementation((listener) => {
        const stop = jest.fn(subscribe(listener));
        stopFns.push(stop);
        return stop;
      });
    try {
      if (failure === 'mismatch') profileOwner = 'switch-owner';
      if (failure === '403') fetchMock.mockResolvedValue(ok({}, 403));
      if (failure === 'offline')
        fetchMock.mockRejectedValue(new Error('synthetic offline'));
      const entered = deferred<void>();
      const release = deferred<unknown>();
      if (failure === 'late-switch')
        fetchMock.mockResolvedValue({
          ...ok({}),
          json: async () => {
            entered.resolve();
            return release.promise;
          },
        } as Response);
      const request = readMealFoodHistory(owner, '2026-09-15', '2026-10-12');
      const rejected = expect(request).rejects.toThrow();
      if (failure === 'late-switch') {
        await entered.promise;
        await saveServerConfig({ ...configA, apiKey: 'switch-key' });
        release.resolve({ id: owner.userId });
      }
      await rejected;
      expect(stopFns).toHaveLength(2);
      for (const stop of stopFns) expect(stop).toHaveBeenCalledTimes(1);
      expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  }
);

it('same IDs with a replaced transport cannot reuse the preceding server history cache', async () => {
  await establish();
  const query = createTestQueryClient();
  const hook = renderHook(
    () => useMealFoodHistory(owner.userId, '2026-10-12', true),
    { wrapper: createQueryWrapper(query) }
  );
  const release = deferred<unknown>();
  try {
    await waitFor(() => expect(hook.result.current.entries).toEqual(rows));
    fetchMock.mockImplementation(async (url) =>
      String(url).includes('/range/')
        ? ({ ...ok({}), json: async () => release.promise } as Response)
        : ok({ id: owner.userId })
    );
    await act(async () => {
      await saveServerConfig({ ...configA, url: 'https://switch.invalid' });
      await fetchProfile();
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).startsWith(
            'https://switch.invalid/api/food-entries/range/'
          )
        )
      ).toBe(true)
    );
    expect(hook.result.current.entries).toEqual([]);
    const replacementRows = [{ ...rows[0], id: 'replacement-server-row' }];
    await act(async () => {
      release.resolve(replacementRows);
    });
    await waitFor(() =>
      expect(hook.result.current.entries).toEqual(replacementRows)
    );
  } finally {
    release.resolve([]);
    hook.unmount();
    query.clear();
  }
});

it('missing profile owner keeps actual history hook inert while scope is unknown', async () => {
  const query = createTestQueryClient();
  const hook = renderHook(
    () => useMealFoodHistory(undefined, '2026-10-12', true),
    { wrapper: createQueryWrapper(query) }
  );
  await act(async () => {
    await tick();
  });
  expect(hook.result.current.entries).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
  hook.unmount();
  query.clear();
});

async function establishWithInactiveConfig() {
  const inactive = {
    ...configA,
    id: 'inactive-config',
    url: 'https://inactive.synthetic.invalid',
    sessionToken: 'inactive-token',
  };
  await saveServerConfig(inactive);
  profileOwner = 'inactive-owner';
  await fetchProfile();
  await saveServerConfig(configA);
  profileOwner = owner.userId;
  await establish();
  return inactive;
}

it.each(['delete', 'clear-session'] as const)(
  'inactive %s preserves established active identity without requiring settings refresh',
  async (change) => {
    const inactive = await establishWithInactiveConfig();
    clearServerConfigCache();
    if (change === 'delete') await deleteServerConfig(inactive.id);
    else await clearSessionToken(inactive.id);
    expect(await getActiveNutritionIdentity()).toEqual(owner);
    expect(await getActiveServerConfig()).toMatchObject(configA);
    expect(
      data.has('@SparkyFitness/nutrition-identity/v1/inactive-config')
    ).toBe(false);
    expect(secure.has('sessionToken_inactive-config')).toBe(false);
    if (change === 'delete')
      expect(secure.has('apiKey_inactive-config')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  }
);

it('inactive deletion restores the ACTUAL mounted history hook after its conservative invalidation', async () => {
  const inactive = await establishWithInactiveConfig();
  const query = createTestQueryClient();
  const hook = renderHook(
    () => useMealFoodHistory(owner.userId, '2026-10-12', true),
    { wrapper: createQueryWrapper(query) }
  );
  await waitFor(() => expect(hook.result.current.entries).toEqual(rows));
  const oldRanges = fetchMock.mock.calls.filter(([url]) =>
    String(url).includes('/api/food-entries/range/')
  ).length;
  try {
    await act(async () => {
      await deleteServerConfig(inactive.id);
    });
    await waitFor(() => expect(hook.result.current.entries).toEqual(rows));
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/api/food-entries/range/')
      ).length
    ).toBeGreaterThan(oldRanges);
    expect(
      fetchMock.mock.calls.every(([url]) =>
        String(url).startsWith(configA.url + '/')
      )
    ).toBe(true);
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  } finally {
    hook.unmount();
    query.clear();
  }
});

it('failed inactive credential deletion rejects but does not strand the unaffected active identity', async () => {
  const inactive = await establishWithInactiveConfig();
  jest
    .mocked(SecureStore.deleteItemAsync)
    .mockRejectedValueOnce(new Error('synthetic native delete failure'));
  await expect(deleteServerConfig(inactive.id)).rejects.toThrow(
    'synthetic native delete failure'
  );
  expect(await getActiveNutritionIdentity()).toEqual(owner);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
});

it('inactive cleanup cannot revive identity across an overlapping active credential change', async () => {
  const inactive = await establishWithInactiveConfig();
  const entered = deferred<void>();
  const release = deferred<void>();
  beforeRemove = async (k) => {
    if (k.endsWith('/inactive-config')) {
      beforeRemove = undefined;
      entered.resolve();
      await release.promise;
    }
  };
  const deletion = deleteServerConfig(inactive.id);
  await entered.promise;
  const replacement = saveServerConfig({
    ...configA,
    apiKey: 'replacement-fixture-key',
  });
  expect(await getActiveNutritionIdentity()).toBeNull();
  release.resolve();
  await Promise.all([deletion, replacement]);
  expect(await getActiveNutritionIdentity()).toBeNull();
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  profileOwner = 'replacement-owner';
  await fetchProfile();
  expect(await getActiveNutritionIdentity()).toEqual({
    ...owner,
    userId: 'replacement-owner',
  });
});

it('inactive deletion cannot unblock a previously invalidated persisted identity', async () => {
  const inactive = await establishWithInactiveConfig();
  await forgetActiveNutritionIdentity();
  // Native-I/O sentinel: an obsolete persisted value must stay behind the invalidated gate.
  data.set(key, JSON.stringify({ version: 1, userId: 'obsolete-owner' }));
  await deleteServerConfig(inactive.id);
  expect(await getActiveNutritionIdentity()).toBeNull();
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
});

it('conservative inactive invalidation still rejects a delayed profile and leaves the established active owner intact', async () => {
  const inactive = await establishWithInactiveConfig();
  const old = delayedProfile();
  await old.entered.promise;
  await deleteServerConfig(inactive.id);
  old.body.resolve({ id: 'obsolete-owner' });
  await old.rejected;
  expect(await getActiveNutritionIdentity()).toEqual(owner);
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
});

async function establishWithInactivePair() {
  await saveServerConfig({
    ...configA,
    id: 'inactive-one',
    sessionToken: 'inactive-one-token',
  });
  await saveServerConfig({
    ...configA,
    id: 'inactive-two',
    sessionToken: 'inactive-two-token',
  });
  await saveServerConfig(configA);
  profileOwner = owner.userId;
  await establish();
}
async function startHeldInactivePair() {
  const entered = deferred<void>();
  const release = deferred<void>();
  beforeRemove = async (k) => {
    if (k.endsWith('/inactive-one')) {
      beforeRemove = undefined;
      entered.resolve();
      await release.promise;
    }
  };
  const first = deleteServerConfig('inactive-one');
  await entered.promise;
  const second = clearSessionToken('inactive-two');
  return { first, second, release };
}
it('N2 actual overlapping inactive cleanup recovers A without an explicit profile fetch', async () => {
  await establishWithInactivePair();
  const saved = data.get(key);
  const held = await startHeldInactivePair();
  expect(await getActiveNutritionIdentity()).toBeNull();
  held.release.resolve();
  await Promise.all([held.first, held.second]);
  expect(await getActiveNutritionIdentity()).toEqual(owner);
  expect(await getActiveServerConfig()).toMatchObject(configA);
  expect(data.get(key)).toBe(saved);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
});
it.each(['delete', 'token'] as const)(
  'N2 last finishing %s member alone restores inactive-group availability',
  async (last) => {
    await establishWithInactivePair();
    clearServerConfigCache();
    const entered = deferred<void>();
    const release = deferred<void>();
    const heldKey =
      last === 'delete' ? 'apiKey_inactive-one' : 'sessionToken_inactive-two';
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (k) => {
      if (k === heldKey) {
        entered.resolve();
        await release.promise;
      }
      secure.delete(k);
    });
    const held =
      last === 'delete'
        ? deleteServerConfig('inactive-one')
        : clearSessionToken('inactive-two');
    await entered.promise;
    if (last === 'delete') await clearSessionToken('inactive-two');
    else await deleteServerConfig('inactive-one');
    expect(await getActiveNutritionIdentity()).toBeNull();
    release.resolve();
    await held;
    expect(await getActiveNutritionIdentity()).toEqual(owner);
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  }
);
it('N2 actual mounted history returns after the complete inactive group without profile publication/export', async () => {
  await establishWithInactivePair();
  const query = createTestQueryClient();
  const hook = renderHook(
    () => useMealFoodHistory(owner.userId, '2026-10-12', true),
    { wrapper: createQueryWrapper(query) }
  );
  await waitFor(() => expect(hook.result.current.entries).toEqual(rows));
  let held!: Awaited<ReturnType<typeof startHeldInactivePair>>;
  await act(async () => {
    held = await startHeldInactivePair();
  });
  try {
    await waitFor(() => expect(hook.result.current.entries).toEqual([]));
    await act(async () => {
      held.release.resolve();
      await Promise.all([held.first, held.second]);
    });
    await waitFor(() => expect(hook.result.current.entries).toEqual(rows));
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  } finally {
    hook.unmount();
    query.clear();
  }
});
it.each([
  'url',
  'apiKey',
  'sessionToken',
  'authType',
  'proxyHeaders',
  'ABA',
  'active-token',
  'forget',
] as const)(
  'N2 inactive recovery never clears an intervening active %s invalidation',
  async (change) => {
    await establishWithInactivePair();
    const held = await startHeldInactivePair();
    let mutation: Promise<void>;
    if (change === 'ABA')
      mutation = (async () => {
        await setActiveServerConfig('inactive-two');
        await setActiveServerConfig(configA.id);
      })();
    else if (change === 'active-token')
      mutation = clearSessionToken(configA.id);
    else if (change === 'forget') mutation = forgetActiveNutritionIdentity();
    else {
      const next = { ...configA };
      if (change === 'url') next.url = 'https://replacement.synthetic.invalid';
      if (change === 'apiKey') next.apiKey = 'replacement-fixture-key';
      if (change === 'sessionToken')
        next.sessionToken = 'replacement-fixture-session';
      if (change === 'authType') next.authType = 'session';
      if (change === 'proxyHeaders')
        next.proxyHeaders = [
          { name: 'X-Proxy', value: 'replacement-fixture-proxy' },
        ];
      mutation = saveServerConfig(next);
    }
    expect(await getActiveNutritionIdentity()).toBeNull();
    held.release.resolve();
    await Promise.all([held.first, held.second, mutation]);
    expect(await getActiveNutritionIdentity()).toBeNull();
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
    profileOwner = 'replacement-owner';
    await fetchProfile();
    expect(await getActiveNutritionIdentity()).toEqual({
      ...owner,
      userId: 'replacement-owner',
    });
    expect(retryPendingWorkoutExports).toHaveBeenCalledTimes(1);
  }
);
it('N2 a late profile cannot publish or retry after inactive-group recovery', async () => {
  await establishWithInactivePair();
  const old = delayedProfile();
  await old.entered.promise;
  const held = await startHeldInactivePair();
  held.release.resolve();
  await Promise.all([held.first, held.second]);
  expect(await getActiveNutritionIdentity()).toEqual(owner);
  old.body.resolve({ id: 'obsolete-owner' });
  await old.rejected;
  expect(await getActiveNutritionIdentity()).toEqual(owner);
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
});
it('N2 a prior blocked mapping cannot seed an inactive recovery group', async () => {
  await establishWithInactivePair();
  await forgetActiveNutritionIdentity();
  data.set(key, JSON.stringify({ version: 1, userId: 'obsolete-owner' }));
  const held = await startHeldInactivePair();
  held.release.resolve();
  await Promise.all([held.first, held.second]);
  expect(await getActiveNutritionIdentity()).toBeNull();
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
});

it.each(['begin', 'restore'] as const)(
  'N2 %s observer active change cannot be erased by inactive recovery',
  async (phase) => {
    await establishWithInactivePair();
    let mutation: Promise<void> | undefined;
    const stop = subscribeNutritionIdentity(() => {
      if (
        (phase === 'begin' && nutritionConfigChanging()) ||
        (phase === 'restore' && !nutritionIdentityBlocked())
      ) {
        stop();
        mutation = saveServerConfig({
          ...configA,
          apiKey: 'observer-fixture-key',
        });
      }
    });
    try {
      await Promise.all([
        deleteServerConfig('inactive-one'),
        clearSessionToken('inactive-two'),
      ]);
      await mutation;
      expect(mutation).toBeDefined();
      expect(await getActiveNutritionIdentity()).toBeNull();
      await fetchProfile();
      expect(await getActiveNutritionIdentity()).toEqual(owner);
    } finally {
      stop();
    }
  }
);
it('N2 an old idempotent finish never clears a successor group or general block', async () => {
  await establishWithInactivePair();
  const old = beginNutritionIdentityChange(true);
  old(configA.id);
  const successor = beginNutritionIdentityChange(true);
  old(configA.id);
  expect(nutritionConfigChanging()).toBe(true);
  expect(nutritionIdentityBlocked()).toBe(true);
  const general = beginNutritionIdentityChange();
  general();
  successor(configA.id);
  expect(nutritionConfigChanging()).toBe(false);
  expect(await getActiveNutritionIdentity()).toBeNull();
  await fetchProfile();
  expect(await getActiveNutritionIdentity()).toEqual(owner);
});
it('N2 final active proof rejection settles the group exactly once and permits later profile recovery', async () => {
  await establishWithInactivePair();
  clearServerConfigCache();
  let fail = false;
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (k) => {
    secure.delete(k);
    if (k === 'sessionToken_inactive-two') fail = true;
  });
  beforeRead = async (k) => {
    if (fail && k === 'activeServerConfigId') {
      beforeRead = undefined;
      throw new Error('synthetic final proof failure');
    }
  };
  const result = await Promise.allSettled([
    deleteServerConfig('inactive-one'),
    clearSessionToken('inactive-two'),
  ]);
  expect(result.some((r) => r.status === 'rejected')).toBe(true);
  expect(nutritionConfigChanging()).toBe(false);
  expect(await getActiveNutritionIdentity()).toBeNull();
  await fetchProfile();
  expect(await getActiveNutritionIdentity()).toEqual(owner);
});
it('N2 failed inactive native deletion keeps unchanged A usable after all members settle', async () => {
  await establishWithInactivePair();
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (k) => {
    if (k === 'sessionToken_inactive-two')
      throw new Error('synthetic native failure');
    secure.delete(k);
  });
  const result = await Promise.allSettled([
    deleteServerConfig('inactive-one'),
    clearSessionToken('inactive-two'),
  ]);
  expect(result.some((r) => r.status === 'rejected')).toBe(true);
  expect(nutritionConfigChanging()).toBe(false);
  expect(await getActiveNutritionIdentity()).toEqual(owner);
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
});
it.each(['delete', 'token'] as const)(
  'N2 three overlapping inactive %s members recover cold A',
  async (kind) => {
    await establishWithInactivePair();
    await saveServerConfig({ ...configA, id: 'inactive-three' });
    await saveServerConfig(configA);
    await establish();
    clearServerConfigCache();
    const cleanup = kind === 'delete' ? deleteServerConfig : clearSessionToken;
    await Promise.all(
      ['inactive-one', 'inactive-two', 'inactive-three'].map(cleanup)
    );
    expect(nutritionConfigChanging()).toBe(false);
    expect(await getActiveNutritionIdentity()).toEqual(owner);
  }
);
it('N2 an unknown proof poisons the group but cannot strand transition settlement', async () => {
  await establishWithInactivePair();
  clearServerConfigCache();
  beforeRead = async (k) => {
    if (k === 'activeServerConfigId') {
      beforeRead = undefined;
      throw new Error('synthetic initial proof failure');
    }
  };
  await Promise.allSettled([
    deleteServerConfig('inactive-one'),
    clearSessionToken('inactive-two'),
  ]);
  expect(nutritionConfigChanging()).toBe(false);
  expect(await getActiveNutritionIdentity()).toBeNull();
  await fetchProfile();
  expect(await getActiveNutritionIdentity()).toEqual(owner);
});

it('N2 conflicting active proofs refuse restoration without leaking a transition', async () => {
  await establishWithInactivePair();
  const first = beginNutritionIdentityChange(true);
  const second = beginNutritionIdentityChange(true);
  first(configA.id);
  second('conflicting-fixture-owner');
  expect(nutritionConfigChanging()).toBe(false);
  expect(await getActiveNutritionIdentity()).toBeNull();
  await fetchProfile();
  expect(await getActiveNutritionIdentity()).toEqual(owner);
});
it('N2 a throwing begin observer settles its unreturned member without recovery', async () => {
  await establishWithInactivePair();
  const stop = subscribeNutritionIdentity(() => {
    throw new Error('synthetic observer failure');
  });
  try {
    await expect(clearSessionToken('inactive-one')).rejects.toThrow(
      'synthetic observer failure'
    );
  } finally {
    stop();
  }
  expect(nutritionConfigChanging()).toBe(false);
  expect(await getActiveNutritionIdentity()).toBeNull();
  await fetchProfile();
  expect(await getActiveNutritionIdentity()).toEqual(owner);
});
it('N2 restore observer creates a distinct successor that an old finish cannot settle', async () => {
  await establishWithInactivePair();
  let successor: ReturnType<typeof beginNutritionIdentityChange> | undefined;
  const stop = subscribeNutritionIdentity(() => {
    if (!nutritionConfigChanging()) {
      stop();
      successor = beginNutritionIdentityChange(true);
    }
  });
  const old = beginNutritionIdentityChange(true);
  old(configA.id);
  old(configA.id);
  expect(successor).toBeDefined();
  expect(nutritionConfigChanging()).toBe(true);
  expect(await getActiveNutritionIdentity()).toBeNull();
  successor?.(configA.id);
  expect(nutritionConfigChanging()).toBe(false);
  expect(await getActiveNutritionIdentity()).toEqual(owner);
  stop();
});
