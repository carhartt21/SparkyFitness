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
// A cohort is scoped to one continuously established active identity. Every
// unrelated/general invalidation discards it, while transport generations still
// advance for each member (so no old request or callback becomes current).
interface InactiveRecovery {
  activeId: string | null;
  valid: boolean;
}
let inactiveRecovery: InactiveRecovery | null = null;
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
export function beginNutritionIdentityChange(
  allowInactiveRecovery = false
): (unchangedActiveId?: string) => void {
  const recovery = allowInactiveRecovery
    ? (inactiveRecovery ??
      (!blocked && transitions === 0 ? { activeId: null, valid: true } : null))
    : null;
  // Membership precedes observer notification: a reentrant general change must
  // discard this exact cohort, never be overwritten by the outer begin.
  inactiveRecovery = recovery;
  generation += 1;
  transitions += 1;
  blocked = true;
  let finished = false;
  const finish = (unchangedActiveId?: string) => {
    if (finished) return;
    finished = true;
    if (recovery && recovery === inactiveRecovery) {
      if (
        !unchangedActiveId ||
        (recovery.activeId && recovery.activeId !== unchangedActiveId)
      )
        recovery.valid = false;
      else recovery.activeId = unchangedActiveId;
    }
    transitions -= 1;
    if (transitions === 0) {
      const complete = inactiveRecovery;
      // Detach before notifying: a successor created by a listener owns its own
      // cohort/block and cannot be erased by this terminating finish.
      inactiveRecovery = null;
      if (complete?.valid && complete.activeId) {
        blocked = false;
        changed();
      }
    }
  };
  try {
    changed();
  } catch (error) {
    // Even an observer exception must settle the unreturned member. No proof
    // was collected, so it cannot restore an identity.
    finish();
    throw error;
  }
  return finish;
}
export function establishNutritionIdentity(expected: number): void {
  assertNutritionTransportGeneration(expected);
  blocked = false;
}
export function notifyNutritionIdentityEstablished(expected: number): void {
  if (expected === generation && !transitions && !blocked) changed();
}
