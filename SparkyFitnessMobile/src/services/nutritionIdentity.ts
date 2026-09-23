import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveServerConfigId } from './storage';
import type { NutritionActionIdentity } from './nutritionActionOutbox';

const PREFIX = '@SparkyFitness/nutrition-identity/v1/';
const listeners = new Set<() => void>();
const keyFor = (serverConfigId: string) =>
  `${PREFIX}${encodeURIComponent(serverConfigId)}`;

function changed() {
  listeners.forEach((listener) => listener());
}

export function subscribeNutritionIdentity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called only after a successful authenticated profile response. */
export async function rememberActiveNutritionUser(
  userId: string
): Promise<void> {
  const serverConfigId = await getActiveServerConfigId();
  if (!serverConfigId || !userId) return;
  const key = keyFor(serverConfigId);
  const existing = await AsyncStorage.getItem(key);
  if (existing === JSON.stringify({ version: 1, userId })) return;
  await AsyncStorage.setItem(key, JSON.stringify({ version: 1, userId }));
  changed();
}

export async function getActiveNutritionIdentity(): Promise<NutritionActionIdentity | null> {
  const serverConfigId = await getActiveServerConfigId();
  if (!serverConfigId) return null;
  const raw = await AsyncStorage.getItem(keyFor(serverConfigId));
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
  ) {
    throw new Error('Saved nutrition identity is unreadable.');
  }
  return { serverConfigId, userId: parsed.userId };
}

/** Invalidate the active mapping when login, account, or server changes. */
export async function forgetActiveNutritionIdentity(): Promise<void> {
  const serverConfigId = await getActiveServerConfigId();
  if (!serverConfigId) return;
  await AsyncStorage.removeItem(keyFor(serverConfigId));
  changed();
}
