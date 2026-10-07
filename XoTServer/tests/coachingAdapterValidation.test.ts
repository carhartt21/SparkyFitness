import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
const fixture = vi.hoisted(() => ({
  claim: vi.fn(),
  context: vi.fn(),
  report: vi.fn(),
  authorize: vi.fn(async () => {}),
  log: vi.fn(),
}));
vi.mock('../services/coachingRunService.js', () => ({
  getCoachingContext: fixture.context,
  claimCoachingRun: fixture.claim,
  getCoachingSnapshot: vi.fn(),
  submitCoachingProposals: vi.fn(),
  reportCoachingRun: fixture.report,
  requireCoachingEnabled: vi.fn(),
}));
vi.mock('../services/coachingPlanningService.js', () => ({
  getCoachingPlanningContext: vi.fn(),
}));
vi.mock('../config/logging.js', () => ({ log: fixture.log }));
import {
  registerCoachingTools,
  type CoachingToolRegistrar,
} from '../ai/mcp/coachingAdapter.js';
type Handler = Parameters<CoachingToolRegistrar['registerTool']>[2];
type ToolConfig = Parameters<CoachingToolRegistrar['registerTool']>[1];
const handlers = new Map<string, Handler>();
const configs = new Map<string, ToolConfig>();
const operationId = '00000000-0000-4000-8000-000000000001';
const call = (args: unknown) => handlers.get('xot_claim_coaching_run')!(args);
describe('coaching MCP validation stages', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    handlers.clear();
    configs.clear();
    registerCoachingTools(
      {
        registerTool: (name, config, handler) => {
          configs.set(name, config);
          handlers.set(name, handler);
        },
      },
      'synthetic-owner',
      'synthetic-agent',
      fixture.authorize,
      true,
      2
    );
  });
  it.each([{}, { operationId: 'not-a-uuid' }, { operationId, kind: 'weekly' }])(
    'rejects invalid or extra claim arguments without invoking the service',
    async (args) => {
      const result = await call(args);
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0].text)).toEqual({
        error: 'Invalid tool arguments.',
        code: 'invalid_arguments',
      });
      expect(fixture.claim).not.toHaveBeenCalled();
      expect(fixture.log.mock.calls).toEqual([
        [
          'info',
          'Coaching MCP write invocation.',
          {
            tool: 'xot_claim_coaching_run',
            stage: 'authorization',
            outcome: 'received',
          },
        ],
        [
          'info',
          'Coaching MCP write invocation.',
          {
            tool: 'xot_claim_coaching_run',
            stage: 'arguments',
            outcome: 'failed',
          },
        ],
      ]);
    }
  );
  it('distinguishes internal evidence validation and logs no record content or identifiers', async () => {
    const error = z.string().safeParse(undefined);
    if (error.success) throw new Error('Expected synthetic validation error');
    fixture.claim.mockRejectedValue(error.error);
    const result = await call({ operationId });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({
      error: 'Coaching operation failed internal validation.',
      code: 'internal_validation',
    });
    expect(fixture.log).toHaveBeenNthCalledWith(
      3,
      'error',
      'Coaching MCP validation failed.',
      {
        tool: 'xot_claim_coaching_run',
        stage: 'operation',
      }
    );
    expect(fixture.claim).toHaveBeenCalledWith(
      'synthetic-owner',
      'synthetic-agent',
      operationId,
      2
    );
  });
  it('preserves a no-work null response and authorizes each claim', async () => {
    fixture.claim.mockResolvedValue(null);
    const result = await call({ operationId });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('null');
    expect(fixture.authorize).toHaveBeenCalledOnce();
  });
  it('preserves revocation errors and never starts work after failed authorization', async () => {
    fixture.authorize.mockRejectedValue(new Error('Connection was revoked.'));
    const result = await call({ operationId });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({
      error: 'Connection was revoked.',
    });
    expect(fixture.claim).not.toHaveBeenCalled();
  });
  it('keeps all state-changing tools annotated as writes in a bounded account', () => {
    for (const [name, config] of configs)
      expect(config.annotations).toEqual({
        readOnlyHint: name.startsWith('xot_get_'),
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    expect(configs.get('xot_report_coaching_run')?.description).toContain(
      'owner-only recap'
    );
  });
  it('does not log read payloads or results', async () => {
    fixture.context.mockResolvedValue({ private: 'synthetic evidence' });
    await handlers.get('xot_get_coaching_context')!({});
    expect(fixture.log).not.toHaveBeenCalled();
  });
  it.each(['heartbeat', 'failed', 'succeeded'] as const)(
    'passes a protocol-2 %s report without logging its contents or identifiers',
    async (status) => {
      const input = {
        operationId,
        runId: '00000000-0000-4000-8000-000000000002',
        leaseToken: 'synthetic-secret-lease-token'.repeat(2),
        status,
        ...(status === 'succeeded'
          ? {
              recap: {
                title: 'Private synthetic recap',
                summary: 'No change needed',
                observations: [],
                limitations: [],
              },
              processedEventCursor: 3,
            }
          : {}),
      };
      const output = {
        run: { status },
        publishedCount: 0,
        recapId: status === 'succeeded' ? 'synthetic-recap' : null,
      };
      fixture.report.mockResolvedValue(output);
      const result = await handlers.get('xot_report_coaching_run')!(input);
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual(output);
      expect(fixture.report).toHaveBeenCalledExactlyOnceWith(
        'synthetic-owner',
        'synthetic-agent',
        input,
        2
      );
      expect(fixture.log.mock.calls).toEqual([
        [
          'info',
          'Coaching MCP write invocation.',
          {
            tool: 'xot_report_coaching_run',
            stage: 'authorization',
            outcome: 'received',
          },
        ],
        [
          'info',
          'Coaching MCP write invocation.',
          {
            tool: 'xot_report_coaching_run',
            stage: 'operation',
            outcome: 'completed',
          },
        ],
      ]);
      for (const secret of [
        input.runId,
        input.leaseToken,
        input.operationId,
        'Private synthetic recap',
        'synthetic-owner',
        'synthetic-agent',
      ])
        expect(JSON.stringify(fixture.log.mock.calls)).not.toContain(secret);
    }
  );
  it('identifies a rejected report at the authorization boundary without invoking the service', async () => {
    fixture.authorize.mockRejectedValue(new Error('Connection was revoked.'));
    await handlers.get('xot_report_coaching_run')!({});
    expect(fixture.report).not.toHaveBeenCalled();
    expect(fixture.log).toHaveBeenLastCalledWith(
      'info',
      'Coaching MCP write invocation.',
      {
        tool: 'xot_report_coaching_run',
        stage: 'authorization',
        outcome: 'failed',
      }
    );
  });
  it('rejects incomplete successful reports before persistence', async () => {
    const result = await handlers.get('xot_report_coaching_run')!({
      operationId,
      runId: '00000000-0000-4000-8000-000000000002',
      leaseToken: 'a'.repeat(64),
      status: 'succeeded',
    });
    expect(result.isError).toBe(true);
    expect(fixture.report).not.toHaveBeenCalled();
    expect(fixture.log).toHaveBeenLastCalledWith(
      'info',
      'Coaching MCP write invocation.',
      {
        tool: 'xot_report_coaching_run',
        stage: 'arguments',
        outcome: 'failed',
      }
    );
  });
  it('identifies an expired lease during execution without logging the exception text', async () => {
    fixture.report.mockRejectedValue(
      new Error('Expired synthetic-private-lease-token')
    );
    const result = await handlers.get('xot_report_coaching_run')!({
      operationId,
      runId: '00000000-0000-4000-8000-000000000002',
      leaseToken: 'a'.repeat(64),
      status: 'heartbeat',
    });
    expect(result.isError).toBe(true);
    expect(fixture.log).toHaveBeenLastCalledWith(
      'info',
      'Coaching MCP write invocation.',
      {
        tool: 'xot_report_coaching_run',
        stage: 'operation',
        outcome: 'failed',
      }
    );
    expect(JSON.stringify(fixture.log.mock.calls)).not.toContain(
      'synthetic-private-lease-token'
    );
  });
});
