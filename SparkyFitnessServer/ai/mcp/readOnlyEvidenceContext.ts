import { addDays, daysBetween, todayInZone } from '@workspace/shared';
import { normalizeDayKeywords } from '../tools/dates.js';

const PERIOD_TOOLS = new Set([
  'sparky_get_exercise_diary',
  'sparky_get_daily_exercise_totals',
  'sparky_get_exercise_usage',
  'sparky_get_exercise_progress',
  'sparky_get_food_diary',
  'sparky_get_nutrition_summary',
  'sparky_get_food_usage',
]);

type Period = { start_date: string; end_date: string } | null;

function requestedPeriod(
  toolName: string,
  args: Record<string, unknown>,
  tz: string
): Period {
  if (toolName === 'sparky_get_goal_snapshot') {
    const date = args.target_date ?? todayInZone(tz);
    return typeof date === 'string'
      ? { start_date: date, end_date: date }
      : null;
  }
  if (toolName === 'sparky_get_exercise_stats') {
    return typeof args.start_date === 'string' &&
      typeof args.end_date === 'string'
      ? { start_date: args.start_date, end_date: args.end_date }
      : null;
  }
  if (toolName === 'sparky_get_exercise_progress') {
    return typeof args.start_date === 'string' &&
      typeof args.end_date === 'string'
      ? { start_date: args.start_date, end_date: args.end_date }
      : null;
  }
  if (!PERIOD_TOOLS.has(toolName)) return null;
  const date = args.date;
  const start = date ?? args.start_date ?? todayInZone(tz);
  const end = date ?? args.end_date ?? start;
  return typeof start === 'string' && typeof end === 'string'
    ? { start_date: start, end_date: end }
    : null;
}

/** Context travels as a separate MCP text block, preserving the tool payload. */
export function readOnlyEvidenceContext(
  toolName: string,
  rawArgs: unknown,
  tz: string,
  resultText = ''
): string {
  const normalized = normalizeDayKeywords(rawArgs, tz);
  const args =
    normalized && typeof normalized === 'object' && !Array.isArray(normalized)
      ? (normalized as Record<string, unknown>)
      : {};
  const period = requestedPeriod(toolName, args, tz);
  // stats_summary also reads the immediately preceding window to calculate
  // comparison percentages. Make that extra source period visible to callers.
  const comparisonPeriod =
    toolName === 'sparky_get_exercise_stats' &&
    args.action === 'stats_summary' &&
    period
      ? {
          start_date: addDays(
            addDays(period.start_date, -1),
            -Math.max(1, daysBetween(period.start_date, period.end_date))
          ),
          end_date: addDays(period.start_date, -1),
        }
      : null;
  // These are the warnings emitted by the shared tool formatters when they
  // omit fetched records or cut an oversized response. A missing warning only
  // means no truncation was reported; it does not establish complete coverage.
  const outputTruncationReported =
    /(?:^|\n)⚠️ (?:Response truncated|Result truncated:|\d+ fetched item\(s\) omitted for length)/.test(
      resultText
    );
  return JSON.stringify({
    kind: 'x-on-track-read-only-evidence-context',
    tool: toolName,
    source: 'X on Track server, authenticated key owner',
    requested_period: period,
    comparison_period: comparisonPeriod,
    time_zone: tz,
    output_truncation: outputTruncationReported ? 'reported' : 'not_reported',
    units:
      'Use units in the result fields and record properties; no MCP conversion or missing-unit inference is applied.',
    provenance:
      'Original device or provider is known only when the returned record identifies it.',
    completeness:
      'The result can be partial because of filters, pagination, or output truncation; it does not prove the full account history was returned.',
    unsynced_device_boundary:
      'Phone and Watch actions not yet uploaded to the server are absent.',
  });
}
