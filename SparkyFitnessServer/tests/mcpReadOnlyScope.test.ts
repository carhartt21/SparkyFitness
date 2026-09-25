import { describe, expect, it } from 'vitest';
import { checkReadOnlyScope } from '../ai/mcp/readOnlyScope.js';
import { readOnlyEvidenceContext } from '../ai/mcp/readOnlyEvidenceContext.js';
import { formatJsonResult, formatList } from '../ai/tools/formatting.js';

describe('read-only MCP call scope', () => {
  it('bounds diary and summary ranges using calendar days', () => {
    expect(
      checkReadOnlyScope(
        'sparky_get_food_diary',
        { start_date: '2026-09-01', end_date: '2026-09-07' },
        'UTC'
      )
    ).toBeNull();
    expect(
      checkReadOnlyScope(
        'sparky_get_food_diary',
        { start_date: '2026-09-01', end_date: '2026-09-08' },
        'UTC'
      )
    ).toContain('1–7 calendar days');
    expect(
      checkReadOnlyScope(
        'sparky_get_daily_exercise_totals',
        { start_date: '2026-09-01', end_date: '2026-10-01' },
        'UTC'
      )
    ).toBeNull();
    expect(
      checkReadOnlyScope(
        'sparky_get_daily_exercise_totals',
        { start_date: '2026-09-01', end_date: '2026-10-02' },
        'UTC'
      )
    ).toContain('1–31 calendar days');
    expect(
      checkReadOnlyScope(
        'sparky_get_food_usage',
        { start_date: '2026-09-02', end_date: '2026-09-01' },
        'UTC'
      )
    ).toContain('1–31 calendar days');
    expect(
      checkReadOnlyScope(
        'sparky_get_food_diary',
        { start_date: '2026-02-30', end_date: '2026-02-30' },
        'UTC'
      )
    ).toContain('valid YYYY-MM-DD dates');
  });

  it('caps page sizes and offsets before dispatch', () => {
    expect(
      checkReadOnlyScope('sparky_list_foods', { limit: 51 }, 'UTC')
    ).toContain('limit must be between 1 and 50');
    expect(
      checkReadOnlyScope('sparky_search_exercises', { offset: 1001 }, 'UTC')
    ).toContain('offset must be between 0 and 1000');
    expect(
      checkReadOnlyScope(
        'sparky_list_foods',
        { limit: 50, offset: 1000 },
        'UTC'
      )
    ).toBeNull();
  });

  it('requires a bounded explicit period for exercise statistics', () => {
    expect(
      checkReadOnlyScope(
        'sparky_get_exercise_stats',
        { action: 'stats_summary', interval: 'custom' },
        'UTC'
      )
    ).toContain('valid date range is required');
    expect(
      checkReadOnlyScope(
        'sparky_get_exercise_stats',
        {
          action: 'stats_summary',
          interval: 'lifetime',
          start_date: '2026-09-01',
          end_date: '2026-09-02',
        },
        'UTC'
      )
    ).toContain('Lifetime stats are not available');
    expect(
      checkReadOnlyScope(
        'sparky_get_exercise_stats',
        { action: 'personal_records' },
        'UTC'
      )
    ).toContain('stats_summary and query_activities only');
    expect(
      checkReadOnlyScope(
        'sparky_get_exercise_stats',
        {
          action: 'query_activities',
          start_date: '2026-09-01',
          end_date: '2026-09-30',
          page: 21,
        },
        'UTC'
      )
    ).toContain('page must be between 1 and 20');
    expect(
      checkReadOnlyScope(
        'sparky_get_exercise_stats',
        {
          action: 'query_activities',
          start_date: '2026-09-01',
          end_date: '2026-09-30',
          page_size: 50,
        },
        'UTC'
      )
    ).toBeNull();
  });

  it('rejects progress arguments that would query outside the checked period', () => {
    expect(
      checkReadOnlyScope(
        'sparky_get_exercise_progress',
        { exercise_id: 'bench', date: '2026-09-01' },
        'UTC'
      )
    ).toContain('date is not supported');
    expect(
      checkReadOnlyScope(
        'sparky_get_exercise_progress',
        { exercise_id: 'bench', start_date: '2026-09-01' },
        'UTC'
      )
    ).toContain('valid date range is required');
    expect(
      checkReadOnlyScope(
        'sparky_get_exercise_progress',
        { exercise_id: 'bench', end_date: '2026-09-01' },
        'UTC'
      )
    ).toContain('valid date range is required');
    expect(
      checkReadOnlyScope(
        'sparky_get_exercise_progress',
        {
          exercise_id: 'bench',
          start_date: '2026-09-01',
          end_date: '2026-10-01',
        },
        'UTC'
      )
    ).toBeNull();
    expect(
      checkReadOnlyScope(
        'sparky_get_exercise_progress',
        {
          exercise_id: 'bench',
          start_date: '2026-09-01',
          end_date: '2026-10-02',
        },
        'UTC'
      )
    ).toContain('1–31 calendar days');
  });

  it('reports the prior period used by exercise summary comparisons', () => {
    const evidence = JSON.parse(
      readOnlyEvidenceContext(
        'sparky_get_exercise_stats',
        {
          action: 'stats_summary',
          start_date: '2026-09-01',
          end_date: '2026-09-07',
        },
        'UTC'
      )
    );
    expect(evidence.requested_period).toEqual({
      start_date: '2026-09-01',
      end_date: '2026-09-07',
    });
    expect(evidence.comparison_period).toEqual({
      start_date: '2026-08-25',
      end_date: '2026-08-31',
    });
  });

  it('reports when a formatter omitted fetched records without claiming complete coverage', () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      id: index,
      note: 'a'.repeat(400),
    }));
    const jsonResult = formatJsonResult(rows);
    const listResult = formatList(
      rows,
      'Rows',
      (row) => `${row.id}: ${row.note}`
    );
    expect(jsonResult).toContain('Result truncated:');
    expect(listResult).toContain('fetched item(s) omitted for length');
    for (const result of [jsonResult, listResult]) {
      const evidence = JSON.parse(
        readOnlyEvidenceContext('sparky_list_foods', {}, 'UTC', result)
      );
      expect(evidence.output_truncation).toBe('reported');
      expect(evidence.completeness).toContain('does not prove');
    }

    const untruncated = JSON.parse(
      readOnlyEvidenceContext('sparky_list_foods', {}, 'UTC', '[{"id":1}]')
    );
    expect(untruncated.output_truncation).toBe('not_reported');
  });
});
