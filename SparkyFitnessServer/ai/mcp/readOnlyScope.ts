import { isDayString, todayInZone } from '@workspace/shared';
import { normalizeDayKeywords } from '../tools/dates.js';
import { toolError } from '../tools/errors.js';

const MAX_PAGE_SIZE = 50;
const MAX_OFFSET = 1_000;
const MAX_RANGE_DAYS = 31;
const MAX_DIARY_DAYS = 7;

const DATE_RANGE_TOOLS = new Set([
  'sparky_get_exercise_diary',
  'sparky_get_daily_exercise_totals',
  'sparky_get_exercise_usage',
  'sparky_get_exercise_progress',
  'sparky_get_food_diary',
  'sparky_get_nutrition_summary',
  'sparky_get_food_usage',
]);

const DIARY_TOOLS = new Set([
  'sparky_get_exercise_diary',
  'sparky_get_food_diary',
]);

function dayNumber(day: string): number | null {
  if (!isDayString(day)) return null;
  const [year, month, date] = day.split('-').map(Number);
  const millis = Date.UTC(year, month - 1, date);
  return new Date(millis).toISOString().slice(0, 10) === day
    ? millis / 86_400_000
    : null;
}

function checkRange(
  start: unknown,
  end: unknown,
  maxDays: number
): string | null {
  if (typeof start !== 'string' || typeof end !== 'string') {
    return toolError('READ_ONLY_SCOPE', 'A valid date range is required.');
  }
  const startDay = dayNumber(start);
  const endDay = dayNumber(end);
  if (startDay === null || endDay === null) {
    return toolError('READ_ONLY_SCOPE', 'Use valid YYYY-MM-DD dates.');
  }
  const days = endDay - startDay + 1;
  if (days < 1 || days > maxDays) {
    return toolError(
      'READ_ONLY_SCOPE',
      `Read-only requests must cover 1–${maxDays} calendar days.`
    );
  }
  return null;
}

/** Per-call bounds for an externally delegated read-only MCP key. */
export function checkReadOnlyScope(
  toolName: string,
  rawArgs: unknown,
  tz: string
): string | null {
  const normalized = normalizeDayKeywords(rawArgs, tz);
  if (
    !normalized ||
    typeof normalized !== 'object' ||
    Array.isArray(normalized)
  ) {
    return toolError('READ_ONLY_SCOPE', 'Tool arguments must be an object.');
  }
  const args = normalized as Record<string, unknown>;

  for (const field of ['limit', 'page_size']) {
    const value = args[field];
    if (
      value !== undefined &&
      (typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > MAX_PAGE_SIZE)
    ) {
      return toolError(
        'READ_ONLY_SCOPE',
        `${field} must be between 1 and ${MAX_PAGE_SIZE}.`
      );
    }
  }
  if (
    args.offset !== undefined &&
    (typeof args.offset !== 'number' ||
      !Number.isInteger(args.offset) ||
      args.offset < 0 ||
      args.offset > MAX_OFFSET)
  ) {
    return toolError(
      'READ_ONLY_SCOPE',
      `offset must be between 0 and ${MAX_OFFSET}.`
    );
  }

  // Unlike the other date-range tools, exercise progress passes its two
  // endpoints directly to the repository. It ignores `date` and substitutes
  // 1970/9999 for a missing endpoint, so the generic day default would claim
  // a bounded request while executing an all-history query.
  if (toolName === 'sparky_get_exercise_progress') {
    if (args.date !== undefined) {
      return toolError(
        'READ_ONLY_SCOPE',
        'Exercise progress requires start_date and end_date; date is not supported.'
      );
    }
    return checkRange(args.start_date, args.end_date, MAX_RANGE_DAYS);
  }

  if (DATE_RANGE_TOOLS.has(toolName)) {
    const today = todayInZone(tz);
    const date = args.date;
    const start = date ?? args.start_date ?? today;
    const end = date ?? args.end_date ?? start;
    return checkRange(
      start,
      end,
      DIARY_TOOLS.has(toolName) ? MAX_DIARY_DAYS : MAX_RANGE_DAYS
    );
  }

  if (toolName === 'sparky_get_exercise_stats') {
    if (args.action !== 'stats_summary' && args.action !== 'query_activities') {
      return toolError(
        'READ_ONLY_SCOPE',
        'Read-only exercise stats support stats_summary and query_activities only.'
      );
    }
    if (args.interval === 'lifetime') {
      return toolError('READ_ONLY_SCOPE', 'Lifetime stats are not available.');
    }
    if (
      args.page !== undefined &&
      (typeof args.page !== 'number' ||
        !Number.isInteger(args.page) ||
        args.page < 1 ||
        args.page > 20)
    ) {
      return toolError('READ_ONLY_SCOPE', 'page must be between 1 and 20.');
    }
    return checkRange(args.start_date, args.end_date, MAX_RANGE_DAYS);
  }

  return null;
}
