import {
  instantHourMinute,
  instantToDay,
  localDateTimeToUtc,
  type EngagementSettings,
} from '@workspace/shared';

export type ReminderKind =
  'hydration' | 'meal_capture' | 'meal_review' | 'movement_break' | 'mobility';

export interface ReminderCandidate {
  kind: ReminderKind;
  localDay: string;
  scheduledAt: Date;
}

interface ReminderContext {
  foodCount: number;
  waterCount: number;
  exerciseCount: number;
  pendingPhotoCount: number;
  /** A user-declared context period paused optional reminders today. */
  remindersPaused?: boolean;
}

const SCHEDULE: ReadonlyArray<{ kind: ReminderKind; at: string }> = [
  { kind: 'hydration', at: '11:00' },
  { kind: 'meal_capture', at: '13:00' },
  { kind: 'movement_break', at: '15:00' },
  { kind: 'mobility', at: '18:00' },
  { kind: 'meal_review', at: '20:00' },
];

function isQuiet(time: string, start: string, end: string): boolean {
  if (start === end) return false;
  return start < end
    ? time >= start && time < end
    : time >= start || time < end;
}

/** Move a requested snooze out of quiet hours in the account's timezone. */
export function nextAllowedEngagementTime(
  requested: Date,
  timezone: string,
  settings: Pick<EngagementSettings, 'quiet_start' | 'quiet_end'>
): Date {
  let at = requested;
  for (let minute = 0; minute < 26 * 60; minute += 1) {
    const clock = instantHourMinute(at, timezone);
    const localTime = `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
    if (!isQuiet(localTime, settings.quiet_start, settings.quiet_end))
      return at;
    at = new Date(at.getTime() + 60_000);
  }
  throw new Error('Could not find an available notification window.');
}

/** Deterministic account-local candidates. Unknown data suppresses, never proves a gap. */
export function dueEngagementCandidates(input: {
  now: Date;
  timezone: string;
  settings: EngagementSettings;
  context: ReminderContext;
}): ReminderCandidate[] {
  const { now, timezone, settings, context } = input;
  if (!settings.remote_enabled) return [];
  // Every remote kind is discretionary; scheduled intakes are never remote.
  if (context.remindersPaused) return [];
  const localDay = instantToDay(now, timezone);
  const clock = instantHourMinute(now, timezone);
  const localTime = `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
  const candidates: ReminderCandidate[] = [];
  for (const { kind, at } of SCHEDULE) {
    if (at > localTime || isQuiet(at, settings.quiet_start, settings.quiet_end))
      continue;
    const scheduledAt = localDateTimeToUtc(`${localDay}T${at}`, timezone);
    // Missed discretionary windows expire rather than arriving hours late.
    if (now.getTime() - scheduledAt.getTime() > 20 * 60_000) continue;
    const enabled = settings[`${kind}_enabled`];
    if (!enabled) continue;
    if (kind === 'hydration' && context.waterCount !== 0) continue;
    if (kind === 'meal_capture' && context.foodCount !== 0) continue;
    if (kind === 'movement_break' && context.exerciseCount !== 0) continue;
    if (kind === 'mobility' && context.exerciseCount !== 0) continue;
    if (kind === 'meal_review' && context.pendingPhotoCount === 0) continue;
    candidates.push({ kind, localDay, scheduledAt });
  }
  return candidates;
}

/** Shared cap and spacing for discretionary remote reminders. */
export function mayReserveEngagementCandidate(
  candidate: ReminderCandidate,
  existing: ReadonlyArray<{ scheduledAt: Date; status: string }>,
  dailyLimit: number | null = 3
): boolean {
  const active = existing.filter(
    (item) => item.status !== 'skipped' && item.status !== 'cancelled'
  );
  if (dailyLimit !== null && active.length >= dailyLimit) return false;
  return active.every(
    (item) =>
      Math.abs(item.scheduledAt.getTime() - candidate.scheduledAt.getTime()) >=
      20 * 60_000
  );
}
