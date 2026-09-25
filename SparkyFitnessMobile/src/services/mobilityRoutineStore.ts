import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { newUuid } from '../utils/ids';
import type { NutritionActionIdentity } from './nutritionActionOutbox';

const PREFIX = '@SparkyFitness/mobility-routines/v1/';
const timestamp = z.iso.datetime({ offset: true });
const timedStep = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(500),
  side: z.enum(['both', 'left', 'right']),
  kind: z.literal('timed'),
  durationSeconds: z.number().int().min(5).max(3600),
  transitionSeconds: z.number().int().min(0).max(600),
});
const repetitionsStep = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(500),
  side: z.enum(['both', 'left', 'right']),
  kind: z.literal('repetitions'),
  repetitions: z.number().int().min(1).max(1000),
  transitionSeconds: z.number().int().min(0).max(600),
});
const stepSchema = z.discriminatedUnion('kind', [timedStep, repetitionsStep]);
const routineSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  steps: z.array(stepSchema).min(1).max(40),
  cue: z.enum(['off', 'haptic', 'sound', 'both']),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
const outcomeSchema = z.strictObject({
  stepId: z.uuid(),
  result: z.enum(['completed', 'skipped']),
  recordedAt: timestamp,
});
const sessionSchema = z.strictObject({
  id: z.uuid(),
  routine: routineSchema,
  state: z.enum(['running', 'paused', 'finished', 'cancelled']),
  phase: z.enum(['step', 'transition']),
  stepIndex: z.number().int().min(0),
  phaseStartedAt: timestamp.nullable(),
  elapsedSeconds: z.number().min(0),
  outcomes: z.array(outcomeSchema),
  startedAt: timestamp,
  endedAt: timestamp.nullable(),
});
const stateSchema = z.strictObject({
  version: z.literal(1),
  routines: z.array(routineSchema),
  activeSession: sessionSchema.nullable(),
  history: z.array(sessionSchema).max(100),
});

export type MobilityStep = z.infer<typeof stepSchema>;
export type MobilityRoutine = z.infer<typeof routineSchema>;
export type MobilitySession = z.infer<typeof sessionSchema>;
export type MobilityState = z.infer<typeof stateSchema>;
export type MobilityStepDraft =
  | (Omit<z.infer<typeof timedStep>, 'id'> & { id?: string })
  | (Omit<z.infer<typeof repetitionsStep>, 'id'> & { id?: string });

const listeners = new Set<() => void>();
let tail: Promise<void> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = tail.then(work, work);
  tail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function keyFor(identity: NutritionActionIdentity): string {
  if (!identity.serverConfigId || !identity.userId) {
    throw new Error('A verified account is required for mobility routines.');
  }
  return `${PREFIX}${encodeURIComponent(identity.serverConfigId)}/${encodeURIComponent(identity.userId)}`;
}

function emptyState(): MobilityState {
  return { version: 1, routines: [], activeSession: null, history: [] };
}

async function read(identity: NutritionActionIdentity): Promise<MobilityState> {
  const raw = await AsyncStorage.getItem(keyFor(identity));
  if (!raw) return emptyState();
  try {
    return stateSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error('Saved mobility routines are unreadable.');
  }
}

async function write(
  identity: NutritionActionIdentity,
  value: MobilityState
): Promise<MobilityState> {
  const validated = stateSchema.parse(value);
  await AsyncStorage.setItem(keyFor(identity), JSON.stringify(validated));
  listeners.forEach((listener) => listener());
  return validated;
}

export function subscribeMobilityState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMobilityState(
  identity: NutritionActionIdentity
): Promise<MobilityState> {
  return serialize(() => read(identity));
}

export function saveMobilityRoutine(
  identity: NutritionActionIdentity,
  draft: {
    id?: string;
    name: string;
    steps: MobilityStepDraft[];
    cue: MobilityRoutine['cue'];
    reminderTime?: string | null;
  },
  now = new Date()
): Promise<MobilityRoutine> {
  return serialize(async () => {
    const state = await read(identity);
    const existing = state.routines.find((routine) => routine.id === draft.id);
    if (draft.id && !existing) throw new Error('Routine no longer exists.');
    const routine = routineSchema.parse({
      id: existing?.id ?? newUuid(),
      name: draft.name,
      steps: draft.steps.map((step) => ({
        ...step,
        id: step.id ?? newUuid(),
      })),
      cue: draft.cue,
      reminderTime: draft.reminderTime ?? null,
      createdAt: existing?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    });
    if (
      new Set(routine.steps.map((step) => step.id)).size !==
      routine.steps.length
    ) {
      throw new Error('Routine steps must have unique IDs.');
    }
    const routines = existing
      ? state.routines.map((item) => (item.id === routine.id ? routine : item))
      : [...state.routines, routine];
    await write(identity, { ...state, routines });
    return routine;
  });
}

export function deleteMobilityRoutine(
  identity: NutritionActionIdentity,
  routineId: string
): Promise<void> {
  return serialize(async () => {
    const state = await read(identity);
    await write(identity, {
      ...state,
      routines: state.routines.filter((routine) => routine.id !== routineId),
    });
  });
}

export function deleteMobilitySessionHistory(
  identity: NutritionActionIdentity,
  sessionId: string
): Promise<void> {
  return serialize(async () => {
    const state = await read(identity);
    if (!state.history.some((session) => session.id === sessionId)) return;
    await write(identity, {
      ...state,
      history: state.history.filter((session) => session.id !== sessionId),
    });
  });
}

export function startMobilitySession(
  identity: NutritionActionIdentity,
  routineId: string,
  now = new Date()
): Promise<MobilitySession> {
  return serialize(async () => {
    const state = await read(identity);
    if (
      state.activeSession &&
      (state.activeSession.state === 'running' ||
        state.activeSession.state === 'paused')
    ) {
      if (state.activeSession.routine.id === routineId)
        return state.activeSession;
      throw new Error('Finish or cancel the current routine first.');
    }
    const routine = state.routines.find((item) => item.id === routineId);
    if (!routine) throw new Error('Routine no longer exists.');
    const session = sessionSchema.parse({
      id: newUuid(),
      routine,
      state: 'running',
      phase: 'step',
      stepIndex: 0,
      phaseStartedAt: now.toISOString(),
      elapsedSeconds: 0,
      outcomes: [],
      startedAt: now.toISOString(),
      endedAt: null,
    });
    await write(identity, { ...state, activeSession: session });
    return session;
  });
}

function elapsed(session: MobilitySession, now: Date): number {
  if (session.state !== 'running' || !session.phaseStartedAt) {
    return session.elapsedSeconds;
  }
  return (
    session.elapsedSeconds +
    Math.max(0, (now.getTime() - Date.parse(session.phaseStartedAt)) / 1000)
  );
}

/** Timer expiry only changes the displayed countdown; it never records movement. */
export function mobilitySecondsRemaining(
  session: MobilitySession,
  now = new Date()
): number | null {
  const step = session.routine.steps[session.stepIndex];
  if (!step) return null;
  const duration =
    session.phase === 'transition'
      ? session.routine.steps[session.stepIndex - 1]?.transitionSeconds
      : step.kind === 'timed'
        ? step.durationSeconds
        : null;
  return duration == null
    ? null
    : Math.max(0, Math.ceil(duration - elapsed(session, now)));
}

export type MobilitySessionAction =
  | 'pause'
  | 'resume'
  | 'repeat'
  | 'complete-step'
  | 'skip-step'
  | 'continue'
  | 'cancel';

export function applyMobilitySessionAction(
  identity: NutritionActionIdentity,
  sessionId: string,
  action: MobilitySessionAction,
  now = new Date()
): Promise<MobilitySession> {
  return serialize(async () => {
    const state = await read(identity);
    const current = state.activeSession;
    if (!current || current.id !== sessionId) {
      throw new Error('Mobility session no longer exists.');
    }
    if (current.state === 'finished' || current.state === 'cancelled') {
      return current;
    }
    let next: MobilitySession;
    if (action === 'pause') {
      if (current.state === 'paused') return current;
      next = {
        ...current,
        state: 'paused',
        elapsedSeconds: elapsed(current, now),
        phaseStartedAt: null,
      };
    } else if (action === 'resume') {
      if (current.state === 'running') return current;
      next = {
        ...current,
        state: 'running',
        phaseStartedAt: now.toISOString(),
      };
    } else if (action === 'cancel') {
      next = {
        ...current,
        state: 'cancelled',
        phaseStartedAt: null,
        endedAt: now.toISOString(),
      };
    } else if (action === 'repeat') {
      if (current.phase !== 'step')
        throw new Error('Continue the transition first.');
      next = {
        ...current,
        elapsedSeconds: 0,
        phaseStartedAt: current.state === 'running' ? now.toISOString() : null,
      };
    } else if (action === 'continue') {
      if (current.phase !== 'transition') {
        throw new Error('No transition is active.');
      }
      next = {
        ...current,
        phase: 'step',
        elapsedSeconds: 0,
        phaseStartedAt: current.state === 'running' ? now.toISOString() : null,
      };
    } else {
      if (current.phase !== 'step')
        throw new Error('Continue the transition first.');
      const step = current.routine.steps[current.stepIndex];
      if (!step) throw new Error('Routine step no longer exists.');
      const outcome = {
        stepId: step.id,
        result: action === 'complete-step' ? 'completed' : 'skipped',
        recordedAt: now.toISOString(),
      } as const;
      const isLast = current.stepIndex + 1 === current.routine.steps.length;
      next = {
        ...current,
        outcomes: [...current.outcomes, outcome],
        stepIndex: isLast ? current.stepIndex : current.stepIndex + 1,
        phase: !isLast && step.transitionSeconds > 0 ? 'transition' : 'step',
        state: isLast ? 'finished' : current.state,
        elapsedSeconds: 0,
        phaseStartedAt:
          isLast || current.state === 'paused' ? null : now.toISOString(),
        endedAt: isLast ? now.toISOString() : null,
      };
    }
    const validated = sessionSchema.parse(next);
    const finished =
      validated.state === 'finished' || validated.state === 'cancelled';
    await write(identity, {
      ...state,
      activeSession: finished ? null : validated,
      history: finished
        ? [validated, ...state.history].slice(0, 100)
        : state.history,
    });
    return validated;
  });
}
