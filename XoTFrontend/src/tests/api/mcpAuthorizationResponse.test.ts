import { readMcpAuthorizationRedirect } from '@/api/Auth/mcpAuthorizationResponse';

const fallback = 'Authorization could not be completed.';
const callback =
  'http://127.0.0.1:4321/callback?code=synthetic&state=synthetic';

function response(body: unknown, ok = true): Pick<Response, 'ok' | 'json'> {
  return { ok, json: async () => body };
}

describe('MCP browser authorization responses', () => {
  it.each([
    ['consent approval', callback],
    ['login continuation', '/assistant/consent?sig=synthetic'],
    ['consent refusal', 'http://127.0.0.1:4321/callback?error=access_denied'],
  ])('continues %s using the Better Auth url response', async (_step, url) => {
    await expect(
      readMcpAuthorizationRedirect(response({ redirect: true, url }), fallback)
    ).resolves.toBe(url);
  });

  it('accepts the older redirect_uri response without preferring it over url', async () => {
    await expect(
      readMcpAuthorizationRedirect(
        response({ redirect_uri: callback }),
        fallback
      )
    ).resolves.toBe(callback);
    await expect(
      readMcpAuthorizationRedirect(
        response({
          url: callback,
          redirect_uri: 'https://example.invalid/old',
        }),
        fallback
      )
    ).resolves.toBe(callback);
  });

  it('does not redirect an unsuccessful response and shows its OAuth explanation', async () => {
    await expect(
      readMcpAuthorizationRedirect(
        response(
          {
            url: callback,
            error: 'invalid_request',
            error_description: 'The authorization request expired.',
          },
          false
        ),
        fallback
      )
    ).rejects.toThrow('The authorization request expired.');
  });

  it.each([null, [], 'unexpected', {}, { url: '' }, { url: 4 }])(
    'rejects a malformed response: %j',
    async (body) => {
      await expect(
        readMcpAuthorizationRedirect(response(body), fallback)
      ).rejects.toThrow(fallback);
    }
  );

  it('uses the normal connection error for a non-JSON proxy response', async () => {
    const proxyResponse: Pick<Response, 'ok' | 'json'> = {
      ok: false,
      json: async () => {
        throw new SyntaxError('Unexpected HTML');
      },
    };
    await expect(
      readMcpAuthorizationRedirect(proxyResponse, fallback)
    ).rejects.toThrow(fallback);
  });
});
