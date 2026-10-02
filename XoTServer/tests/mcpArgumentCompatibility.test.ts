import { describe, expect, it } from 'vitest';
import { normalizeMcpToolArguments } from '../utils/mcpArguments.js';
describe('MCP argument compatibility', () => {
  it('preserves required nullable references and explicit clears for typed proposals', () => {
    const args = {
      proposals: [
        {
          success: { subjectId: null, baseline: null },
          action: {
            kind: 'notification_settings',
            changes: { daily_limit: null },
          },
        },
      ],
    };
    expect(
      normalizeMcpToolArguments('xot_submit_coaching_proposals', args)
    ).toEqual(args);
  });
  it('keeps legacy optional-placeholder behavior for older read/write tools', () => {
    expect(
      normalizeMcpToolArguments('sparky_get_goal_snapshot', {
        target_date: null,
        nested: [{ omitted: null, retained: 0 }],
      })
    ).toEqual({ nested: [{ retained: 0 }] });
  });
});
