/** Better Auth returns { redirect: true, url } for browser OAuth requests. */
export async function readMcpAuthorizationRedirect(
  response: Pick<Response, 'ok' | 'json'>,
  fallbackError: string
): Promise<string> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(fallbackError);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(fallbackError);
  }
  const result = body as Record<string, unknown>;
  const redirectUrl = [result['url'], result['redirect_uri']].find(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0
  );
  if (response.ok && redirectUrl) return redirectUrl;

  const message = [
    result['message'],
    result['error_description'],
    result['error'],
  ].find(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0
  );
  throw new Error(message ?? fallbackError);
}
