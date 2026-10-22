import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import type { ServerConfig } from '../../src/services/storage';
import { getActiveServerConfig } from '../../src/services/storage';
import { notifySessionExpired } from '../../src/services/api/authService';
import { addLog } from '../../src/services/LogService';
import {
  apiFetch,
  bindNutritionRequestIdentity,
  IdentityChangedError,
} from '../../src/services/api/apiClient';
import { ApiError } from '../../src/services/api/errors';
import { postImageMultipart } from '../../src/services/api/imageUploadClient';
import { reconcileNutritionActions } from '../../src/services/nutritionActionSync';
import * as nutritionIdentity from '../../src/services/nutritionIdentity';
import { fetchProfile } from '../../src/services/api/profileApi';
import { retryPendingWorkoutExports } from '../../src/services/workoutHealthExport';
import {
  rememberActiveNutritionUser,
  forgetActiveNutritionIdentity,
  getActiveNutritionIdentity,
} from '../../src/services/nutritionIdentity';
import {
  enqueueFoodEntry,
  enqueueMealEntry,
  enqueueManualWaterAction,
  enqueueContainerWaterAction,
  enqueuePlannedSupplementAction,
  enqueuePhotoCapture,
  enqueuePhotoCompletion,
  listNutritionActions,
  type PendingNutritionAction,
} from '../../src/services/nutritionActionOutbox';
import { offlineMealPayload } from '../helpers/offlineMealFixtures';

// One designated synthetic owner. The alternate values below are switch sentinels,
// never a second real account, service or personal record. No network/native I/O.
const owner = { serverConfigId: 'synthetic-config', userId: 'synthetic-owner' };
const op = '33333333-3333-4333-8333-333333333333';
const rowId = '44444444-4444-4444-8444-444444444444';
const imageId = '55555555-5555-4555-8555-555555555555';
const occurredAt = '2026-10-12T12:00:00.000Z';
const date = '2026-10-12';
const food = {
  meal_type_id: 'synthetic-meal',
  quantity: 1,
  unit: 'serving',
  entry_date: date,
  food_name: 'Synthetic fixture',
  serving_size: 1,
  serving_unit: 'serving',
  calories: 0,
};
let mockConfig: ServerConfig;
let mockAfterSave: ((key: string, value: string) => Promise<void>) | undefined;
let mockProfileOwner: string;
const mockData = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockData.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockData.set(key, value);
      await mockAfterSave?.(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockData.delete(key);
    }),
    getAllKeys: jest.fn(async () => [...mockData.keys()]),
    multiGet: jest.fn(async (keys: string[]) =>
      keys.map((key) => [key, mockData.get(key) ?? null])
    ),
    clear: jest.fn(async () => {
      mockData.clear();
    }),
  },
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(async () => mockConfig),
  getActiveServerConfigId: jest.fn(async () => mockConfig.id),
  proxyHeadersToRecord: (headers?: { name: string; value: string }[]) =>
    Object.fromEntries((headers ?? []).map(({ name, value }) => [name, value])),
}));
jest.mock('../../src/services/api/authService', () => ({
  getAuthHeaders: (config: ServerConfig) => ({
    Authorization: `Bearer ${config.authType === 'session' ? config.sessionToken : config.apiKey}`,
  }),
  notifySessionExpired: jest.fn(),
}));
jest.mock('../../src/services/workoutHealthExport', () => ({
  retryPendingWorkoutExports: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));
jest.mock('../../src/services/nutritionPhotoFiles', () => ({
  resolveNutritionPhotoUri: (_capture: string, _id: string, uri: string) => uri,
}));
jest.mock('../../src/hooks/invalidateMedicationEntryCaches', () => ({
  invalidateMedicationEntryCaches: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '33333333-3333-4333-8333-333333333333',
}));
jest.mock('expo-file-system', () => ({
  File: class extends Blob {
    constructor(uri: string) {
      super([uri]);
    }
  },
}));

const fetchMock = jest.fn<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>();
const originalFetch = global.fetch;
const response = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => 'synthetic error',
    headers: new Headers(),
  }) as Response;
function writeResponse(url: string): Response {
  if (url.endsWith('/offline-meals/actions'))
    return response({ mealEntryId: rowId, alreadyApplied: false });
  if (url.endsWith('/complete')) return response({ entry: { id: rowId } });
  if (url.endsWith('/container-actions'))
    return response({ waterLogId: rowId, alreadyApplied: false });
  return response({ id: rowId, entry: { id: rowId }, alreadyApplied: false });
}
function writes() {
  return fetchMock.mock.calls.filter(([, init]) => init?.method !== 'GET');
}
async function switchIdentity() {
  await forgetActiveNutritionIdentity();
}
const kinds = [
  'food',
  'meal',
  'water',
  'container',
  'supplement',
  'photo',
  'completion',
] as const;
type Kind = (typeof kinds)[number];
async function enqueue(kind: Kind) {
  const common = { ...owner, clientOperationId: op, occurredAt };
  switch (kind) {
    case 'food':
      return enqueueFoodEntry({ ...common, payload: food });
    case 'meal':
      return enqueueMealEntry({ ...common, payload: offlineMealPayload });
    case 'water':
      return enqueueManualWaterAction({
        ...common,
        entryDate: date,
        waterMl: 1,
        loggedAt: occurredAt,
      });
    case 'container':
      return enqueueContainerWaterAction({
        ...common,
        entryDate: date,
        containerId: 1,
        loggedAt: occurredAt,
      });
    case 'supplement':
      return enqueuePlannedSupplementAction({
        ...common,
        medicationId: rowId,
        scheduleId: imageId,
        entryDate: date,
        status: 'skipped',
      });
    case 'photo':
      return enqueuePhotoCapture({
        ...owner,
        payload: {
          id: op,
          capturedAt: occurredAt,
          consumedAt: occurredAt,
          entryDate: date,
          images: [{ id: imageId, uri: 'file:///synthetic.jpg' }],
        },
      });
    case 'completion':
      return enqueuePhotoCompletion({
        ...common,
        payload: {
          captureId: rowId,
          entryDate: date,
          food: {
            meal_type_id: food.meal_type_id,
            quantity: food.quantity,
            unit: food.unit,
            food_name: food.food_name,
            serving_size: food.serving_size,
            serving_unit: food.serving_unit,
            calories: food.calories,
          },
        },
      });
  }
}
const client = () => ({ invalidateQueries: jest.fn() });
const jsonOptions = {
  endpoint: '/synthetic',
  serviceName: 'Synthetic',
  operation: 'test',
  method: 'POST' as const,
  body: { id: op },
  expectedIdentity: owner,
};
const multipartOptions = {
  endpoint: '/synthetic',
  serviceName: 'Synthetic',
  operation: 'test',
  order: ['__new__0'],
  newUris: ['file:///synthetic.jpg'],
  expectedIdentity: owner,
};
const transports = [
  ['JSON', () => apiFetch(jsonOptions)],
  ['multipart', () => postImageMultipart(multipartOptions)],
] as const;

beforeEach(async () => {
  jest.clearAllMocks();
  mockAfterSave = undefined;
  mockData.clear();
  // Setup imports AsyncStorage before this suite; replace the shared instance's
  // methods explicitly so real outbox/identity modules use the same bounded store.
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (key: string) => mockData.get(key) ?? null
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (key: string, value: string) => {
      mockData.set(key, value);
      await mockAfterSave?.(key, value);
    }
  );
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(
    async (key: string) => {
      mockData.delete(key);
    }
  );
  (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(async () => [
    ...mockData.keys(),
  ]);
  (AsyncStorage.multiGet as jest.Mock).mockImplementation(
    async (keys: string[]) =>
      keys.map((key) => [key, mockData.get(key) ?? null])
  );
  mockConfig = {
    id: owner.serverConfigId,
    url: 'https://synthetic.invalid/',
    apiKey: 'fixture-key',
    proxyHeaders: [{ name: 'X-Synthetic-Proxy', value: 'fixture-proxy' }],
  };
  mockProfileOwner = owner.userId;
  (getActiveServerConfig as jest.Mock).mockImplementation(
    async () => mockConfig
  );
  await rememberActiveNutritionUser(owner.userId);
  fetchMock
    .mockReset()
    .mockImplementation(async (url, init) =>
      init?.method === 'GET'
        ? response({ id: mockProfileOwner })
        : writeResponse(String(url))
    );
  global.fetch = fetchMock;
});
afterAll(() => {
  global.fetch = originalFetch;
});

it.each(kinds)(
  '%s traverses the real JSON/multipart writers under original URL/credentials and acknowledges only its original row',
  async (kind) => {
    const initial = await enqueue(kind);
    const result = await reconcileNutritionActions();
    expect(result).toEqual({ processed: 1, nextDelayMs: null });
    expect(writes()).toHaveLength(kind === 'photo' ? 2 : 1);
    expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url).startsWith('https://synthetic.invalid/api/')).toBe(
        true
      );
      expect(init?.headers).toMatchObject({
        authorization: 'Bearer fixture-key',
        'x-synthetic-proxy': 'fixture-proxy',
      });
      expect(init?.credentials).toBe('omit');
      if (init?.body instanceof FormData) {
        expect(init.body.get('image')).toBeInstanceOf(Blob);
        expect(
          Object.keys(init.headers ?? {}).some(
            (key) => key.toLowerCase() === 'content-type'
          )
        ).toBe(false);
      } else if (init?.method !== 'GET') {
        const payload = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        expect(
          payload.client_operation_id ?? payload.clientOperationId ?? payload.id
        ).toBe(initial.clientOperationId);
      }
    }
    const [saved] = await listNutritionActions(owner);
    expect(saved).toMatchObject({
      ...owner,
      clientOperationId: initial.clientOperationId,
      payload: initial.payload,
      syncState: 'synced',
      retryCount: 1,
    });
    expect(
      await listNutritionActions({ ...owner, userId: 'switch-sentinel' })
    ).toEqual([]);
  }
);

it.each(kinds)(
  '%s refuses a same-ID credential swap during the outbox syncing await before any write',
  async (kind) => {
    const initial = await enqueue(kind);
    const query = client();
    mockAfterSave = async (_key, value) => {
      if ((JSON.parse(value) as PendingNutritionAction).syncState === 'syncing')
        mockConfig.apiKey = 'switch-sentinel';
    };
    expect(
      await reconcileNutritionActions(query as unknown as QueryClient)
    ).toEqual({ processed: 1, nextDelayMs: null });
    expect(writes()).toHaveLength(0);
    expect((await listNutritionActions(owner))[0]).toMatchObject({
      clientOperationId: initial.clientOperationId,
      payload: initial.payload,
      syncState: 'pending',
      retryCount: 1,
      lastError: 'auth',
    });
    expect(query.invalidateQueries).not.toHaveBeenCalled();
  }
);

it.each(['apiKey', 'session'] as const)(
  '%s swapped before forget cannot replay a stale local profile mapping',
  async (authType) => {
    mockConfig.authType = authType;
    mockConfig.sessionToken = 'fixture-session';
    // Local owner mapping is still old, but current credentials identify a different owner.
    mockProfileOwner = 'switch-sentinel';
    await enqueue('food');
    const before = await listNutritionActions(owner);
    expect(await reconcileNutritionActions()).toEqual({
      processed: 0,
      nextDelayMs: null,
    });
    expect(writes()).toHaveLength(0);
    expect(await listNutritionActions(owner)).toEqual(before);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      authorization:
        authType === 'session'
          ? 'Bearer fixture-session'
          : 'Bearer fixture-key',
    });
    // The verification GET cannot re-remember an obsolete profile.
    expect(
      [...mockData.values()].filter((value) =>
        value.includes('switch-sentinel')
      )
    ).toEqual([]);
  }
);

it.each(kinds)(
  '%s discards a late write response and preserves original uncertain operation without cache effects',
  async (kind) => {
    const initial = await enqueue(kind);
    const query = client();
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'GET') return response({ id: owner.userId });
      await switchIdentity();
      return writeResponse(String(url));
    });
    expect(
      await reconcileNutritionActions(query as unknown as QueryClient)
    ).toEqual({ processed: 1, nextDelayMs: null });
    expect(writes()).toHaveLength(1); // photo upload must not start after obsolete capture creation
    expect((await listNutritionActions(owner))[0]).toMatchObject({
      payload: initial.payload,
      clientOperationId: initial.clientOperationId,
      syncState: 'pending',
      lastError: 'auth',
    });
    expect(query.invalidateQueries).not.toHaveBeenCalled();
  }
);

it('stops between two multipart legs and retries original IDs after the original owner returns', async () => {
  const original = await enqueuePhotoCapture({
    ...owner,
    payload: {
      id: op,
      capturedAt: occurredAt,
      consumedAt: occurredAt,
      entryDate: date,
      images: [
        { id: imageId, uri: 'file:///synthetic.jpg' },
        { id: rowId, uri: 'file:///synthetic2.jpg' },
      ],
    },
  });
  fetchMock.mockImplementation(async (url, init) => {
    if (init?.method === 'GET') return response({ id: owner.userId });
    if (String(url).endsWith(`/images/${imageId}`)) {
      await switchIdentity();
      throw new Error('uncertain upload outcome');
    }
    return writeResponse(String(url));
  });
  await reconcileNutritionActions();
  const firstPaths = writes().map(([url]) => String(url));
  expect(firstPaths).toHaveLength(2);
  expect(firstPaths[1]).toContain(imageId);
  expect(firstPaths.some((url) => url.endsWith(`/images/${rowId}`))).toBe(
    false
  );
  await rememberActiveNutritionUser(owner.userId);
  fetchMock.mockImplementation(async (url, init) =>
    init?.method === 'GET'
      ? response({ id: owner.userId })
      : writeResponse(String(url))
  );
  // Existing backoff delays the same operation, no immediate duplicate dispatch.
  const delayed = await reconcileNutritionActions();
  expect(delayed.processed).toBe(0);
  expect(delayed.nextDelayMs).toBeGreaterThan(0);
  const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10000);
  try {
    await reconcileNutritionActions();
  } finally {
    clock.mockRestore();
  }
  const secondPaths = writes()
    .slice(2)
    .map(([url]) => String(url));
  expect(secondPaths.slice(0, 2)).toEqual(firstPaths);
  expect(secondPaths[2]).toContain(`/images/${rowId}`);
  expect((await listNutritionActions(owner))[0]).toMatchObject({
    clientOperationId: op,
    payload: original.payload,
    syncState: 'synced',
    retryCount: 2,
  });
});

it.each(transports)(
  '%s drops successful/rejected body parsing after a switch',
  async (_name, send) => {
    for (const reject of [false, true]) {
      await rememberActiveNutritionUser(owner.userId);
      fetchMock.mockResolvedValue({
        ...response({}),
        json: async () => {
          await switchIdentity();
          if (reject) throw new Error('decode');
          return { id: rowId };
        },
      } as Response);
      await expect(send()).rejects.toBeInstanceOf(IdentityChangedError);
    }
  }
);
it.each(transports)(
  '%s does not expire the current session for an obsolete 401, including rejected error-body reads',
  async (_name, send) => {
    mockConfig.authType = 'session';
    mockConfig.sessionToken = 'fixture-session';
    for (const reject of [false, true]) {
      await rememberActiveNutritionUser(owner.userId);
      fetchMock.mockResolvedValue({
        ...response({}, 401),
        text: async () => {
          mockConfig.sessionToken = 'switch-sentinel';
          if (reject) throw new Error('body read');
          return 'unauthorized';
        },
      } as Response);
      await expect(send()).rejects.toBeInstanceOf(IdentityChangedError);
      mockConfig.sessionToken = 'fixture-session';
    }
    expect(notifySessionExpired).not.toHaveBeenCalled();
  }
);
it.each(transports)(
  '%s preserves genuine validation/auth errors for the unchanged owner',
  async (_name, send) => {
    mockConfig.authType = 'session';
    mockConfig.sessionToken = 'fixture-session';
    for (const status of [400, 401, 403, 503]) {
      fetchMock.mockResolvedValue(response({}, status));
      await expect(send()).rejects.toMatchObject({
        name: 'ApiError',
        statusCode: status,
      });
    }
    expect(notifySessionExpired).toHaveBeenCalledTimes(1);
  }
);

it.each([400, 401, 403, 503])(
  'sync retains original %s classification and retry behavior',
  async (status) => {
    await enqueue('food');
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === 'GET'
        ? response({ id: owner.userId })
        : response({}, status)
    );
    const result = await reconcileNutritionActions();
    expect(result.nextDelayMs).toBe(status === 400 ? null : 2000);
    expect((await listNutritionActions(owner))[0]).toMatchObject({
      retryCount: 1,
      syncState: status === 400 ? 'attentionRequired' : 'pending',
      lastError:
        status === 400 ? 'validation' : status === 503 ? 'server' : 'auth',
    });
  }
);

it('a lost JSON response retries the identical operation/body only after its backoff', async () => {
  const initial = await enqueue('food');
  fetchMock.mockImplementation(async (_url, init) => {
    if (init?.method === 'GET') return response({ id: owner.userId });
    throw new Error('synthetic response lost');
  });
  expect((await reconcileNutritionActions()).nextDelayMs).toBe(2000);
  const first = writes()[0];
  expect((await reconcileNutritionActions()).processed).toBe(0);
  fetchMock.mockImplementation(async (url, init) =>
    init?.method === 'GET'
      ? response({ id: owner.userId })
      : writeResponse(String(url))
  );
  const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10000);
  try {
    await reconcileNutritionActions();
  } finally {
    clock.mockRestore();
  }
  expect(writes()[1]).toEqual(first);
  expect((await listNutritionActions(owner))[0]).toMatchObject({
    clientOperationId: initial.clientOperationId,
    payload: initial.payload,
    syncState: 'synced',
    retryCount: 2,
  });
});

it.each(['id', 'url', 'apiKey', 'sessionToken', 'proxy'] as const)(
  'by-value binding refuses in-place %s mutation',
  async (field) => {
    mockConfig.authType = 'session';
    mockConfig.sessionToken = 'fixture-session';
    // API-key case uses the effective API-key auth mode.
    if (field === 'apiKey') mockConfig.authType = 'apiKey';
    const binding = await bindNutritionRequestIdentity(owner);
    try {
      if (field === 'proxy')
        mockConfig.proxyHeaders![0].value = 'switch-sentinel';
      else mockConfig[field] = 'switch-sentinel';
      await expect(
        apiFetch({ ...jsonOptions, expectedIdentity: binding })
      ).rejects.toBeInstanceOf(IdentityChangedError);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      binding.release();
    }
  }
);
it('binds before storage/profile awaits and refuses switch-away-and-back even with identical values', async () => {
  const binding = await bindNutritionRequestIdentity(owner);
  await forgetActiveNutritionIdentity();
  await rememberActiveNutritionUser(owner.userId);
  try {
    await expect(binding.assertCurrent()).rejects.toBeInstanceOf(
      IdentityChangedError
    );
  } finally {
    binding.release();
  }
  const fresh = await bindNutritionRequestIdentity(owner);
  await expect(fresh.assertCurrent()).resolves.toBeUndefined();
  fresh.release();
  await expect(fresh.assertCurrent()).rejects.toBeInstanceOf(
    IdentityChangedError
  );
});
it('guards a switch during the initial configuration await before any network call', async () => {
  (getActiveServerConfig as jest.Mock).mockImplementationOnce(async () => {
    await switchIdentity();
    return mockConfig;
  });
  await expect(apiFetch(jsonOptions)).rejects.toBeInstanceOf(
    IdentityChangedError
  );
  expect(fetchMock).not.toHaveBeenCalled();
  await rememberActiveNutritionUser(owner.userId);
  await expect(apiFetch(jsonOptions)).resolves.toBeDefined();
});
it('bound headers cannot be replaced case-insensitively and caller body/header mutation cannot change a pending request', async () => {
  const body = { id: op };
  const headers = {
    AUTHORIZATION: 'switch-sentinel',
    Cookie: 'switch-sentinel',
    'X-SYNTHETIC-PROXY': 'switch-sentinel',
    'X-Safe': 'original',
  };
  const work = apiFetch({ ...jsonOptions, body, headers });
  body.id = rowId;
  headers['X-Safe'] = 'changed';
  await work;
  expect(fetchMock.mock.calls[0][1]?.headers).toEqual(
    expect.objectContaining({
      authorization: 'Bearer fixture-key',
      'x-synthetic-proxy': 'fixture-proxy',
      'X-Safe': 'original',
    })
  );
  expect(
    Object.keys(fetchMock.mock.calls[0][1]?.headers ?? {}).some(
      (key) => key.toLowerCase() === 'cookie'
    )
  ).toBe(false);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
    id: op,
  });
});
it('multipart snapshots input arrays and wrapped payload before its first await', async () => {
  const order = ['__new__0'];
  const newUris = ['file:///synthetic.jpg'];
  const payload = { id: op };
  const work = postImageMultipart({
    ...multipartOptions,
    order,
    newUris,
    payload,
    wrapperField: 'foodData',
  });
  order.push('__new__1');
  newUris.push('file:///switch.jpg');
  payload.id = rowId;
  await work;
  const form = fetchMock.mock.calls[0][1]?.body as FormData;
  expect(JSON.parse(String(form.get('foodData')))).toEqual({
    id: op,
    images: ['__new__0'],
  });
  expect(form.getAll('images')).toHaveLength(1);
});
it('stores no transport credentials/config or obsolete response details in the outbox/log on identity refusal', async () => {
  await enqueue('food');
  mockAfterSave = async (_key, value) => {
    if ((JSON.parse(value) as PendingNutritionAction).syncState === 'syncing')
      mockConfig.apiKey = 'switch-sentinel';
  };
  await reconcileNutritionActions();
  const persisted = JSON.stringify(await listNutritionActions(owner));
  for (const marker of [
    'fixture-key',
    'fixture-proxy',
    'switch-sentinel',
    'https://synthetic.invalid',
  ])
    expect(persisted.includes(marker)).toBe(false);
  expect(addLog).not.toHaveBeenCalled();
});
it('typed identity failures are distinct from permanent server validation errors', () => {
  expect(new IdentityChangedError()).not.toBeInstanceOf(ApiError);
});

it.each(transports)(
  '%s rejects a thrown network error after an identity change as retryable identity failure',
  async (_name, send) => {
    fetchMock.mockImplementation(async () => {
      await switchIdentity();
      throw new Error('uncertain response');
    });
    await expect(send()).rejects.toBeInstanceOf(IdentityChangedError);
    expect(notifySessionExpired).not.toHaveBeenCalled();
    expect(addLog).not.toHaveBeenCalled();
  }
);
it('standalone request observers are released after success and after refused capture', async () => {
  const subscribe = nutritionIdentity.subscribeNutritionIdentity;
  const releases: jest.Mock[] = [];
  const spy = jest
    .spyOn(nutritionIdentity, 'subscribeNutritionIdentity')
    .mockImplementation((listener) => {
      const unsubscribe = subscribe(listener);
      const release = jest.fn(unsubscribe);
      releases.push(release);
      return release;
    });
  try {
    await apiFetch(jsonOptions);
    (getActiveServerConfig as jest.Mock).mockImplementationOnce(async () => {
      await switchIdentity();
      return mockConfig;
    });
    await expect(postImageMultipart(multipartOptions)).rejects.toBeInstanceOf(
      IdentityChangedError
    );
    expect(releases).toHaveLength(2);
    for (const release of releases) expect(release).toHaveBeenCalledTimes(1);
  } finally {
    spy.mockRestore();
  }
});
it('P2: late profile responses cannot publish under a newly selected configuration or retry exports', async () => {
  let release: (value: unknown) => void = () => undefined;
  let started: () => void = () => undefined;
  const pending = new Promise<unknown>((resolve) => {
    release = resolve;
  });
  const inBody = new Promise<void>((resolve) => {
    started = resolve;
  });
  fetchMock.mockResolvedValue({
    ...response({}),
    json: async () => {
      started();
      return pending;
    },
  } as Response);
  const oldProfile = fetchProfile();
  const refused =
    expect(oldProfile).rejects.toBeInstanceOf(IdentityChangedError);
  await inBody;
  mockConfig = {
    ...mockConfig,
    id: 'switch-sentinel',
    url: 'https://switch.invalid',
    apiKey: 'switch-sentinel',
  };
  await forgetActiveNutritionIdentity();
  release({ id: owner.userId });
  await refused;
  // The old request is obsolete; neither metadata publication nor export is allowed.
  expect(await getActiveNutritionIdentity()).toBeNull();
  expect(retryPendingWorkoutExports).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls[0][0]).toBe(
    'https://synthetic.invalid/api/identity/profiles'
  );
});

it.each(['user', 'server', 'url', 'proxy', 'session'] as const)(
  'a %s switch during pending-action enumeration leaves the queue untouched',
  async (switchKind) => {
    mockConfig.authType = switchKind === 'session' ? 'session' : 'apiKey';
    mockConfig.sessionToken = 'fixture-session';
    await enqueue('food');
    const before = await listNutritionActions(owner);
    (AsyncStorage.getAllKeys as jest.Mock).mockImplementationOnce(async () => {
      if (switchKind === 'user')
        await rememberActiveNutritionUser('switch-sentinel');
      if (switchKind === 'server') mockConfig.id = 'switch-sentinel';
      if (switchKind === 'url') mockConfig.url = 'https://switch.invalid';
      if (switchKind === 'proxy')
        mockConfig.proxyHeaders![0].value = 'switch-sentinel';
      if (switchKind === 'session') mockConfig.sessionToken = 'switch-sentinel';
      return [...mockData.keys()];
    });
    expect(await reconcileNutritionActions()).toEqual({
      processed: 0,
      nextDelayMs: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await listNutritionActions(owner)).toEqual(before);
  }
);
it('a switch during the bound profile JSON read leaves all rows untouched', async () => {
  await enqueue('food');
  const before = await listNutritionActions(owner);
  fetchMock.mockResolvedValue({
    ...response({}),
    json: async () => {
      mockConfig.apiKey = 'switch-sentinel';
      return { id: owner.userId };
    },
  } as Response);
  expect(await reconcileNutritionActions()).toEqual({
    processed: 0,
    nextDelayMs: null,
  });
  expect(writes()).toHaveLength(0);
  expect(await listNutritionActions(owner)).toEqual(before);
});
it('a switch during the final local acknowledgement cannot invalidate the new account caches', async () => {
  await enqueue('food');
  const query = client();
  mockAfterSave = async (_key, value) => {
    if ((JSON.parse(value) as PendingNutritionAction).syncState === 'synced')
      await switchIdentity();
  };
  await reconcileNutritionActions(query as unknown as QueryClient);
  expect((await listNutritionActions(owner))[0]).toMatchObject({
    ...owner,
    syncState: 'synced',
    serverIdentity: rowId,
  });
  expect(query.invalidateQueries).not.toHaveBeenCalled();
});
