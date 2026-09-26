import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { newUuid } from '../utils/ids';
import type { NutritionActionIdentity } from './nutritionActionOutbox';

const KEY = '@SparkyFitness/wellbeing-session/v1';
const schema = z.strictObject({
  version: z.literal(1),
  id: z.uuid(),
  mode: z.literal('movementBreak'),
  serverConfigId: z.string().min(1),
  userId: z.string().min(1),
  startedAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  activityId: z.string().nullable(),
  state: z.enum(['active', 'ended']),
});

export type WellbeingSession = z.infer<typeof schema>;
const listeners = new Set<() => void>();
let tail: Promise<void> = Promise.resolve();

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = tail.then(work, work);
  tail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export function subscribeWellbeingSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function read(): Promise<WellbeingSession | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    throw new Error('Stored wellbeing session is unreadable.');
  }
}

async function write(value: WellbeingSession): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(schema.parse(value)));
  listeners.forEach((listener) => listener());
}

export function getWellbeingSession(): Promise<WellbeingSession | null> {
  return serialized(read);
}

/** A session records a timer request, never a movement occurrence. */
export function startStoredMovementBreak(
  identity: NutritionActionIdentity,
  durationMinutes: number,
  now = new Date()
): Promise<WellbeingSession> {
  return serialized(async () => {
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 30
    ) {
      throw new Error('Movement break duration must be 1–30 minutes.');
    }
    const existing = await read();
    if (
      existing?.state === 'active' &&
      Date.parse(existing.endsAt) > now.getTime() &&
      existing.serverConfigId === identity.serverConfigId &&
      existing.userId === identity.userId
    ) {
      return existing;
    }
    const value = schema.parse({
      version: 1,
      id: newUuid(),
      mode: 'movementBreak',
      serverConfigId: identity.serverConfigId,
      userId: identity.userId,
      startedAt: now.toISOString(),
      endsAt: new Date(now.getTime() + durationMinutes * 60_000).toISOString(),
      activityId: null,
      state: 'active',
    });
    await write(value);
    return value;
  });
}

export function setWellbeingActivityId(
  sessionId: string,
  activityId: string
): Promise<void> {
  return serialized(async () => {
    const current = await read();
    if (current?.id !== sessionId || current.state !== 'active') return;
    await write({ ...current, activityId });
  });
}

export function endStoredWellbeingSession(sessionId: string): Promise<void> {
  return serialized(async () => {
    const current = await read();
    if (current?.id !== sessionId || current.state === 'ended') return;
    await write({ ...current, state: 'ended' });
  });
}
