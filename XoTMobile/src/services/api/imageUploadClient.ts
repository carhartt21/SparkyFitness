import { isPermittedHttpUrl } from '../../utils/serverUrl';
import { File } from 'expo-file-system';
import {
  normalizeUrl,
  captureApiRequest,
  apiRequestHeaders,
  type ExpectedNutritionIdentity,
} from './apiClient';
import { ApiError } from './errors';
import { notifySessionExpired } from './authService';
import { addLog } from '../LogService';
import { UPLOAD_TIMEOUT_MS, fetchWithTimeout } from '../../utils/concurrency';

/**
 * Shared multipart transport for food/meal/entry images.
 *
 * `apiFetch` JSON-encodes its body, so image writes cannot go through it. This
 * mirrors `pregnancyPhotosApi.uploadPhoto` — the app's one proven multipart
 * path — and exists so the auth/proxy/timeout/session-expiry handling is not
 * hand-copied into every image endpoint.
 *
 * Two rules are load-bearing and easy to break:
 *  - Global fetch is Expo's WinterCG `expo/fetch`, which rejects React
 *    Native's `{uri, name, type}` FormData parts with "Unsupported
 *    FormDataPart implementation". An `expo-file-system` `File` implements
 *    Blob and serializes correctly.
 *  - Content-Type must be left unset so multer receives a boundary.
 */
export async function postImageMultipart<T>(params: {
  endpoint: string;
  expectedIdentity?: ExpectedNutritionIdentity;
  serviceName: string;
  operation: string;
  method?: 'POST' | 'PUT';
  /** Existing routes use images; photo-capture upload uses one image part. */
  fileField?: 'images' | 'image';
  includeOrder?: boolean;
  /** Ordered `images` array with `__new__<n>` placeholders for uploads. */
  order: string[];
  /** Local URIs to upload, in placeholder order. */
  newUris: string[];
  /** Optional JSON payload, sent under `wrapperField` (e.g. `foodData`). */
  payload?: unknown;
  wrapperField?: string;
}): Promise<T> {
  const {
    endpoint,
    serviceName,
    operation,
    method = 'POST',
    fileField = 'images',
    includeOrder = true,
    order,
    newUris,
    payload,
    wrapperField,
  } = params;

  const uris = [...newUris];
  const orderSnapshot = [...order];
  const wrappedBody =
    payload !== undefined && wrapperField
      ? JSON.stringify({ ...(payload as object), images: orderSnapshot })
      : undefined;
  const context = await captureApiRequest(params.expectedIdentity);
  const { config, binding } = context;
  const assertIdentity = async () => {
    await binding?.assertCurrent();
  };
  try {
    const baseUrl = normalizeUrl(config.url);
    // Same transport guard `apiFetch` applies: these requests carry auth headers
    // and user photos, so production variants never send them over plaintext.
    if (
      baseUrl.toLowerCase().startsWith('http://') &&
      !isPermittedHttpUrl(baseUrl)
    ) {
      throw new Error(
        'HTTPS is required for server connections. Please update your server URL in Settings.'
      );
    }

    const form = new FormData();

    // Where the order array goes depends on whether the route wraps its body.
    //
    // Wrapped routes (foods, meals) run parseMultipartBody, which REPLACES the
    // body with the parsed wrapper object and discards every other text field —
    // so a top-level `images` field would be silently dropped, and the server
    // would treat the request as "these uploads are the complete set" and unlink
    // the existing photos. It has to travel inside the wrapper, as web does.
    //
    // Unwrapped routes (the per-entry image endpoints) read `req.body.images`
    // directly, so the top-level field is correct there.
    //
    // Text fields must precede the file parts either way: multer only reliably
    // exposes fields that arrive before the files in the multipart stream.
    if (payload !== undefined && wrapperField) {
      form.append(wrapperField, wrappedBody!);
    } else if (includeOrder) {
      form.append('images', JSON.stringify(orderSnapshot));
    }

    for (const uri of uris) {
      form.append(fileField, new File(uri));
    }

    const headers = apiRequestHeaders(context, {});
    await assertIdentity();
    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${baseUrl}${endpoint}`,
        {
          method,
          ...(binding ? { credentials: 'omit' as const } : {}),
          // No Content-Type: the native transport supplies the multipart boundary.
          headers,
          body: form,
        },
        UPLOAD_TIMEOUT_MS
      );
    } catch (err) {
      await assertIdentity();
      // A throw here means no response ever arrived (dropped connection,
      // timeout, or a proxy rejecting the body before the app server saw it),
      // so log it; the response-error path below cannot.
      addLog(
        `[${serviceName}] ${operation} failed without a response`,
        'ERROR',
        [String(err)]
      );
      throw err;
    }

    await assertIdentity();
    if (!response.ok) {
      const text = await response.text();
      await assertIdentity();
      if (response.status === 401 && config.authType === 'session') {
        notifySessionExpired(config.id);
      }
      addLog(`[${serviceName}] Failed to ${operation}`, 'ERROR', [text]);
      throw new ApiError(
        `Server error: ${response.status} - ${text}`,
        response.status,
        text
      );
    }

    // 204 has no body; image endpoints otherwise return the updated row. An
    // empty 200 is treated the same, as apiFetch does — response.json() would
    // throw on it after an otherwise successful upload.
    if (
      response.status === 204 ||
      response.headers?.get('content-length') === '0'
    ) {
      await assertIdentity();
      return undefined as T;
    }
    const result = (await response.json()) as T;
    await assertIdentity();
    return result;
  } catch (error) {
    await assertIdentity();
    throw error;
  } finally {
    context.release();
  }
}

/**
 * Sends a JSON payload, switching to multipart only when there are files to
 * upload — matching web's `buildPayloadRequest`, so servers see the same plain
 * JSON body they always have when a user touches no images.
 */
export async function postPayloadWithImages<T>(params: {
  endpoint: string;
  expectedIdentity?: ExpectedNutritionIdentity;
  serviceName: string;
  operation: string;
  method?: 'POST' | 'PUT';
  payload: Record<string, unknown>;
  wrapperField: string;
  order: string[];
  newUris: string[];
  /** Used when no files need uploading. */
  sendJson: (payload: Record<string, unknown>) => Promise<T>;
}): Promise<T> {
  const { payload, order, newUris, sendJson, ...rest } = params;

  if (newUris.length === 0) {
    return sendJson({ ...payload, images: order });
  }

  return postImageMultipart<T>({
    ...rest,
    payload,
    order,
    newUris,
  });
}
