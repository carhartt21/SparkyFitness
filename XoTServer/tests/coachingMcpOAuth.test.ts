import express from 'express';
// @ts-expect-error supertest has no bundled types in this project
import request from 'supertest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  PROTOCOL_VERSION_META_KEY,
  CLIENT_INFO_META_KEY,
  CLIENT_CAPABILITIES_META_KEY,
} from '@modelcontextprotocol/server';

const fixture = vi.hoisted(() => ({
  issuer: 'https://example.test/api/auth',
  resource: 'https://example.test/mcp/coaching',
  enabled: true,
  consent: vi.fn(
    async (_user?: string, _client?: string, _scope?: string) => true
  ),
  bound: vi.fn(async () => true),
  resolve: vi.fn(async () => ({
    id: '44444444-4444-4444-8444-444444444444',
    protocol_version: 2,
  })),
  legacy: vi.fn(() => ({})),
}));
vi.mock('../auth.js', () => ({
  auth: {
    options: { baseURL: fixture.issuer },
    $context: Promise.resolve({ baseURL: fixture.issuer, internalAdapter: {} }),
  },
  mcpOAuthResource: 'https://example.test/mcp/chatgpt',
  mcpCoachingOAuthResource: fixture.resource,
}));
// Use the real OAuth middleware, signature, audience, expiry and scope checks.
vi.mock('../services/mcpConnectionService.js', () => ({
  hasActiveMcpConsent: fixture.consent,
}));
vi.mock('../services/coachingRunService.js', () => ({
  hasCoachingOAuthBinding: fixture.bound,
  coachingFeatureEnabled: () => fixture.enabled,
  resolveCoachingAgent: fixture.resolve,
  requireCoachingEnabled: vi.fn(),
  getCoachingContext: vi.fn(),
  claimCoachingRun: vi.fn(),
  getCoachingSnapshot: vi.fn(),
  submitCoachingProposals: vi.fn(),
  reportCoachingRun: vi.fn(),
}));
vi.mock('../services/coachingPlanningService.js', () => ({
  getCoachingPlanningContext: vi.fn(),
}));
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: async () => 'Europe/Berlin',
}));
vi.mock('../services/engagementService.js', () => ({
  getEngagementSettingsV2: vi.fn(),
  patchEngagementSettings: vi.fn(),
  applyEngagementAction: vi.fn(),
}));
vi.mock('../services/versionService.js', () => ({
  default: { getAppVersion: () => 'test' },
}));
vi.mock('../ai/tools/index.js', () => ({ buildChatbotTools: fixture.legacy }));

import coachingMcpRoutes, {
  coachingMcpDiscovery,
} from '../routes/coachingMcpRoutes.js';
const app = express();
app.use(coachingMcpDiscovery);
app.use(express.json());
app.use('/mcp/coaching', coachingMcpRoutes);
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
beforeAll(async () => {
  keys = await generateKeyPair('RS256');
  const publicKey = {
    ...(await exportJWK(keys.publicKey)),
    kid: 'fixture',
    alg: 'RS256',
    use: 'sig',
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) => {
      if (String(url) !== `${fixture.issuer}/jwks`)
        throw new Error('Unexpected outbound request');
      return new Response(JSON.stringify({ keys: [publicKey] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    })
  );
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.clearAllMocks();
  fixture.enabled = true;
  fixture.consent.mockResolvedValue(true);
  fixture.bound.mockResolvedValue(true);
  fixture.resolve.mockResolvedValue({
    id: '44444444-4444-4444-8444-444444444444',
    protocol_version: 2,
  });
});
const token = (
  scope = 'mcp:read mcp:propose',
  audience = fixture.resource,
  expires = '5m'
) =>
  new SignJWT({ azp: 'fixture-client', scope })
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture', typ: 'at+jwt' })
    .setSubject('11111111-1111-4111-8111-111111111111')
    .setIssuer(fixture.issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expires)
    .setJti('22222222-2222-4222-8222-222222222222')
    .sign(keys.privateKey);
const list = (accessToken?: string) => {
  const call = request(app)
    .post('/mcp/coaching')
    .set('Accept', 'application/json, text/event-stream')
    .set('MCP-Protocol-Version', '2026-07-28')
    .set('Mcp-Method', 'tools/list');
  if (accessToken) call.set('Authorization', `Bearer ${accessToken}`);
  return call.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {
      _meta: {
        [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
        [CLIENT_INFO_META_KEY]: { name: 'coaching-auth-fixture', version: '1' },
        [CLIENT_CAPABILITIES_META_KEY]: {},
      },
    },
  });
};
describe('proposal-only coaching OAuth bootstrap', () => {
  it('retains the stateless POST-only transport contract', async () => {
    for (const method of ['get', 'delete'] as const) {
      const res = await request(app)[method]('/mcp/coaching');
      expect(res.status).toBe(405);
      expect(res.headers.allow).toBe('POST');
    }
    expect(fixture.consent).not.toHaveBeenCalled();
  });
  it('advertises only read and proposal access at the correct resource and issuer', async () => {
    const res = await request(app).get(
      '/.well-known/oauth-protected-resource/mcp/coaching'
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      resource: fixture.resource,
      authorization_servers: [fixture.issuer],
      scopes_supported: ['mcp:read', 'mcp:propose'],
    });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(fixture.consent).not.toHaveBeenCalled();
  });
  it('challenges an anonymous client with read and proposal scopes before tools can load', async () => {
    const res = await list();
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain(
      '/.well-known/oauth-protected-resource/mcp/coaching'
    );
    expect(res.headers['www-authenticate']).toContain(
      'scope="mcp:read mcp:propose"'
    );
    expect(res.headers['www-authenticate']).not.toContain('mcp:write');
    expect(fixture.consent).not.toHaveBeenCalled();
  });
  it('rejects an otherwise valid token for the legacy resource', async () => {
    const res = await list(
      await token(
        'mcp:read mcp:write mcp:propose',
        'https://example.test/mcp/chatgpt'
      )
    );
    expect(res.status).toBe(401);
    expect(fixture.consent).not.toHaveBeenCalled();
  });
  it('requests a scope upgrade for a read/write token without proposing', async () => {
    const res = await list(await token('mcp:read mcp:write'));
    expect(res.status).toBe(403);
    expect(res.headers['www-authenticate']).toContain('insufficient_scope');
    expect(res.headers['www-authenticate']).toContain('mcp:propose');
    expect(fixture.bound).not.toHaveBeenCalled();
  });
  it('rejects expired tokens before checking account access', async () => {
    expect((await list(await token(undefined, undefined, '-1m'))).status).toBe(
      401
    );
    expect(fixture.consent).not.toHaveBeenCalled();
  });
  it('lists exactly the six protocol-2 tools after consent and binding', async () => {
    const res = await list(await token());
    expect(res.status, res.text).toBe(200);
    expect(
      res.body.result.tools.map((tool: { name: string }) => tool.name).sort()
    ).toEqual(
      [
        'xot_get_coaching_context',
        'xot_get_coaching_snapshot',
        'xot_get_planning_context',
        'xot_claim_coaching_run',
        'xot_submit_coaching_proposals',
        'xot_report_coaching_run',
      ].sort()
    );
    expect(fixture.legacy).not.toHaveBeenCalled();
  });
  it('cannot substitute legacy tools for a missing binding', async () => {
    fixture.bound.mockResolvedValue(false);
    expect((await list(await token())).status).toBe(403);
    expect(fixture.legacy).not.toHaveBeenCalled();
  });
  it('checks live proposal consent even when the signed token still contains it', async () => {
    fixture.consent.mockImplementation(
      async (_owner, _client, scope) => scope !== 'mcp:propose'
    );
    expect((await list(await token())).status).toBe(403);
    expect(fixture.legacy).not.toHaveBeenCalled();
  });
  it('cannot run while coaching is disabled', async () => {
    fixture.enabled = false;
    expect((await list(await token())).status).toBe(503);
    expect(fixture.resolve).not.toHaveBeenCalled();
  });
  it('requires an active binding', async () => {
    fixture.resolve.mockRejectedValue(new Error('revoked'));
    expect((await list(await token())).status).toBe(403);
  });
  it('requires a protocol-2 binding', async () => {
    fixture.resolve.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      protocol_version: 1,
    });
    expect((await list(await token())).status).toBe(409);
  });
});
