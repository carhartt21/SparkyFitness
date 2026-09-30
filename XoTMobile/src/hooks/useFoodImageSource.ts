import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import {
  getActiveServerConfig,
  proxyHeadersToRecord,
} from '../services/storage';
import { normalizeUrl } from '../services/api/apiClient';
import { addLog } from '../services/LogService';
import type { ServerConfig } from '../services/storage';

type ImageSource = { uri: string; headers: Record<string, string> };

export type GetFoodImageSource = (imagePath: string) => ImageSource | null;

/**
 * Turns a stored food image path into a loadable URL for `config`'s server,
 * or null while the server is unknown. Absolute provider URLs pass through.
 * Shared by the hook below and by code outside React (the Watch thumbnails).
 */
export function resolveFoodImageSource(
  imagePath: string,
  config: ServerConfig | null
): ImageSource | null {
  if (!imagePath) return null;
  // Absolute URLs (provider images that never localized) — use directly.
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return { uri: imagePath, headers: {} };
  }
  if (!config) return null;
  const base = normalizeUrl(config.url);
  // The server mounts uploads at both /uploads and /api/uploads; use the
  // /api prefix so a single reverse-proxy rule covers every request.
  const uri = imagePath.startsWith('/uploads/')
    ? `${base}/api${imagePath}`
    : `${base}/api/uploads/foods/${imagePath}`;
  return { uri, headers: proxyHeadersToRecord(config.proxyHeaders) };
}

/**
 * Resolves stored food/meal image paths to loadable `<Image>` sources.
 *
 * Mirrors `useExerciseImageSource`, with one difference: exercises store bare
 * filenames and the hook supplies the whole directory, whereas food images are
 * stored already server-relative (`/uploads/foods/<id>/...`) and only need the
 * server origin. Bare filenames are still handled for legacy rows, matching
 * web's `resolveFoodImageSrc`.
 *
 * No Authorization header is sent — `/uploads` is served statically and the web
 * app loads the same paths with a plain `<img>`. Proxy headers are still needed
 * so reverse-proxy-authenticated servers let the request through.
 */
export function useFoodImageSource() {
  const [config, setConfig] = useState<ServerConfig | null>(null);

  // Deliberately not useFocusEffect (which the exercise equivalent uses): it
  // requires a navigation context, and this hook backs an app-root provider
  // that sits above the navigator. Re-reading on mount and on foreground
  // return covers the moments the active server can have changed underneath
  // us, without coupling an image URL to the navigation tree.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      // getActiveServerConfig rethrows storage failures. This hook backs an
      // app-root provider, so an uncaught rejection here has nowhere to land —
      // keep the last good config and log instead.
      getActiveServerConfig()
        .then((next) => {
          if (!cancelled) setConfig(next);
        })
        .catch((error) => {
          addLog('[Food Images] Failed to read active server config', 'ERROR', [
            String(error),
          ]);
        });
    };

    load();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  // Cache resolved sources by image path so the same path yields a
  // referentially-stable object across renders. Without this, each render
  // builds a fresh { uri, headers } literal, which makes <Image>/<SafeImage>
  // treat it as a new source and reload — every food thumbnail in a list
  // flashes whenever the list re-renders.
  //
  // The map is tagged with the config it was built for and rebuilt on the first
  // lookup after a server switch, rather than cleared from an effect. An effect
  // only runs after descendants have already rendered against the new config,
  // so they would read the previous server's URIs and proxy headers out of the
  // stale map — and clearing it later triggers no re-render to correct them.
  const cacheRef = useRef<{
    config: ServerConfig | null;
    map: Map<string, ImageSource>;
  }>({ config, map: new Map() });

  const getImageSource = useCallback<GetFoodImageSource>(
    (imagePath: string) => {
      if (!imagePath) return null;

      if (cacheRef.current.config !== config) {
        cacheRef.current = { config, map: new Map() };
      }
      const sourceCache = cacheRef.current.map;

      const cached = sourceCache.get(imagePath);
      if (cached) return cached;

      const source = resolveFoodImageSource(imagePath, config);
      // Don't cache until config resolves, so the path resolves once ready.
      if (!source) return null;

      sourceCache.set(imagePath, source);
      return source;
    },
    [config]
  );

  return { getImageSource };
}
