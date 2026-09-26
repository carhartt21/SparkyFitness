const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const http = require('node:http');
/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 * @type {import('expo/metro-config').MetroConfig}
 */

const config = getDefaultConfig(__dirname);
config.transformer.minifierConfig = {
  compress: {
    // The option below removes all console logs statements in production.
    drop_console: ['log', 'info'],
  },
};

const finalConfig = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './src/uniwind-types.d.ts',
  extraThemes: ['amoled'],
});

// Local simulator review uses the real app with a closed synthetic transport.
// No review imports or credentials enter normal development/release bundles.
if (process.env.XOT_UI_REVIEW === '1') {
  const path = require('node:path');
  const incumbent = finalConfig.resolver.resolveRequest;
  finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
    if (
      context.originModulePath === path.join(__dirname, 'index.js') &&
      moduleName === './App'
    ) {
      return {
        type: 'sourceFile',
        filePath: path.join(__dirname, 'review/ReviewApp.tsx'),
      };
    }
    return incumbent
      ? incumbent(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  };
}

// The development build requires an HTTPS server URL. Expo's tunnel supplies
// that origin; when explicitly configured, relay only API calls to the isolated
// local test server so the app can use the same secure URL for Metro and API.
// This is off by default and has no effect on production bundles.
const devApiProxy = process.env.PERSONALBEST_DEV_API_PROXY;
if (devApiProxy) {
  const apiOrigin = new URL(devApiProxy);
  if (apiOrigin.protocol !== 'http:' || !apiOrigin.hostname) {
    throw new Error('PERSONALBEST_DEV_API_PROXY must be a local HTTP origin');
  }

  const enhanceMiddleware = finalConfig.server.enhanceMiddleware;
  finalConfig.server.enhanceMiddleware = (middleware, server) => {
    const metroMiddleware = enhanceMiddleware(middleware, server);
    return (request, response, next) => {
      if (!request.url?.startsWith('/api/')) {
        return metroMiddleware(request, response, next);
      }

      const tunnelOrigin = `https://${request.headers.host}`;
      const isAuthSettings = request.url.split('?')[0] === '/api/auth/settings';
      const headers = {
        ...request.headers,
        host: apiOrigin.host,
        'x-forwarded-host': request.headers.host,
        'x-forwarded-proto': 'https',
      };
      // Better Auth advertises the isolated server's HTTP origin to native
      // clients. That origin is rejected by Expo's CORS middleware before this
      // proxy runs. Advertise the tunnel to the app, then translate its Origin
      // back to the server's configured trusted origin on the upstream request.
      if (headers.origin === tunnelOrigin) headers.origin = apiOrigin.origin;
      if (isAuthSettings) headers['accept-encoding'] = 'identity';

      const upstream = http.request(
        new URL(request.url, apiOrigin),
        {
          method: request.method,
          headers,
        },
        (upstreamResponse) => {
          if (isAuthSettings && upstreamResponse.statusCode === 200) {
            const chunks = [];
            upstreamResponse.on('data', (chunk) => chunks.push(chunk));
            upstreamResponse.on('end', () => {
              try {
                const settings = JSON.parse(Buffer.concat(chunks).toString());
                const body = JSON.stringify({
                  ...settings,
                  trusted_origin: tunnelOrigin,
                });
                const responseHeaders = { ...upstreamResponse.headers };
                delete responseHeaders['content-encoding'];
                responseHeaders['content-length'] = Buffer.byteLength(body);
                response.writeHead(200, responseHeaders);
                response.end(body);
              } catch {
                response.writeHead(502);
                response.end();
              }
            });
            return;
          }
          response.writeHead(
            upstreamResponse.statusCode ?? 502,
            upstreamResponse.headers
          );
          upstreamResponse.pipe(response);
        }
      );
      upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(502);
        response.end();
      });
      request.pipe(upstream);
    };
  };
}

module.exports = finalConfig;
