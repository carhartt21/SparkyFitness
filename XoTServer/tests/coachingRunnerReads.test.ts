import { describe, expect, it } from 'vitest';
import {
  defaultCoachingSettings,
  defaultCoachingSettingsV2,
} from '@workspace/shared';
import { CoachingRunReadAudit } from '../tools/coachingRunnerReads.js';
const id = '00000000-0000-4000-8000-000000000001';
const event = (
  tool: string,
  body: unknown,
  args: Record<string, unknown> = {}
) => ({
  type: 'item.completed',
  item: {
    type: 'mcp_tool_call',
    server: 'xot',
    tool,
    status: 'completed',
    error: null,
    arguments: args,
    result: { content: [{ type: 'text', text: JSON.stringify(body) }] },
  },
});
const snapshot = (
  offset: number,
  nextOffset: number | null,
  snapshotId = id
) => ({
  snapshotId,
  from: '2026-09-25',
  to: '2026-10-01',
  createdAt: '2026-10-01T10:00:00Z',
  total: 101,
  offset,
  nextOffset,
  rows: [],
  warnings: [],
});
const context = {
  enabled: true,
  timezone: 'Europe/Berlin',
  today: '2026-10-01',
  settings: defaultCoachingSettings,
  agent: null,
  due: null,
  runs: [],
  proposals: [],
  commitments: [],
  events: [],
  nextEventCursor: 0,
  reconsiderTopics: [],
  nextProposalOffset: null,
  nextCommitmentOffset: null,
};
describe('subscription evidence-read audit', () => {
  it('requires successful reads of the assigned snapshot and every context cursor before empty or nonempty publication', () => {
    const audit = new CoachingRunReadAudit(id);
    expect(audit.complete()).toBe(false);
    audit.observe(
      event('xot_get_coaching_context', { ...context, nextProposalOffset: 100 })
    );
    audit.observe(event('xot_get_coaching_snapshot', snapshot(0, 100)));
    expect(audit.complete()).toBe(false);
    audit.observe(event('xot_get_coaching_snapshot', snapshot(100, null)));
    expect(audit.complete()).toBe(false);
    audit.observe(
      event('xot_get_coaching_context', context, { proposalOffset: 100 })
    );
    expect(audit.complete()).toBe(true);
  });
  it('rejects a different snapshot, failed reads and skipped event pages without retaining their payloads', () => {
    const audit = new CoachingRunReadAudit(id);
    audit.observe(
      event(
        'xot_get_coaching_snapshot',
        snapshot(0, null, '00000000-0000-4000-8000-000000000002')
      )
    );
    audit.observe({
      type: 'item.completed',
      item: { type: 'error', message: 'code-mode host is disabled' },
    });
    audit.observe(event('xot_get_coaching_context', context));
    expect(audit.complete()).toBe(false);
    audit.observe(event('xot_get_coaching_snapshot', snapshot(0, null)));
    const events = Array.from({ length: 100 }, (_, index) => ({
      sequence: index + 1,
      proposalId: null,
      actionId: null,
      kind: 'outcome',
      createdAt: '2026-10-01T10:00:00Z',
      data: {},
    }));
    audit.observe(
      event('xot_get_coaching_context', {
        ...context,
        events,
        nextEventCursor: 100,
      })
    );
    expect(audit.complete()).toBe(false);
    audit.observe(
      event(
        'xot_get_coaching_context',
        { ...context, nextEventCursor: 100 },
        { eventCursor: 100 }
      )
    );
    expect(audit.complete()).toBe(true);
  });
  it('audits protocol-2 feedback from the frozen cursor without rereading acknowledged history', () => {
    const audit = new CoachingRunReadAudit(id, 500);
    audit.observe(event('xot_get_coaching_snapshot', snapshot(0, null)));
    audit.observe(
      event('xot_get_coaching_context', {
        ...context,
        protocolVersion: 2,
        settings: defaultCoachingSettingsV2,
        processedEventCursor: 500,
        nextEventCursor: 500,
      })
    );
    expect(audit.complete()).toBe(true);
    const missing = new CoachingRunReadAudit(id, 500);
    missing.observe(event('xot_get_coaching_snapshot', snapshot(0, null)));
    missing.observe(
      event(
        'xot_get_coaching_context',
        {
          ...context,
          protocolVersion: 2,
          settings: defaultCoachingSettingsV2,
          processedEventCursor: 500,
          nextEventCursor: 500,
        },
        { eventCursor: 0 }
      )
    );
    expect(missing.complete()).toBe(false);
  });
});
