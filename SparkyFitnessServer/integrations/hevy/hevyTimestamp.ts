const UTC_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/i;

/** Hevy API timestamps name instants, so an offset is required. */
export function parseHevyInstant(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !UTC_OFFSET.test(value)) {
    throw new Error(`Hevy ${field} has no UTC offset.`);
  }
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error(`Hevy ${field} is invalid.`);
  }
  return instant;
}

export function isValidHevyInstant(value: unknown): value is string {
  try {
    parseHevyInstant(value, 'timestamp');
    return true;
  } catch {
    return false;
  }
}
