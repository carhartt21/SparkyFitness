import { queryClient } from '../hooks/queryClient';
import { dailyProgressRootQueryKey } from '../hooks/queryKeys';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import {
  mobilityTimedStepSchema,
  mobilityRepetitionsStepSchema,
  mobilityStepSchema,
  mobilityRoutineSchema,
  mobilitySessionSchema,
  mobilityOperationSchema,
  mobilityOperationResultSchema,
  mobilityPlanRecordSchema,
  mobilitySnapshotSchema,
  type MobilityOperation,
} from '@workspace/shared';
import { apiFetch } from './api/apiClient';
import { ApiError } from './api/errors';
import { getActiveNutritionIdentity } from './nutritionIdentity';
import { newUuid } from '../utils/ids';
import type { NutritionActionIdentity } from './nutritionActionOutbox';

const PREFIX = '@SparkyFitness/mobility-routines/v1/';
const routineSchema = mobilityRoutineSchema;
const sessionSchema = mobilitySessionSchema;
const stateSchema = z.strictObject({
  version: z.literal(1),
  timezone: z.string().optional(),
  routines: z.array(routineSchema),
  activeSession: sessionSchema.nullable(),
  history: z.array(sessionSchema).max(100),
  imported: z.boolean().default(false),
  revisions: z.record(z.string(), z.number().int().nonnegative()).default({}),
  pendingOperations: z.array(mobilityOperationSchema).default([]),
  plans: z.array(mobilityPlanRecordSchema).default([]),
  conflicts: z
    .array(
      z.strictObject({
        operation: mobilityOperationSchema,
        remote: z.unknown(),
      })
    )
    .default([]),
  syncError: z.enum(['offline', 'conflict']).nullable().default(null),
});

export type MobilityStep = z.infer<typeof mobilityStepSchema>;
export type MobilityRoutine = z.infer<typeof routineSchema>;
export type MobilitySession = z.infer<typeof sessionSchema>;
export type MobilityState = z.infer<typeof stateSchema>;
export type MobilityStepDraft =
  | (Omit<z.infer<typeof mobilityTimedStepSchema>, 'id'> & { id?: string })
  | (Omit<z.infer<typeof mobilityRepetitionsStepSchema>, 'id'> & {
      id?: string;
    });

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
  return stateSchema.parse({
    version: 1,
    routines: [],
    activeSession: null,
    history: [],
  });
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
  value: MobilityState,
  synchronize = false,
  deletedSessions: MobilitySession[] = []
): Promise<MobilityState> {
  const validated = stateSchema.parse(value);
  if (!synchronize) {
    const before = await read(identity);
    const mutations: MobilityOperation['mutation'][] = [];
    for (const routine of validated.routines)
      if (
        JSON.stringify(routine) !==
        JSON.stringify(before.routines.find((item) => item.id === routine.id))
      )
        mutations.push({ kind: 'routine', data: routine, deleted: false });
    for (const routine of before.routines)
      if (!validated.routines.some((item) => item.id === routine.id))
        mutations.push({ kind: 'routine', data: routine, deleted: true });
    const previous = [
      ...(before.activeSession ? [before.activeSession] : []),
      ...before.history,
    ];
    const sessions = [
      ...(validated.activeSession ? [validated.activeSession] : []),
      ...validated.history,
    ];
    for (const session of sessions)
      if (
        JSON.stringify(session) !==
        JSON.stringify(previous.find((item) => item.id === session.id))
      )
        mutations.push({ kind: 'session', data: session, deleted: false });
    // Retention is local only. Deletions require an explicit user action.
    for (const session of deletedSessions)
      mutations.push({ kind: 'session', data: session, deleted: true });
    for (const mutation of mutations) {
      if (mutation.kind === 'result') continue;
      const key = `${mutation.kind}:${mutation.data.id}`;
      const expectedRevision = validated.revisions[key] ?? 0;
      validated.pendingOperations.push({
        operationId: newUuid(),
        expectedRevision,
        mutation,
      });
      validated.revisions[key] = expectedRevision + 1;
    }
  }
  await AsyncStorage.setItem(keyFor(identity), JSON.stringify(validated));
  listeners.forEach((listener) => listener());
  void queryClient.invalidateQueries({
    queryKey: ['mobility-diary', identity.serverConfigId, identity.userId],
  });
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
    await write(
      identity,
      {
        ...state,
        history: state.history.filter((session) => session.id !== sessionId),
      },
      false,
      state.history.filter((session) => session.id === sessionId)
    );
  });
}

export function startMobilitySession(
  identity: NutritionActionIdentity,
  routineId: string,
  now = new Date(),
  planId?: string
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
    const plan = planId
      ? state.plans.find(
          (record) => record.data.id === planId && !record.deleted
        )?.data
      : null;
    if (planId && (!plan || plan.state !== 'planned'))
      throw new Error('Planned session is no longer available.');
    const routine =
      plan?.routine ?? state.routines.find((item) => item.id === routineId);
    if (!routine) throw new Error('Routine no longer exists.');
    const session = sessionSchema.parse({
      id: newUuid(),
      routine,
      ...(planId ? { planId } : {}),
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

export function mobilityElapsedSeconds(
  session: MobilitySession,
  now: Date
): number {
  if (session.state !== 'running' || !session.phaseStartedAt) {
    return session.elapsedSeconds;
  }
  return (
    session.elapsedSeconds +
    Math.max(0, (now.getTime() - Date.parse(session.phaseStartedAt)) / 1000)
  );
}

/** Legacy routines used zero by default. Every next exercise gets setup time. */
export const MOBILITY_TRANSITION_SECONDS = 5;

/** Timer expiry only changes the displayed countdown; it never records movement. */
export function mobilitySecondsRemaining(
  session: MobilitySession,
  now = new Date()
): number | null {
  const step = session.routine.steps[session.stepIndex];
  if (!step) return null;
  const duration =
    session.phase === 'transition'
      ? Math.max(
          MOBILITY_TRANSITION_SECONDS,
          session.routine.steps[session.stepIndex - 1]?.transitionSeconds ?? 0
        )
      : step.kind === 'timed'
        ? step.durationSeconds
        : null;
  return duration == null
    ? null
    : Math.max(0, Math.ceil(duration - mobilityElapsedSeconds(session, now)));
}

export type MobilitySessionAction =
  | 'pause'
  | 'resume'
  | 'repeat'
  | 'complete-step'
  | 'skip-step'
  | 'continue'
  | 'continue-if-ready'
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
        elapsedSeconds: mobilityElapsedSeconds(current, now),
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
    } else if (action === 'continue' || action === 'continue-if-ready') {
      if (
        action === 'continue-if-ready' &&
        (current.phase !== 'transition' ||
          current.state !== 'running' ||
          mobilitySecondsRemaining(current, now) !== 0)
      )
        return current;
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
        phase: !isLast ? 'transition' : 'step',
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

/** Import and outbox live in the same serialized, account-scoped store as the runner. */
export function synchronizeMobility(
  identity: NutritionActionIdentity
): Promise<void> {
  return serialize(async () => {
    const current = await getActiveNutritionIdentity();
    if (
      !current ||
      current.serverConfigId !== identity.serverConfigId ||
      current.userId !== identity.userId
    )
      return;
    let state = await read(identity);
    if (!state.imported) {
      const mutations: MobilityOperation['mutation'][] = [
        ...state.routines.map((data) => ({
          kind: 'routine' as const,
          data,
          deleted: false,
        })),
        ...[
          ...(state.activeSession ? [state.activeSession] : []),
          ...state.history,
        ].map((data) => ({ kind: 'session' as const, data, deleted: false })),
      ];
      for (const mutation of mutations) {
        if (mutation.kind === 'result') continue;
        const key = `${mutation.kind}:${mutation.data.id}`;
        if (
          state.pendingOperations.some(
            (operation) =>
              operation.mutation.kind !== 'result' &&
              operation.mutation.kind === mutation.kind &&
              operation.mutation.data.id === mutation.data.id
          )
        )
          continue;
        state.pendingOperations.push({
          operationId: newUuid(),
          expectedRevision: 0,
          mutation,
        });
        state.revisions[key] = 1;
      }
      state.imported = true;
      await write(identity, state, true);
    }
    const assertIdentity = async () => {
      const current = await getActiveNutritionIdentity();
      if (
        current?.serverConfigId !== identity.serverConfigId ||
        current.userId !== identity.userId
      )
        throw new Error('The active account changed.');
    };
    try {
      for (const operation of [...state.pendingOperations]) {
        try {
          await assertIdentity();
          const result = mobilityOperationResultSchema.parse(
            await apiFetch({
              endpoint: '/api/v2/mobility',
              method: 'POST',
              body: operation,
              serviceName: 'Mobility',
              operation: 'sync routine or session',
            })
          );
          await assertIdentity();
          if (result.plan) {
            state.plans = state.plans.filter(
              (row) => row.data.id !== result.plan?.data.id
            );
            state.plans.push(result.plan);
            state.revisions[`plan:${result.plan.data.id}`] =
              result.plan.revision;
          }
        } catch (error) {
          if (error instanceof ApiError && error.statusCode === 409) {
            await assertIdentity();
            const remote = mobilitySnapshotSchema.parse(
              await apiFetch({
                endpoint: '/api/v2/mobility',
                serviceName: 'Mobility',
                operation: 'load conflict',
              })
            );
            state.conflicts.push({ operation, remote });
            state.syncError = 'conflict';
            await assertIdentity();
            state.pendingOperations = state.pendingOperations.filter(
              (item) => item.operationId !== operation.operationId
            );
            await write(identity, state, true);
            return;
          }
          throw error;
        }
        await assertIdentity();
        state.pendingOperations = state.pendingOperations.filter(
          (item) => item.operationId !== operation.operationId
        );
        await write(identity, state, true);
      }
      await assertIdentity();
      const snapshot = mobilitySnapshotSchema.parse(
        await apiFetch({
          endpoint: '/api/v2/mobility',
          serviceName: 'Mobility',
          operation: 'load planned sessions',
        })
      );
      const active = await getActiveNutritionIdentity();
      if (
        active?.serverConfigId !== identity.serverConfigId ||
        active.userId !== identity.userId
      )
        return;
      if (!state.conflicts.length) {
        state.routines = snapshot.routines
          .filter((row) => !row.deleted)
          .map((row) => row.data);
        // An active offline timer remains local; only historical server sessions merge.
        const remoteHistory = snapshot.sessions
          .filter(
            (row) =>
              !row.deleted && ['finished', 'cancelled'].includes(row.data.state)
          )
          .map((row) => row.data);
        state.history = remoteHistory
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .slice(0, 100);
        for (const [kind, rows] of [
          ['routine', snapshot.routines],
          ['session', snapshot.sessions],
        ] as const)
          for (const row of rows)
            state.revisions[`${kind}:${row.data.id}`] = row.revision;
      }
      state.timezone = snapshot.timezone;
      state.plans = snapshot.plans;
      state.syncError = state.conflicts.length ? 'conflict' : null;
      await write(identity, state, true);
      void queryClient.invalidateQueries({
        queryKey: dailyProgressRootQueryKey,
      });
    } catch (error) {
      state.syncError = state.conflicts.length ? 'conflict' : 'offline';
      await write(identity, state, true);
      throw error;
    }
  });
}
export function resolveMobilityConflict(
  identity: NutritionActionIdentity,
  operationId: string,
  choice: 'server' | 'copy'
): Promise<void> {
  return serialize(async () => {
    const state = await read(identity);
    const conflict = state.conflicts.find(
      (item) => item.operation.operationId === operationId
    );
    if (!conflict) return;
    if (choice === 'copy' && conflict.operation.mutation.kind === 'routine') {
      const routine = { ...conflict.operation.mutation.data, id: newUuid() };
      state.routines.push(routine);
      state.revisions[`routine:${routine.id}`] = 1;
      state.pendingOperations.push({
        operationId: newUuid(),
        expectedRevision: 0,
        mutation: { kind: 'routine', data: routine, deleted: false },
      });
    }
    if (conflict.operation.mutation.kind === 'session') {
      const session = conflict.operation.mutation.data;
      if (choice === 'copy') {
        const copy = { ...session, id: newUuid(), planId: null };
        if (state.activeSession?.id === session.id) state.activeSession = copy;
        state.history = state.history.map((item) =>
          item.id === session.id ? copy : item
        );
        state.revisions[`session:${copy.id}`] = 1;
        state.pendingOperations.push({
          operationId: newUuid(),
          expectedRevision: 0,
          mutation: { kind: 'session', data: copy, deleted: false },
        });
      } else if (state.activeSession?.id === session.id)
        state.activeSession = null;
    }
    // The rejected operation's dependent revisions cannot be replayed safely.
    const mutation = conflict.operation.mutation;
    state.pendingOperations = state.pendingOperations.filter(
      (item) =>
        item.mutation.kind !== mutation.kind ||
        mutation.kind === 'result' ||
        item.mutation.kind === 'result' ||
        item.mutation.data.id !== mutation.data.id
    );
    state.conflicts = state.conflicts.filter(
      (item) => item.operation.operationId !== operationId
    );
    await write(identity, state, true);
  });
}
