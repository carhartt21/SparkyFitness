import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../nutritionIdentity';
import type { NutritionActionIdentity } from '../nutritionActionOutbox';
import {
  getActiveServerConfig,
  proxyHeadersToRecord,
  type ServerConfig,
} from '../storage';
import { addLog } from '../LogService';
import { getAuthHeaders, notifySessionExpired } from './authService';
import { ApiError } from './errors';
import {
  DEFAULT_API_TIMEOUT_MS,
  fetchWithTimeout,
} from '../../utils/concurrency';
import { normalizeUrl, isPermittedHttpUrl } from '../../utils/serverUrl';

import {
  IdentityChangedError,
  assertNutritionTransportGeneration,
  nutritionIdentityGeneration,
} from '../nutritionIdentityLifecycle';

export { normalizeUrl };
export { IdentityChangedError } from '../nutritionIdentityLifecycle';
/** Ephemeral transport state; never persist credentials or this object. */
export interface TransportRequestBinding {
  readonly serverConfigId: string;
  readonly config: Readonly<ServerConfig>;
  readonly headers: Readonly<Record<string, string>>;
  assertCurrent: () => Promise<void>;
  release: () => void;
}
export interface NutritionRequestBinding extends TransportRequestBinding {
  readonly userId: string;
}
export type ExpectedNutritionIdentity =
  NutritionActionIdentity | TransportRequestBinding;

function snapshotConfig(config: ServerConfig): Readonly<ServerConfig> {
  const proxyHeaders = config.proxyHeaders?.map((header) =>
    Object.freeze({ ...header })
  );
  if (proxyHeaders) Object.freeze(proxyHeaders);
  return Object.freeze({ ...config, proxyHeaders });
}
function canonicalHeaders(
  headers: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
}
function sameHeaders(
  a: Record<string, string>,
  b: Record<string, string>
): boolean {
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([key, value]) => b[key] === value)
  );
}

/** First profile lookup cannot depend on an already-known nutrition user. */
export async function bindTransportRequestIdentity(): Promise<TransportRequestBinding> {
  const generation = nutritionIdentityGeneration();
  assertNutritionTransportGeneration(generation);
  const activeConfig = await getActiveServerConfig();
  assertNutritionTransportGeneration(generation);
  if (!activeConfig) throw new Error('Server configuration not found.');
  const config = snapshotConfig(activeConfig);
  const url = normalizeUrl(config.url);
  const authType = config.authType ?? 'apiKey';
  const auth = Object.freeze(canonicalHeaders(getAuthHeaders(config)));
  const proxy = Object.freeze(
    canonicalHeaders(proxyHeadersToRecord(config.proxyHeaders))
  );
  const headers = Object.freeze({ ...proxy, ...auth });
  let closed = false;
  const assertCurrent = async () => {
    assertNutritionTransportGeneration(generation);
    if (closed) throw new IdentityChangedError();
    const active = await getActiveServerConfig();
    assertNutritionTransportGeneration(generation);
    const current = active ? snapshotConfig(active) : null;
    if (
      closed ||
      !current ||
      current.id !== config.id ||
      normalizeUrl(current.url) !== url ||
      (current.authType ?? 'apiKey') !== authType ||
      !sameHeaders(canonicalHeaders(getAuthHeaders(current)), auth) ||
      !sameHeaders(
        canonicalHeaders(proxyHeadersToRecord(current.proxyHeaders)),
        proxy
      )
    )
      throw new IdentityChangedError();
  };
  const binding = Object.freeze({
    serverConfigId: config.id,
    config,
    headers,
    assertCurrent,
    release: () => {
      closed = true;
    },
  });
  try {
    await assertCurrent();
    return binding;
  } catch (error) {
    binding.release();
    throw error;
  }
}
/** Known-owner operations additionally reject mapping changes and notifications. */
export async function bindNutritionRequestIdentity(
  expected: NutritionActionIdentity
): Promise<NutritionRequestBinding> {
  const identity = Object.freeze({
    serverConfigId: expected.serverConfigId,
    userId: expected.userId,
  });
  let invalid = false;
  const unsubscribe = subscribeNutritionIdentity(() => {
    invalid = true;
  });
  let transport: TransportRequestBinding | undefined;
  const release = () => {
    invalid = true;
    unsubscribe();
    transport?.release();
  };
  try {
    transport = await bindTransportRequestIdentity();
    const captured = transport;
    const assertCurrent = async () => {
      if (invalid) throw new IdentityChangedError();
      await captured.assertCurrent();
      const current = await getActiveNutritionIdentity();
      await captured.assertCurrent();
      if (
        invalid ||
        captured.serverConfigId !== identity.serverConfigId ||
        current?.serverConfigId !== identity.serverConfigId ||
        current.userId !== identity.userId
      )
        throw new IdentityChangedError();
    };
    const binding = Object.freeze({
      ...captured,
      ...identity,
      assertCurrent,
      release,
    });
    await assertCurrent();
    return binding;
  } catch (error) {
    release();
    throw error;
  }
}

interface RequestContext {
  config: Readonly<ServerConfig>;
  binding?: TransportRequestBinding;
  release: () => void;
}
function isBinding(
  identity: ExpectedNutritionIdentity
): identity is TransportRequestBinding {
  return (
    'assertCurrent' in identity && typeof identity.assertCurrent === 'function'
  );
}
/** JSON and multipart share the same binding and own only subscriptions they create. */
export async function captureApiRequest(
  expected?: ExpectedNutritionIdentity
): Promise<RequestContext> {
  if (expected) {
    const binding = isBinding(expected)
      ? expected
      : await bindNutritionRequestIdentity(expected);
    try {
      await binding.assertCurrent();
      return {
        config: binding.config,
        binding,
        release: isBinding(expected) ? () => undefined : binding.release,
      };
    } catch (error) {
      if (!isBinding(expected)) binding.release();
      throw error;
    }
  }
  const config = await getActiveServerConfig();
  if (!config) throw new Error('Server configuration not found.');
  return { config: snapshotConfig(config), release: () => undefined };
}

export function apiRequestHeaders(
  context: RequestContext,
  custom: Record<string, string>
): Record<string, string> {
  if (!context.binding)
    return {
      ...proxyHeadersToRecord(context.config.proxyHeaders),
      ...getAuthHeaders(context.config),
      ...custom,
    };
  // Case-insensitive: neither custom bearer/cookies nor proxy keys can rebind a queued request.
  const protectedNames = new Set([
    'authorization',
    'cookie',
    ...Object.keys(context.binding.headers),
  ]);
  const safe = Object.fromEntries(
    Object.entries(custom).filter(
      ([key]) => !protectedNames.has(key.toLowerCase())
    )
  );
  return { ...safe, ...context.binding.headers };
}

interface ApiFetchOptions {
  endpoint: string;
  serviceName: string;
  operation: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Bind credentials/destination and discard late responses after account changes. */
  expectedIdentity?: ExpectedNutritionIdentity;
}

export async function apiFetch<T>(options: ApiFetchOptions): Promise<T> {
  const {
    endpoint,
    serviceName,
    operation,
    method = 'GET',
    body,
    headers: customHeaders,
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
  } = options;

  // Snapshot caller inputs before the first await, too.
  const serializedBody = body ? JSON.stringify(body) : undefined;
  const callerHeaders = { ...customHeaders };
  const context = await captureApiRequest(options.expectedIdentity);
  const { config, binding } = context;
  const assertIdentity = async () => {
    await binding?.assertCurrent();
  };
  const baseUrl = normalizeUrl(config.url);
  try {
    if (
      baseUrl.toLowerCase().startsWith('http://') &&
      !isPermittedHttpUrl(baseUrl)
    ) {
      throw new Error(
        'HTTPS is required for server connections. Please update your server URL in Settings.'
      );
    }

    const headers = apiRequestHeaders(context, {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      'X-Meal-Model-Version': '2',
      ...callerHeaders,
    });
    await assertIdentity();
    const response = await fetchWithTimeout(
      `${baseUrl}${endpoint}`,
      {
        method,
        // Defeat the native HTTP cache (iOS NSURLCache/CFNetwork, Android OkHttp).
        // Left cacheable, it stores GET responses and silently replays
        // If-None-Match/If-Modified-Since on the next request, so the server (or a
        // reverse proxy in front of it) answers 304 with an empty body — which
        // surfaces in the app as "Failed to Load" (#1353). The native bridge does
        // not forward a fetch cache policy; instead RN's whatwg-fetch polyfill
        // rewrites the GET URL with a `_=<timestamp>` cache-buster when this is
        // set, so every request misses the native cache. React Query owns all
        // caching here, so the HTTP layer should never revalidate. Only GET is
        // cacheable, and the polyfill appends the cache-buster regardless of
        // method, so we scope this to GET to avoid pinning `_` onto mutating URLs.
        ...(method === 'GET' ? { cache: 'no-store' as const } : {}),
        ...(binding ? { credentials: 'omit' as const } : {}),
        headers,
        ...(serializedBody !== undefined ? { body: serializedBody } : {}),
      },
      timeoutMs
    );

    await assertIdentity();
    if (!response.ok) {
      const errorText = await response.text();
      await assertIdentity();
      if (response.status === 401 && config.authType === 'session') {
        notifySessionExpired(config.id);
      }
      addLog(
        `[${serviceName}] Failed to ${operation}: ${response.status}`,
        'ERROR',
        [errorText]
      );
      throw new ApiError(
        `Server error: ${response.status} - ${errorText}`,
        response.status,
        errorText
      );
    }

    if (
      response.status === 204 ||
      response.headers?.get('content-length') === '0'
    ) {
      await assertIdentity();
      return undefined as T;
    }

    const result: T = await response.json();
    await assertIdentity();
    return result;
  } catch (error) {
    await assertIdentity();
    const message = error instanceof Error ? error.message : String(error);
    addLog(`[${serviceName}] Failed to ${operation}: ${message}`, 'ERROR');
    throw error;
  } finally {
    context.release();
  }
}
