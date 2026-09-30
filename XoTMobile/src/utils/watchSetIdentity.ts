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
