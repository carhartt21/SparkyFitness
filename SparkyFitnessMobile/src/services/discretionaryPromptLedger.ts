import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NutritionActionIdentity } from './nutritionActionOutbox';
import { toLocalDateString } from '../utils/dateUtils';

const KEY = '@SparkyFitness/discretionaryPromptLedger:v1';
const DAILY_CAP = 3;
const FUTURE_RELEASE_MARGIN_MS = 2 * 60_000;

interface PromptSlot {
  serverConfigId: string | null;
  userId: string | null;
  candidateId: string;
  at: number;
  cancelled: boolean;
}

let queue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

export function subscribeDiscretionaryPromptBudget(
  listener: () => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function sameScope(
  slot: PromptSlot,
  identity: NutritionActionIdentity | null
): boolean {
  return (
    slot.serverConfigId === (identity?.serverConfigId ?? null) &&
    slot.userId === (identity?.userId ?? null)
  );
}

function countsForScope(
  slot: PromptSlot,
  identity: NutritionActionIdentity | null
): boolean {
  // Anonymous water alerts may have been scheduled before the account
  // identity became available. Keep them in the same device-day budget.
  return (
    sameScope(slot, identity) ||
    (slot.serverConfigId === null && slot.userId === null)
  );
}

async function readSlots(): Promise<PromptSlot[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (slot) =>
        slot &&
        typeof slot === 'object' &&
        (slot.serverConfigId === null ||
          typeof slot.serverConfigId === 'string') &&
        (slot.userId === null || typeof slot.userId === 'string') &&
        typeof slot.candidateId === 'string' &&
        typeof slot.at === 'number' &&
        Number.isFinite(slot.at) &&
        typeof slot.cancelled === 'boolean'
    )
  ) {
    throw new Error('Unreadable discretionary prompt ledger');
  }
  return parsed as PromptSlot[];
}

async function writeSlots(slots: PromptSlot[], now: number): Promise<void> {
  // Keep all future reservations, including those beyond the normal planning
  // horizon. Dropping one after granting it would permit an uncounted prompt.
  // Past attempts only need a short tail for local-day reconciliation.
  const retained = slots.filter((slot) => slot.at >= now - 48 * 60 * 60_000);
  await AsyncStorage.setItem(KEY, JSON.stringify(retained));
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A Settings preview must not turn a persisted reservation into a
      // scheduler failure after the write already succeeded.
    }
  });
}

/** Write ahead of the native schedule call. A failed write cannot send an uncounted prompt. */
export function reserveDiscretionaryPrompt(input: {
  identity: NutritionActionIdentity | null;
  candidateId: string;
  at: number;
  now?: number;
}): Promise<boolean> {
  return serialized(async () => {
    const now = input.now ?? Date.now();
    if (!Number.isFinite(input.at) || input.at <= now) return false;
    const slots = await readSlots();
    const day = toLocalDateString(new Date(input.at));
    if (
      slots.some(
        (slot) =>
          !slot.cancelled &&
          sameScope(slot, input.identity) &&
          slot.candidateId === input.candidateId &&
          slot.at === input.at
      )
    )
      return true;
    const allocated = slots.filter(
      (slot) =>
        !slot.cancelled &&
        countsForScope(slot, input.identity) &&
        toLocalDateString(new Date(slot.at)) === day
    ).length;
    if (allocated >= DAILY_CAP) return false;
    slots.push({
      serverConfigId: input.identity?.serverConfigId ?? null,
      userId: input.identity?.userId ?? null,
      candidateId: input.candidateId,
      at: input.at,
      cancelled: false,
    });
    await writeSlots(slots, now);
    return true;
  });
}

/** Release only a confirmed-cancelled request that was safely in the future. */
export function releaseFutureDiscretionaryPrompt(input: {
  identity: NutritionActionIdentity | null;
  candidateId: string;
  at: number;
  now?: number;
}): Promise<void> {
  return serialized(async () => {
    const now = input.now ?? Date.now();
    if (input.at <= now + FUTURE_RELEASE_MARGIN_MS) return;
    const slots = await readSlots();
    const slot = slots.find(
      (item) =>
        !item.cancelled &&
        sameScope(item, input.identity) &&
        item.candidateId === input.candidateId &&
        item.at === input.at
    );
    if (!slot) return;
    slot.cancelled = true;
    await writeSlots(slots, now);
  });
}

/** Past scheduled attempts stay spent even if the OS no longer lists them. */
export function getSpentDiscretionaryPromptCounts(
  identity: NutritionActionIdentity | null,
  now = Date.now()
): Promise<Record<string, number>> {
  return serialized(async () => {
    const counts: Record<string, number> = {};
    for (const slot of await readSlots()) {
      if (slot.cancelled || slot.at > now || !countsForScope(slot, identity))
        continue;
      const day = toLocalDateString(new Date(slot.at));
      counts[day] = (counts[day] ?? 0) + 1;
    }
    return counts;
  });
}

/** Settings preview: future reservations and earlier attempts both use today's slots. */
export function getTodayDiscretionaryPromptBudget(
  identity: NutritionActionIdentity | null,
  now = Date.now()
): Promise<{ used: number; remaining: number }> {
  return serialized(async () => {
    const today = toLocalDateString(new Date(now));
    const used = (await readSlots()).filter(
      (slot) =>
        !slot.cancelled &&
        countsForScope(slot, identity) &&
        toLocalDateString(new Date(slot.at)) === today
    ).length;
    return { used, remaining: Math.max(0, DAILY_CAP - used) };
  });
}

export function __resetDiscretionaryPromptLedgerForTests(): void {
  queue = Promise.resolve();
}
