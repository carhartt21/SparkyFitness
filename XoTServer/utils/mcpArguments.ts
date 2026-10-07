import { isCoachingMcpTool } from '@workspace/shared';

/** Legacy tools accept null placeholders; typed writes retain real null values. */
export function normalizeMcpToolArguments(
  name: unknown,
  value: unknown
): unknown {
  if (isCoachingMcpTool(name) || name === 'xot_update_mobility') return value;
  const stripNulls = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(stripNulls);
    if (input && typeof input === 'object')
      return Object.fromEntries(
        Object.entries(input)
          .filter(([, item]) => item !== null)
          .map(([key, item]) => [key, stripNulls(item)])
      );
    return input;
  };
  return stripNulls(value);
}
