import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
const fixture = vi.hoisted(() => ({
  claim: vi.fn(),
  authorize: vi.fn(async () => {}),
  log: vi.fn(),
}));
vi.mock('../services/coachingRunService.js', () => ({
  getCoachingContext: vi.fn(),
  claimCoachingRun: fixture.claim,
  getCoachingSnapshot: vi.fn(),
  submitCoachingProposals: vi.fn(),
  reportCoachingRun: vi.fn(),
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
const handlers = new Map<string, Handler>();
const operationId = '00000000-0000-4000-8000-000000000001';
const call = (args: unknown) => handlers.get('xot_claim_coaching_run')!(args);
describe('coaching MCP validation stages', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    handlers.clear();
    registerCoachingTools(
      { registerTool: (name, _config, handler) => handlers.set(name, handler) },
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
      expect(fixture.log).not.toHaveBeenCalled();
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
    expect(fixture.log).toHaveBeenCalledExactlyOnceWith(
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
});
