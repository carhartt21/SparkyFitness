import express from 'express';
// @ts-expect-error supertest has no bundled declarations
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requireOwnerAppSession } from '../middleware/requireOwnerAppSession.js';
import { rejectMcpReadOnlyCredential } from '../middleware/rejectMcpReadOnlyCredential.js';

const app = express();
app.use((req, _res, next) => {
  req.authenticatedUserId = 'owner';
  req.originalUserId = 'owner';
  req.userId = req.header('x-test-active-user') ?? 'owner';
  req.credentialKind =
    req.header('x-test-kind') === 'api-key' ? 'api_key' : 'session';
  next();
});
app.use(rejectMcpReadOnlyCredential);
app.use('/review', requireOwnerAppSession, (_req, res) =>
  res.json({ authorized: true })
);
describe('review ingress', () => {
  it('accepts only the owner app session', async () => {
    expect((await request(app).post('/review')).status).toBe(200);
    expect(
      (await request(app).post('/review').set('x-test-active-user', 'family'))
        .status
    ).toBe(403);
    expect(
      (await request(app).post('/review').set('x-test-kind', 'api-key')).status
    ).toBe(403);
  });
  it('rejects MCP and API keys even with a valid owner cookie', async () => {
    for (const credential of [
      'pbmcp_synthetic',
      'xotagent_synthetic',
      'full-api-synthetic',
    ]) {
      expect(
        (
          await request(app)
            .post('/review')
            .set('Cookie', 'better-auth.session_token=synthetic')
            .set('x-api-key', credential)
        ).status
      ).toBe(403);
    }
    expect(
      (
        await request(app)
          .post('/review')
          .set('Authorization', 'Bearer xotagent_synthetic')
          .set('Cookie', 'better-auth.session_token=synthetic')
      ).status
    ).toBe(403);
  });
});
