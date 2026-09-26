import { describe, expect, it } from 'vitest';
import express from 'express';
// @ts-expect-error supertest has no bundled types in this project
import request from 'supertest';
import { rejectMcpReadOnlyCredential } from '../middleware/rejectMcpReadOnlyCredential.js';
import { MCP_READ_ONLY_KEY_PREFIX } from '../utils/mcpReadOnlyKey.js';

const app = express();
app.use(rejectMcpReadOnlyCredential);
app.all('/api/food-entries', (_req, res) =>
  res.status(200).json({ reached: true })
);
app.all('/api/auth/session', (_req, res) =>
  res.status(200).json({ reached: true })
);
app.all('/uploads/photo', (_req, res) =>
  res.status(200).json({ reached: true })
);

describe('MCP-only credential outside the MCP mount', () => {
  const key = `${MCP_READ_ONLY_KEY_PREFIX}${'a'.repeat(64)}`;

  it('blocks a REST write with a Bearer key even alongside a session cookie', async () => {
    const response = await request(app)
      .post('/api/food-entries')
      .set('Authorization', `Bearer ${key}`)
      .set('Cookie', 'better-auth.session_token=other-session');
    expect(response.status).toBe(403);
    expect(response.body.reached).toBeUndefined();
  });

  it('blocks x-api-key on auth and upload routes', async () => {
    for (const path of ['/api/auth/session', '/uploads/photo']) {
      const response = await request(app).get(path).set('x-api-key', key);
      expect(response.status).toBe(403);
      expect(response.body.reached).toBeUndefined();
    }
  });

  it('leaves normal keys and session-only requests to their route auth', async () => {
    const regularKey = await request(app)
      .post('/api/food-entries')
      .set('Authorization', `Bearer ${'b'.repeat(64)}`);
    expect(regularKey.status).toBe(200);

    const session = await request(app)
      .get('/api/auth/session')
      .set('Cookie', 'better-auth.session_token=normal-session');
    expect(session.status).toBe(200);
  });
});
