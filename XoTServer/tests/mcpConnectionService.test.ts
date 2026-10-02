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
      expect.stringContaining('c.scopes ? $3'),
      ['user-id', 'client-id', 'mcp:read']
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it('requires proposal consent independently of legacy direct-write access', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0 });
    mockGetSystemClient.mockResolvedValue({ query, release: vi.fn() } as never);
    expect(await hasActiveMcpConsent('owner', 'client', 'mcp:propose')).toBe(
      false
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('c.scopes ? $3'),
      ['owner', 'client', 'mcp:propose']
    );
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
