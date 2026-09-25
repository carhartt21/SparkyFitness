import type { NutritionCapture } from './api/nutritionCaptureApi';
import type { PendingNutritionAction } from './nutritionActionOutbox';
import type { FoodEntry } from '../types/foodEntries';
import { toLocalDateString } from '../utils/dateUtils';
import type { MobilityRoutine, MobilitySession } from './mobilityRoutineStore';

export type EngagementDomain = 'nutrition' | 'hydration' | 'movement';

export interface ReminderCandidate {
  id: string;
  domain: EngagementDomain;
  kind: 'capture' | 'review' | 'drink' | 'move' | 'mobility';
  preferredAt: number;
  earliestAt: number;
  expiresAt: number;
  /** A discretionary candidate may move only within this interval. */
  flexibilityMinutes: number;
}

export interface NutritionEngagementState {
  day: string;
  capturedCount: number;
  incompleteCount: number;
  pendingSyncCount: number;
  remoteKnown: boolean;
  /** Null means a reliable calorie total is unavailable, never zero. */
  knownCalories: number | null;
  capturedAt: string[];
  generatedAt: number;
}

export interface NutritionStateInput {
  day: string;
  remoteEntries: FoodEntry[] | null;
  remoteCaptures: NutritionCapture[] | null;
  localActions: PendingNutritionAction[];
  knownRemoteCalories: number | null;
  now: number;
}

/** Merge by stable capture/operation ID; a synced local action is not a new meal. */
export function deriveNutritionEngagementState(
  input: NutritionStateInput
): NutritionEngagementState {
  const events = new Map<
    string,
    { at: string; incomplete: boolean; pending: boolean }
  >();
  const foodOperationIds = new Set<string>();
  for (const entry of input.remoteEntries ?? []) {
    if (entry.entry_date !== input.day) continue;
    const id =
      entry.nutrition_capture_id ??
      entry.food_entry_meal_id ??
      entry.client_operation_id ??
      entry.id;
    events.set(id, {
      // A missing time cannot safely be placed in a meal window.
      at: entry.entry_time ? `${entry.entry_date}T${entry.entry_time}` : '',
      incomplete: false,
      pending: false,
    });
    if (entry.client_operation_id)
      foodOperationIds.add(entry.client_operation_id);
  }
  for (const capture of input.remoteCaptures ?? []) {
    if (capture.entry_date !== input.day) continue;
    const previous = events.get(capture.id);
    events.set(capture.id, {
      at: capture.consumed_at,
      incomplete: previous ? false : capture.completion_state === 'incomplete',
      pending: false,
    });
  }
  let pendingCalories = 0;
  for (const action of input.localActions) {
    if (action.type === 'logFoodEntry') {
      if (action.payload.entry_date !== input.day) continue;
      if (foodOperationIds.has(action.clientOperationId)) continue;
      events.set(action.clientOperationId, {
        at: action.occurredAt,
        incomplete: false,
        pending: action.syncState !== 'synced',
      });
      if (
        action.payload.serving_size &&
        action.payload.calories !== undefined
      ) {
        pendingCalories +=
          (action.payload.calories * action.payload.quantity) /
          action.payload.serving_size;
      }
    } else if (action.type === 'createPhotoEntry') {
      if (action.payload.entryDate !== input.day) continue;
      const previous = events.get(action.payload.id);
      events.set(action.payload.id, {
        at: action.payload.consumedAt,
        incomplete: previous?.incomplete ?? true,
        pending: action.syncState !== 'synced',
      });
    } else if (
      action.type === 'completePhotoEntry' &&
      action.payload.entryDate === input.day
    ) {
      const previous = events.get(action.payload.captureId);
      if (previous)
        events.set(action.payload.captureId, {
          ...previous,
          incomplete: false,
          pending: previous.pending || action.syncState !== 'synced',
        });
      if (
        !input.remoteEntries?.some(
          (entry) =>
            entry.nutrition_capture_id === action.payload.captureId ||
            entry.client_operation_id === action.clientOperationId
        )
      ) {
        pendingCalories +=
          (action.payload.food.calories * action.payload.food.quantity) /
          action.payload.food.serving_size;
      }
    }
  }
  const values = [...events.values()];
  return {
    day: input.day,
    capturedCount: values.length,
    incompleteCount: values.filter((event) => event.incomplete).length,
    pendingSyncCount: values.filter((event) => event.pending).length,
    remoteKnown: input.remoteEntries !== null && input.remoteCaptures !== null,
    knownCalories:
      input.knownRemoteCalories === null
        ? null
        : input.knownRemoteCalories + pendingCalories,
    capturedAt: values.map((event) => event.at),
    generatedAt: input.now,
  };
}

export interface MealWindow {
  id: string;
  start: string;
  end: string;
  prompt: string;
  enabled: boolean;
}

function localTime(day: string, time: string): number {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, date, hour, minute).getTime();
}

export function nutritionReminderCandidates(input: {
  state: NutritionEngagementState;
  windows: MealWindow[];
  reviewTime: string | null;
  now: number;
}): ReminderCandidate[] {
  const { state, now } = input;
  const captured = state.capturedAt
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  const candidates: ReminderCandidate[] = [];
  for (const window of input.windows) {
    if (!window.enabled) continue;
    const start = localTime(state.day, window.start);
    const end = localTime(state.day, window.end);
    const preferredAt = localTime(state.day, window.prompt);
    if (!(start < end && start <= preferredAt && preferredAt < end)) continue;
    if (
      end <= now ||
      preferredAt <= now ||
      captured.some((at) => at >= start && at < end)
    )
      continue;
    candidates.push({
      id: `nutrition:capture:${state.day}:${window.id}`,
      domain: 'nutrition',
      kind: 'capture',
      preferredAt,
      earliestAt: preferredAt,
      expiresAt: end,
      flexibilityMinutes: 30,
    });
  }
  if (input.reviewTime && state.incompleteCount > 0) {
    const at = localTime(state.day, input.reviewTime);
    if (at > now)
      candidates.push({
        id: `nutrition:review:${state.day}`,
        domain: 'nutrition',
        kind: 'review',
        preferredAt: at,
        earliestAt: at,
        expiresAt: localTime(state.day, '23:59'),
        flexibilityMinutes: 30,
      });
  }
  return candidates;
}

/** A chosen clock time is an invitation, not evidence of missing movement. */
export function movementBreakReminderCandidate(input: {
  day: string;
  time: string;
  enabled: boolean;
  alreadyStartedToday: boolean;
  activeSession: boolean;
  now: number;
}): ReminderCandidate | null {
  if (!input.enabled || input.alreadyStartedToday || input.activeSession)
    return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return null;
  const at = localTime(input.day, input.time);
  if (at <= input.now) return null;
  return {
    id: `movement:break:${input.day}`,
    domain: 'movement',
    kind: 'move',
    preferredAt: at,
    earliestAt: at,
    expiresAt: Math.min(at + 60 * 60_000, localTime(input.day, '23:59')),
    flexibilityMinutes: 30,
  };
}

/** A routine time is an invitation, not evidence that movement was done. */
export function mobilityReminderCandidates(input: {
  day: string;
  routines: MobilityRoutine[];
  activeSession: MobilitySession | null;
  history: MobilitySession[];
  now: number;
}): ReminderCandidate[] {
  if (input.activeSession) return [];
  return input.routines.flatMap((routine) => {
    if (!routine.reminderTime) return [];
    const at = localTime(input.day, routine.reminderTime);
    if (at <= input.now) return [];
    if (
      input.history.some(
        (session) =>
          session.routine.id === routine.id &&
          toLocalDateString(session.startedAt) === input.day
      )
    )
      return [];
    return [
      {
        id: `movement:mobility:${input.day}:${routine.id}`,
        domain: 'movement' as const,
        kind: 'mobility' as const,
        preferredAt: at,
        earliestAt: at,
        expiresAt: Math.min(at + 60 * 60_000, localTime(input.day, '23:59')),
        flexibilityMinutes: 30,
      },
    ];
  });
}

/** Discretionary cap and collision policy. Scheduled intakes never enter here. */
export function arbitrateDiscretionaryCandidates(input: {
  candidates: ReminderCandidate[];
  dailyCap: number;
  domainCaps: Partial<Record<EngagementDomain, number>>;
  collisionMinutes: number;
  reservedTimes: number[];
  now: number;
}): ReminderCandidate[] {
  const accepted: ReminderCandidate[] = [];
  const counts: Partial<Record<EngagementDomain, number>> = {};
  const cap = Math.max(0, Math.floor(input.dailyCap));
  const spacing = Math.max(0, input.collisionMinutes) * 60_000;
  for (const candidate of [...input.candidates].sort(
    (a, b) => a.preferredAt - b.preferredAt || a.id.localeCompare(b.id)
  )) {
    if (accepted.length >= cap) break;
    if (candidate.expiresAt <= input.now) continue;
    const domainCount = counts[candidate.domain] ?? 0;
    if (domainCount >= (input.domainCaps[candidate.domain] ?? cap)) continue;
    let time = Math.max(
      candidate.preferredAt,
      candidate.earliestAt,
      input.now + 1_000
    );
    const latest = Math.min(
      candidate.expiresAt,
      candidate.preferredAt + candidate.flexibilityMinutes * 60_000
    );
    const occupied = [
      ...input.reservedTimes,
      ...accepted.map((item) => item.preferredAt),
    ].sort((a, b) => a - b);
    for (const reserved of occupied) {
      if (Math.abs(time - reserved) < spacing) time = reserved + spacing;
    }
    if (time > latest) continue;
    accepted.push({ ...candidate, preferredAt: time });
    counts[candidate.domain] = domainCount + 1;
  }
  return accepted;
}

/** Give hydration the remaining daily slots after meal and movement prompts. */
export function selectHydrationReminderSchedule(input: {
  times: Date[];
  sharedPlan: ReminderCandidate[];
  reservedTimes?: number[];
  spentByDay?: Record<string, number>;
  now: number;
  windowEnd: string;
  maxScheduled: number;
}): Date[] {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.windowEnd)) return [];
  const byDay = new Map<string, Date[]>();
  for (const time of input.times) {
    const at = time.getTime();
    if (!Number.isFinite(at) || at <= input.now) continue;
    const day = toLocalDateString(time);
    const entries = byDay.get(day) ?? [];
    entries.push(time);
    byDay.set(day, entries);
  }
  const selected: Date[] = [];
  for (const [day, times] of byDay) {
    const reserved = input.sharedPlan.filter(
      (candidate) => toLocalDateString(new Date(candidate.preferredAt)) === day
    );
    const end = new Date(times[0]);
    const [hour, minute] = input.windowEnd.split(':').map(Number);
    end.setHours(hour, minute, 0, 0);
    const candidates: ReminderCandidate[] = times.map((time) => {
      const at = time.getTime();
      return {
        id: `hydration:drink:${day}:${at}`,
        domain: 'hydration',
        kind: 'drink',
        preferredAt: at,
        earliestAt: at,
        expiresAt: Math.min(at + 20 * 60_000, end.getTime() - 1_000),
        flexibilityMinutes: 20,
      };
    });
    const accepted = arbitrateDiscretionaryCandidates({
      candidates,
      dailyCap: Math.max(
        0,
        3 - (input.spentByDay?.[day] ?? 0) - reserved.length
      ),
      domainCaps: { hydration: 3 },
      collisionMinutes: 20,
      reservedTimes: [
        ...reserved.map((candidate) => candidate.preferredAt),
        ...(input.reservedTimes ?? []).filter(
          (time) => toLocalDateString(new Date(time)) === day
        ),
      ],
      now: input.now,
    });
    selected.push(
      ...accepted.map((candidate) => new Date(candidate.preferredAt))
    );
    if (selected.length >= input.maxScheduled) break;
  }
  return selected.slice(0, input.maxScheduled);
}
