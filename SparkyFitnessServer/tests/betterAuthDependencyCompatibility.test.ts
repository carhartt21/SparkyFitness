import { describe, expect, it } from 'vitest';
import { createAuthEndpoint } from 'better-auth/api';

describe('Better Auth dependency compatibility', () => {
  it('runs server-only endpoints used by API key verification', async () => {
    const endpoint = createAuthEndpoint.serverOnly(
      { method: 'POST' },
      async () => ({ valid: true })
    );

    await expect(endpoint({})).resolves.toEqual({ valid: true });
  });
});
