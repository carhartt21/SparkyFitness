import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
// @ts-expect-error supertest has no bundled types in this project
import request from 'supertest';

const { verifyApiKey, authenticate } = vi.hoisted(() => ({
  verifyApiKey: vi.fn(),
  authenticate: vi.fn((req, _res, next) => {
    req.authenticatedUserId = 'normal-user';
    next();
  }),
}));
vi.mock('../auth.js', () => ({ auth: { api: { verifyApiKey } } }));
vi.mock('../middleware/authMiddleware.js', () => ({ authenticate }));
vi.mock('../db/poolManager.js', () => ({
  dbContextStorage: { run: (_context: unknown, next: () => void) => next() },
}));

import { authenticateMcp } from '../middleware/mcpAuthentication.js';
import {
  MCP_READ_ONLY_KEY_CONFIG_ID,
  MCP_READ_ONLY_KEY_PREFIX,
} from '../utils/mcpReadOnlyKey.js';

const app = express();
app.use(authenticateMcp);
app.get('/test', (req, res) =>
  res.json({ userId: req.authenticatedUserId, readOnly: req.mcpReadOnly })
);

describe('MCP-only authentication', () => {
  beforeEach(() => {
    verifyApiKey.mockReset();
    authenticate.mockClear();
  });

  it('verifies a read-only key in its own configuration and binds its owner', async () => {
    verifyApiKey.mockResolvedValue({
      valid: true,
      key: { referenceId: 'owner-1', configId: MCP_READ_ONLY_KEY_CONFIG_ID },
    });
    const key = `${MCP_READ_ONLY_KEY_PREFIX}${'a'.repeat(64)}`;
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${key}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 'owner-1', readOnly: true });
    expect(verifyApiKey).toHaveBeenCalledWith({
      body: { key, configId: MCP_READ_ONLY_KEY_CONFIG_ID },
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('fails closed when the prefixed key is invalid, even with another session', async () => {
    verifyApiKey.mockResolvedValue({ valid: false, key: null });
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${MCP_READ_ONLY_KEY_PREFIX}invalid`)
      .set('Cookie', 'better-auth.session_token=other-user');
    expect(response.status).toBe(401);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects a key verified under another API-key configuration', async () => {
    verifyApiKey.mockResolvedValue({
      valid: true,
      key: { referenceId: 'other-account', configId: 'default' },
    });
    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${MCP_READ_ONLY_KEY_PREFIX}wrong-config`);
    expect(response.status).toBe(401);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('preserves normal session and API-key authentication', async () => {
    const response = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer regular-token');
    expect(response.status).toBe(200);
    expect(response.body.userId).toBe('normal-user');
    expect(verifyApiKey).not.toHaveBeenCalled();
    expect(authenticate).toHaveBeenCalledOnce();
  });
});
