/** The values a Watch action must still match before the phone applies it. */
export function watchSetSignature(set: {
  set_type?: string | null;
  weight?: number | null;
  reps?: number | null;
  duration?: number | null;
}): string {
  return JSON.stringify([
    set.set_type ?? null,
    set.weight ?? null,
    set.reps ?? null,
    set.duration ?? null,
  ]);
}

/** Largest values a Watch edit may set; anything beyond is a bad payload. */
const MAX_WATCH_WEIGHT_KG = 1000;
const MAX_WATCH_REPS = 1000;

/**
 * The weight/reps a Watch action asks to set, or `undefined` when it sets
 * none. `null` means the payload carried values that are out of range, which
 * the caller treats as a conflict rather than applying part of it.
 */
export function watchSetPatch(operation: {
  weightKg?: number;
  reps?: number;
}): { weight?: number; reps?: number } | null | undefined {
  const { weightKg, reps } = operation;
  if (weightKg === undefined && reps === undefined) return undefined;
  if (
    weightKg !== undefined &&
    !(
      Number.isFinite(weightKg) &&
      weightKg >= 0 &&
      weightKg <= MAX_WATCH_WEIGHT_KG
    )
  ) {
    return null;
  }
  if (
    reps !== undefined &&
    !(Number.isInteger(reps) && reps >= 0 && reps <= MAX_WATCH_REPS)
  ) {
    return null;
  }
  return {
    ...(weightKg !== undefined
      ? { weight: Math.round(weightKg * 1000) / 1000 }
      : {}),
    ...(reps !== undefined ? { reps } : {}),
  };
}

/** Expected persisted identity after an edit, including fields the Watch did not edit. */
export function watchEditedSetSignature(
  signature: string,
  patch: { weight?: number; reps?: number } | undefined
): string | null {
  try {
    const values: unknown = JSON.parse(signature);
    if (!Array.isArray(values) || values.length !== 4) return null;
    const [type, weight, reps, duration]: unknown[] = values;
    if (type !== null && typeof type !== 'string') return null;
    if (
      [weight, reps, duration].some(
        (value) =>
          value !== null &&
          (typeof value !== 'number' || !Number.isFinite(value))
      )
    )
      return null;
    return JSON.stringify([
      type,
      patch?.weight ?? weight,
      patch?.reps ?? reps,
      duration,
    ]);
  } catch {
    return null;
  }
}
