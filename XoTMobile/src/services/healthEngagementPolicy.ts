import {
  selectOptionalReminderSlots,
  localDateTimeToUtc,
  instantToDay,
  type MobilityPlanRecord,
} from '@workspace/shared';
import type { NutritionCapture } from './api/nutritionCaptureApi';
import type { PendingNutritionAction } from './nutritionActionOutbox';
import type { FoodEntry } from '../types/foodEntries';
import { toLocalDateString } from '../utils/dateUtils';
import type { MobilityRoutine, MobilitySession } from './mobilityRoutineStore';

export type EngagementDomain =
  'nutrition' | 'hydration' | 'movement' | 'tracking';

export interface ReminderCandidate {
  id: string;
  domain: EngagementDomain;
  kind:
    | 'capture'
    | 'review'
    | 'drink'
    | 'move'
    | 'mobility'
    | 'checkin'
    | 'habit'
    | 'measurement';
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

function localTime(day: string, time: string, timezone?: string): number {
  if (timezone)
    return localDateTimeToUtc(`${day}T${time.slice(0, 5)}`, timezone).getTime();
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, date, hour, minute).getTime();
}

export function nutritionReminderCandidates(input: {
  state: NutritionEngagementState;
  windows: MealWindow[];
  reviewTime: string | null;
  now: number;
  timezone?: string;
  /**
   * Default times (HH:MM) of meals the user explicitly marked complete or
   * "no meal" today. A window containing one is resolved.
   */
  resolvedMealTimes?: string[];
}): ReminderCandidate[] {
  const { state, now } = input;
  const captured = state.capturedAt
    .map((value) =>
      input.timezone && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)
        ? localDateTimeToUtc(value, input.timezone).getTime()
        : Date.parse(value)
    )
    .filter(Number.isFinite);
  const candidates: ReminderCandidate[] = [];
  for (const window of input.windows) {
    if (!window.enabled) continue;
    const start = localTime(state.day, window.start, input.timezone);
    const end = localTime(state.day, window.end, input.timezone);
    const preferredAt = localTime(state.day, window.prompt, input.timezone);
    if (!(start < end && start <= preferredAt && preferredAt < end)) continue;
    const resolvedByStatus = (input.resolvedMealTimes ?? []).some((time) => {
      if (!/^([01]\d|2[0-3]):[0-5]\d/.test(time)) return false;
      const at = localTime(state.day, time.slice(0, 5), input.timezone);
      return at >= start && at < end;
    });
    if (
      end <= now ||
      preferredAt <= now ||
      resolvedByStatus ||
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
    const at = localTime(state.day, input.reviewTime, input.timezone);
    if (at > now)
      candidates.push({
        id: `nutrition:review:${state.day}`,
        domain: 'nutrition',
        kind: 'review',
        preferredAt: at,
        earliestAt: at,
        expiresAt: localTime(state.day, '23:59', input.timezone),
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
  timezone?: string;
}): ReminderCandidate | null {
  if (!input.enabled || input.alreadyStartedToday || input.activeSession)
    return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return null;
  const at = localTime(input.day, input.time, input.timezone);
  if (at <= input.now) return null;
  return {
    id: `movement:break:${input.day}`,
    domain: 'movement',
    kind: 'move',
    preferredAt: at,
    earliestAt: at,
    expiresAt: Math.min(
      at + 60 * 60_000,
      localTime(input.day, '23:59', input.timezone)
    ),
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
  timezone?: string;
  plans?: MobilityPlanRecord[];
}): ReminderCandidate[] {
  if (input.activeSession) return [];
  if (input.plans)
    return input.plans
      .filter(
        (row) =>
          !row.deleted &&
          row.data.day === input.day &&
          row.data.state === 'planned'
      )
      .flatMap(({ data: plan }) => {
        const at = localTime(plan.day, plan.time, input.timezone);
        if (at <= input.now) return [];
        return [
          {
            id: `movement:mobility:${input.day}:${plan.id}`,
            domain: 'movement' as const,
            kind: 'mobility' as const,
            preferredAt: at,
            earliestAt: at,
            expiresAt: at + 20 * 60_000,
            flexibilityMinutes: 20,
          },
        ];
      });
  return input.routines.flatMap((routine) => {
    if (!routine.reminderTime) return [];
    const at = localTime(input.day, routine.reminderTime, input.timezone);
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
        expiresAt: Math.min(
          at + 60 * 60_000,
          localTime(input.day, '23:59', input.timezone)
        ),
        flexibilityMinutes: 30,
      },
    ];
  });
}

export interface TrackingReminderInput {
  timezone?: string;
  day: string;
  now: number;
  /** Null while the day's check-in state is unknown; unknown never prompts. */
  checkin: { enabled: boolean; time: string; resolved: boolean } | null;
  habits: { id: string; time: string; resolved: boolean }[];
  measurements: { key: string; time: string; resolved: boolean }[];
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Check-in, habit and measurement invitations for today. Each resolves as
 * soon as an explicit record exists (completed or skipped check-in, any saved
 * habit value, a saved measurement); opening a reminder records nothing.
 */
export function trackingReminderCandidates(
  input: TrackingReminderInput
): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = [];
  const add = (
    id: string,
    kind: 'checkin' | 'habit' | 'measurement',
    time: string
  ) => {
    const clock = time.slice(0, 5);
    if (!CLOCK.test(clock)) return;
    const at = localTime(input.day, clock, input.timezone);
    if (at <= input.now) return;
    candidates.push({
      id,
      domain: 'tracking',
      kind,
      preferredAt: at,
      earliestAt: at,
      expiresAt: Math.min(
        at + 2 * 60 * 60_000,
        localTime(input.day, '23:59', input.timezone)
      ),
      flexibilityMinutes: 30,
    });
  };
  if (input.checkin?.enabled && !input.checkin.resolved) {
    add(`tracking:checkin:${input.day}`, 'checkin', input.checkin.time);
  }
  for (const habit of input.habits) {
    if (!habit.resolved) {
      add(`tracking:habit:${input.day}:${habit.id}`, 'habit', habit.time);
    }
  }
  for (const measurement of input.measurements) {
    if (!measurement.resolved) {
      add(
        `tracking:measurement:${input.day}:${measurement.key}`,
        'measurement',
        measurement.time
      );
    }
  }
  return candidates;
}

/** Discretionary cap and collision policy. Scheduled intakes never enter here. */
export function arbitrateDiscretionaryCandidates(input: {
  candidates: ReminderCandidate[];
  dailyCap: number | null;
  timezone?: string;
  quietStart?: string;
  quietEnd?: string;
  domainCaps: Partial<Record<EngagementDomain, number>>;
  collisionMinutes: number;
  reservedTimes: number[];
  now: number;
}): ReminderCandidate[] {
  const cap =
    input.dailyCap === null ? null : Math.max(0, Math.floor(input.dailyCap));
  const counts: Partial<Record<EngagementDomain, number>> = {};
  const eligible = [...input.candidates]
    .sort((a, b) => a.preferredAt - b.preferredAt || a.id.localeCompare(b.id))
    .filter((candidate) => {
      const count = counts[candidate.domain] ?? 0;
      const domainCap = input.domainCaps[candidate.domain];
      if (domainCap !== undefined && count >= domainCap) return false;
      counts[candidate.domain] = count + 1;
      return true;
    });
  return selectOptionalReminderSlots({
    candidates: eligible,
    now: input.now + 1000,
    dailyLimit: cap,
    occupied: input.reservedTimes,
    timezone:
      input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    quietStart: input.quietStart ?? '00:00',
    quietEnd: input.quietEnd ?? '00:00',
    spacingMinutes: input.collisionMinutes,
  });
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
  dailyLimit?: number | null;
  timezone?: string;
  quietStart?: string;
  quietEnd?: string;
}): Date[] {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.windowEnd)) return [];
  const byDay = new Map<string, Date[]>();
  for (const time of input.times) {
    const at = time.getTime();
    if (!Number.isFinite(at) || at <= input.now) continue;
    const day = input.timezone
      ? instantToDay(time, input.timezone)
      : toLocalDateString(time);
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
    end.setTime(
      localTime(
        day,
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        input.timezone
      )
    );
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
      dailyCap:
        input.dailyLimit === null
          ? null
          : Math.max(
              0,
              (input.dailyLimit ?? 3) -
                (input.spentByDay?.[day] ?? 0) -
                reserved.length
            ),
      domainCaps: {},
      timezone: input.timezone,
      quietStart: input.quietStart,
      quietEnd: input.quietEnd,
      collisionMinutes: 20,
      reservedTimes: [
        ...reserved.map((candidate) => candidate.preferredAt),
        ...(input.reservedTimes ?? []).filter(
          (time) =>
            (input.timezone
              ? instantToDay(new Date(time), input.timezone)
              : toLocalDateString(new Date(time))) === day
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
