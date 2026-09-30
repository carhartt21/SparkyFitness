import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/poolManager.js', () => ({ getSystemClient: vi.fn() }));

import { getSystemClient } from '../db/poolManager.js';
import { hasActiveMcpConsent } from '../services/mcpConnectionService.js';

const mockGetSystemClient = vi.mocked(getSystemClient);

describe('ChatGPT MCP connection revocation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts only an active consent for the verified account and client', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const release = vi.fn();
    mockGetSystemClient.mockResolvedValue({ query, release } as never);

    await expect(hasActiveMcpConsent('user-id', 'client-id')).resolves.toBe(
      true
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("c.scopes ? 'mcp:read'"),
      ['user-id', 'client-id']
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it('denies a disconnected client even if its signed token has not expired', async () => {
    const release = vi.fn();
    mockGetSystemClient.mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rowCount: 0 }),
      release,
    } as never);

    await expect(hasActiveMcpConsent('user-id', 'client-id')).resolves.toBe(
      false
    );
    expect(release).toHaveBeenCalledOnce();
  });
});
