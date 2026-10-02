import { isCoachingMcpTool } from '@workspace/shared';

/** Legacy clients send optional null placeholders; typed coaching keeps clears. */
export function normalizeMcpToolArguments(
  name: unknown,
  value: unknown
): unknown {
  if (isCoachingMcpTool(name)) return value;
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
