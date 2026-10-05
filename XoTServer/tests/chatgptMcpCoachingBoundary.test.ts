import express from 'express';
// @ts-expect-error supertest has no bundled types in this project
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  PROTOCOL_VERSION_META_KEY,
  CLIENT_INFO_META_KEY,
  CLIENT_CAPABILITIES_META_KEY,
} from '@modelcontextprotocol/server';

const fixture = vi.hoisted(() => ({
  ownerId: '11111111-1111-4111-8111-111111111111',
  clientId: 'measurement-contract-client',
  consent: vi.fn(
    async (_user?: string, _client?: string, _scope?: string) => true
  ),
  bound: vi.fn(async () => true),
  enabled: true,
  resolve: vi.fn(async () => ({
    id: '44444444-4444-4444-8444-444444444444',
    protocol_version: 2,
  })),
  reminders: vi.fn(async () => [
    {
      id: '22222222-2222-4222-8222-222222222222',
      measurement_key: 'weight',
      enabled: true,
      days: null,
      daypart: 'morning',
      reminder_time: '08:00',
      include_in_daily_progress: true,
    },
  ]),
  values: vi.fn(async () => ({
    weight: {
      measurement_id: '33333333-3333-4333-8333-333333333333',
      value: 78.3,
      unit: 'kg',
      recorded_at: '2026-10-01T07:05:00.000Z',
      source: null,
    },
  })),
}));

vi.mock('../auth.js', () => ({
  auth: {},
  mcpOAuthResource: 'https://example.test/mcp/chatgpt',
}));
// Token verification is external to this transport/contract test. Exercise the
// real consent check, tool registration and HTTP serialization with read claims.
vi.mock('@better-auth/mcp', () => ({
  requireMcpAuth:
    (
      _auth: unknown,
      handler: (
        req: Request,
        claims: { sub: string; azp: string; scope: string }
      ) => Promise<Response>
    ) =>
    (req: Request) =>
      handler(req, {
        sub: fixture.ownerId,
        azp: fixture.clientId,
        scope: 'mcp:read mcp:write mcp:propose',
      }),
}));
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
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));
vi.mock('../models/dailyTrackingRepository.js', () => ({
  listMeasurementReminders: fixture.reminders,
  recordedMeasurementValuesOn: fixture.values,
}));
vi.mock('../services/engagementService.js', () => ({
  getEngagementSettingsV2: vi.fn(),
  patchEngagementSettings: vi.fn(),
  applyEngagementAction: vi.fn(),
}));
vi.mock('../services/versionService.js', () => ({
  default: { getAppVersion: () => '1.7.2' },
}));
vi.mock('../ai/tools/index.js', async () => {
  const { buildDailyTrackingTools } =
    await import('../ai/tools/dailyTrackingTools.js');
  return { buildChatbotTools: buildDailyTrackingTools };
});

import chatgptMcpRoutes from '../routes/chatgptMcpRoutes.js';

const app = express();
app.use(express.json());
app.use('/mcp/chatgpt', chatgptMcpRoutes);
const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
  'MCP-Protocol-Version': '2026-07-28',
};
const requestMeta = {
  [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
  [CLIENT_INFO_META_KEY]: {
    name: 'measurement-contract-test',
    version: '1.0.0',
  },
  [CLIENT_CAPABILITIES_META_KEY]: {},
};

const list = () =>
  request(app)
    .post('/mcp/chatgpt')
    .set(headers)
    .set('Mcp-Method', 'tools/list')
    .send({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: { _meta: requestMeta },
    });
describe('bound cloud coaching authorization boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.enabled = true;
    fixture.bound.mockResolvedValue(true);
    fixture.consent.mockResolvedValue(true);
    fixture.resolve.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      protocol_version: 2,
    });
  });
  it('exposes only bounded coaching tools even with a broad write grant', async () => {
    const res = await list();
    expect(res.status, res.text).toBe(200);
    const result = z
      .object({
        result: z.object({ tools: z.array(z.object({ name: z.string() })) }),
      })
      .parse(res.body);
    expect(result.result.tools.map((tool) => tool.name).sort()).toEqual(
      [
        'xot_get_coaching_context',
        'xot_get_coaching_snapshot',
        'xot_get_planning_context',
        'xot_claim_coaching_run',
        'xot_submit_coaching_proposals',
        'xot_report_coaching_run',
      ].sort()
    );
  });
  it('fails closed while the feature flag is off rather than exposing legacy mutation tools', async () => {
    fixture.enabled = false;
    expect((await list()).status).toBe(403);
  });
  it('fails closed after a binding has been disabled', async () => {
    fixture.resolve.mockRejectedValue(new Error('revoked'));
    expect((await list()).status).toBe(403);
  });
  it('fails closed after proposal consent is revoked', async () => {
    fixture.consent.mockImplementation(
      async (_user?: string, _client?: string, scope?: string) =>
        scope !== 'mcp:propose'
    );
    expect((await list()).status).toBe(403);
  });
});
