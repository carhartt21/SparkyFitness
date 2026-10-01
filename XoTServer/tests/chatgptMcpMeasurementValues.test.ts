import express from 'express';
// @ts-expect-error supertest has no bundled types in this project
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { measurementReminderMcpStatusResponseSchema } from '@workspace/shared';
import {
  PROTOCOL_VERSION_META_KEY,
  CLIENT_INFO_META_KEY,
  CLIENT_CAPABILITIES_META_KEY,
} from '@modelcontextprotocol/server';

const fixture = vi.hoisted(() => ({
  ownerId: '11111111-1111-4111-8111-111111111111',
  clientId: 'measurement-contract-client',
  consent: vi.fn(async () => true),
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
        scope: 'mcp:read',
      }),
}));
vi.mock('../services/mcpConnectionService.js', () => ({
  hasActiveMcpConsent: fixture.consent,
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
const envelope = z.object({
  result: z.object({
    isError: z.boolean().optional(),
    content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
  }),
});

describe('OAuth MCP measurement response', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.consent.mockResolvedValue(true);
  });

  it('advertises the saved value and explicit units through tools/list', async () => {
    const res = await request(app)
      .post('/mcp/chatgpt')
      .set(headers)
      .set('Mcp-Method', 'tools/list')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: requestMeta },
      });
    expect(res.status, res.text).toBe(200);
    const payload: unknown = res.body;
    const result = z
      .object({
        result: z.object({
          tools: z.array(
            z.object({
              name: z.string(),
              description: z.string().optional(),
              annotations: z
                .object({ readOnlyHint: z.boolean().optional() })
                .optional(),
            })
          ),
        }),
      })
      .parse(payload);
    const measurement = result.result.tools.find(
      (tool) => tool.name === 'sparky_get_measurement_reminder_status'
    );
    expect(measurement?.description).toContain('actual saved value');
    expect(measurement?.description).toContain('kg');
    expect(measurement?.annotations?.readOnlyHint).toBe(true);
  });

  it('preserves numeric value, unit and recorded flag in the HTTP tool result', async () => {
    const res = await request(app)
      .post('/mcp/chatgpt')
      .set(headers)
      .set('Mcp-Method', 'tools/call')
      .set('Mcp-Name', 'sparky_get_measurement_reminder_status')
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          _meta: requestMeta,
          name: 'sparky_get_measurement_reminder_status',
          arguments: { date: '2026-10-01' },
        },
      });
    expect(res.status, res.text).toBe(200);
    const body: unknown = res.body;
    const result = envelope.parse(body);
    expect(result.result.isError).toBe(false);
    const raw: unknown = JSON.parse(result.result.content[0].text);
    const data = measurementReminderMcpStatusResponseSchema.parse(raw);
    expect(data.reminders[0]).toMatchObject({
      measurement_recorded: true,
      value: 78.3,
      unit: 'kg',
      recorded_at: '2026-10-01T07:05:00.000Z',
    });
    expect(fixture.values).toHaveBeenCalledWith(fixture.ownerId, '2026-10-01', [
      'weight',
    ]);
    expect(fixture.consent).toHaveBeenCalledWith(
      fixture.ownerId,
      fixture.clientId
    );
  });

  it('does not read measurements after the assistant consent is revoked', async () => {
    fixture.consent.mockResolvedValue(false);
    const res = await request(app)
      .post('/mcp/chatgpt')
      .set(headers)
      .set('Mcp-Method', 'tools/call')
      .set('Mcp-Name', 'sparky_get_measurement_reminder_status')
      .send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          _meta: requestMeta,
          name: 'sparky_get_measurement_reminder_status',
          arguments: { date: '2026-10-01' },
        },
      });
    expect(res.status).toBe(403);
    expect(fixture.reminders).not.toHaveBeenCalled();
    expect(fixture.values).not.toHaveBeenCalled();
  });
});
