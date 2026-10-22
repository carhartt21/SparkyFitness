/** Ephemeral invalidation shared by config storage and nutrition identity. */
export class IdentityChangedError extends Error {
  constructor() {
    super('Account changed. Refresh before trying again.');
    this.name = 'IdentityChangedError';
  }
}
let generation = 0;
let transitions = 0;
let blocked = false;
const listeners = new Set<() => void>();
export const nutritionIdentityGeneration = () => generation;
export const nutritionConfigChanging = () => transitions > 0;
export const nutritionIdentityBlocked = () => blocked;
export function assertNutritionTransportGeneration(expected: number): void {
  if (expected !== generation || transitions > 0)
    throw new IdentityChangedError();
}
export function observeNutritionIdentity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function changed() {
  listeners.forEach((listener) => listener());
}
/** Invalidation precedes all awaited config/forget work, including ABA. */
export function beginNutritionIdentityChange(): (
  preserveUnchangedIdentity?: boolean
) => void {
  const wasBlocked = blocked;
  generation += 1;
  const changeGeneration = generation;
  transitions += 1;
  blocked = true;
  changed();
  let finished = false;
  return (preserveUnchangedIdentity = false) => {
    if (!finished) {
      finished = true;
      transitions -= 1;
      // Only targeted inactive maintenance may request this recovery. It must
      // prove the active destination unchanged; never clear another change.
      if (
        preserveUnchangedIdentity &&
        !wasBlocked &&
        changeGeneration === generation &&
        transitions === 0
      ) {
        blocked = false;
        changed();
      }
    }
  };
}
export function establishNutritionIdentity(expected: number): void {
  assertNutritionTransportGeneration(expected);
  blocked = false;
}
export function notifyNutritionIdentityEstablished(expected: number): void {
  if (expected === generation && !transitions && !blocked) changed();
}
