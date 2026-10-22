import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveServerConfigId } from './storage';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import {
  nutritionIdentityGeneration,
  nutritionConfigChanging,
  nutritionIdentityBlocked,
  assertNutritionTransportGeneration,
  beginNutritionIdentityChange,
  establishNutritionIdentity,
  notifyNutritionIdentityEstablished,
  observeNutritionIdentity,
  IdentityChangedError,
} from './nutritionIdentityLifecycle';
const PREFIX = '@SparkyFitness/nutrition-identity/v1/';
const keyFor = (serverConfigId: string) =>
  `${PREFIX}${encodeURIComponent(serverConfigId)}`;
let tail: Promise<void> = Promise.resolve();
let pending = 0;
let storageRevision = 0;
let notifyGeneration: number | null = null;
/** Uncancellable native writes settle before a newer same-key publication. */
function serialized<T>(work: () => Promise<T>): Promise<T> {
  pending += 1;
  storageRevision += 1;
  const result = tail.then(work, work);
  tail = result.then(
    () => undefined,
    () => undefined
  );
  return result.finally(() => {
    pending -= 1;
    if (!pending && notifyGeneration !== null) {
      const revision = notifyGeneration;
      notifyGeneration = null;
      notifyNutritionIdentityEstablished(revision);
    }
  });
}
export function subscribeNutritionIdentity(listener: () => void): () => void {
  return observeNutritionIdentity(listener);
}
export interface NutritionIdentityPublication {
  readonly serverConfigId: string;
  assertCurrent: () => Promise<void>;
}
/** Profile publication uses its captured destination; never reselect after HTTP. */
export async function rememberActiveNutritionUser(
  userId: string,
  publication?: NutritionIdentityPublication
): Promise<void> {
  const generation = nutritionIdentityGeneration();
  const serverConfigId =
    publication?.serverConfigId ?? (await getActiveServerConfigId());
  assertNutritionTransportGeneration(generation);
  if (!serverConfigId || !userId) return;
  await serialized(async () => {
    const assertCurrent = async () => {
      assertNutritionTransportGeneration(generation);
      await publication?.assertCurrent();
      assertNutritionTransportGeneration(generation);
    };
    await assertCurrent();
    const key = keyFor(serverConfigId);
    const encoded = JSON.stringify({ version: 1, userId });
    const existing = await AsyncStorage.getItem(key);
    await assertCurrent();
    let wrote = false;
    try {
      if (existing !== encoded) {
        // Set before awaiting: a rejected native write may have an uncertain outcome.
        wrote = true;
        await AsyncStorage.setItem(key, encoded);
      }
      await assertCurrent();
      const wasBlocked = nutritionIdentityBlocked();
      establishNutritionIdentity(generation);
      if (existing !== encoded || wasBlocked) notifyGeneration = generation;
    } catch (error) {
      // Still inside the serial operation: B cannot have published on this key.
      // Never run cleanup after unlocking, where it could erase a newer owner.
      if (wrote) await AsyncStorage.removeItem(key);
      throw error;
    }
  });
}
export async function getActiveNutritionIdentity(): Promise<NutritionActionIdentity | null> {
  const generation = nutritionIdentityGeneration();
  const revision = storageRevision;
  if (pending || nutritionConfigChanging() || nutritionIdentityBlocked())
    return null;
  const serverConfigId = await getActiveServerConfigId();
  if (!serverConfigId) return null;
  const raw = await AsyncStorage.getItem(keyFor(serverConfigId));
  if (
    pending ||
    revision !== storageRevision ||
    generation !== nutritionIdentityGeneration() ||
    nutritionConfigChanging() ||
    nutritionIdentityBlocked()
  )
    return null;
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Saved nutrition identity is unreadable.');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    parsed.version !== 1 ||
    !('userId' in parsed) ||
    typeof parsed.userId !== 'string' ||
    !parsed.userId
  )
    throw new Error('Saved nutrition identity is unreadable.');
  return { serverConfigId, userId: parsed.userId };
}
/** Internal config boundary: caller invalidates before entering this queue. */
export function forgetNutritionIdentityFor(
  serverConfigId: string
): Promise<void> {
  return serialized(async () => {
    await AsyncStorage.removeItem(keyFor(serverConfigId));
  });
}
export async function forgetActiveNutritionIdentity(): Promise<void> {
  const finish = beginNutritionIdentityChange();
  const generation = nutritionIdentityGeneration();
  try {
    const serverConfigId = await getActiveServerConfigId();
    if (generation !== nutritionIdentityGeneration())
      throw new IdentityChangedError();
    if (serverConfigId) await forgetNutritionIdentityFor(serverConfigId);
  } finally {
    finish();
  }
}
