import { describe, it, expect, vi } from 'vitest';
import { buildActivityPlanningTools } from '../ai/tools/activityPlanningTools.js';
import { getActivityPlanning } from '../services/activityPlanningService.js';
import { checkReadOnlyScope } from '../ai/mcp/readOnlyScope.js';
import { readOnlyEvidenceContext } from '../ai/mcp/readOnlyEvidenceContext.js';
import { projectActivityPlanning } from '../services/activityPlanningProjection.js';
import { activityData } from './fixtures/activityPlanning.js';
import { toolOpts } from './helpers/toolExecutionOptions.js';
vi.mock('../services/activityPlanningService.js', () => ({
  getActivityPlanning: vi.fn(),
}));
describe('pure planning MCP reads', () => {
  it('returns saved prescriptions and bounds dates/pages', async () => {
    const tools = buildActivityPlanningTools('owner', 'Europe/Berlin');
    const result = projectActivityPlanning(
      activityData(),
      '2026-10-01',
      '2026-10-01',
      'Europe/Berlin',
      '2026-10-01'
    );
    vi.mocked(getActivityPlanning).mockResolvedValue(result);
    const text = await tools.xot_get_workout_plans.execute!(
      { date: '2026-10-01', limit: 50, offset: 0 },
      toolOpts
    );
    expect(
      JSON.parse(String(text)).workout_plans[0].assignments[0].exercises[0]
        .expectedSets
    ).toBe(2);
    expect(
      checkReadOnlyScope(
        'xot_get_activity_planning',
        { start_date: '2026-10-01', end_date: '2026-11-01' },
        'UTC'
      )
    ).toContain('1–31');
    expect(
      JSON.parse(
        readOnlyEvidenceContext(
          'xot_get_activity_planning',
          { start_date: '2026-10-01', end_date: '2026-10-07' },
          'UTC'
        )
      ).requested_period
    ).toEqual({ start_date: '2026-10-01', end_date: '2026-10-07' });
  });
  it('pages records without shrinking the weekly summary', async () => {
    const result = projectActivityPlanning(
      activityData(),
      '2026-10-01',
      '2026-10-01',
      'UTC',
      '2026-10-01'
    );
    vi.mocked(getActivityPlanning).mockResolvedValue(result);
    const text = await buildActivityPlanningTools('owner', 'UTC')
      .xot_get_activity_planning.execute!(
      { start_date: '2026-10-01', end_date: '2026-10-01', limit: 1, offset: 1 },
      toolOpts
    );
    expect(JSON.parse(String(text))).toMatchObject({
      occurrences: [],
      summary: result.summary,
      page: { occurrence_count: 1, offset: 1 },
    });
  });
});
