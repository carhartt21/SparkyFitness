import { getActiveNutritionIdentity } from './nutritionIdentity';

/** A Watch capture belongs to the account that supplied its context. */
export async function isCurrentWatchActionScope(
  scope: string
): Promise<boolean> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(scope);
  } catch {
    return false;
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== 'string' ||
    !parsed[0] ||
    typeof parsed[1] !== 'string' ||
    !parsed[1]
  ) {
    return false;
  }
  try {
    const identity = await getActiveNutritionIdentity();
    return (
      identity?.serverConfigId === parsed[0] && identity.userId === parsed[1]
    );
  } catch {
    return false;
  }
}
