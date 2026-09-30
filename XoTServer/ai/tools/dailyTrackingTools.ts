import { tool } from 'ai';
import { z } from 'zod';
import {
  activeContextPeriods,
  daysBetween,
  DAILY_CHECKIN_QUESTION_VERSION,
  DAILY_CHECKIN_QUESTIONS_V1,
  discretionaryRemindersPaused,
  isMeasurementReminderDue,
  todayInZone,
} from '@workspace/shared';
import { log } from '../../config/logging.js';
import {
  getDailyCheckin,
  listDailyCheckins,
  listHabitLogs,
  listHabits,
  listHealthContextPeriods,
  listMeasurementReminders,
  recordedMeasurementsOn,
} from '../../models/dailyTrackingRepository.js';
import medicationRepository from '../../models/medicationRepository.js';
import medicationEntryRepository from '../../models/medicationEntryRepository.js';
import {
  getDailyProgress,
  getMealTrackingStatus,
  getSupplementDoses,
} from '../../services/dailyProgressService.js';
import { normalizeDayKeywords } from './dates.js';
import { ERRORS, formatZodError, toolError } from './errors.js';
import { dayString, formatJsonResult } from './formatting.js';
import {
  dateSchema,
  optionalDateSchema,
  uuidSchema,
} from './schemas/common.js';

/** Longest history any of these tools reads in one call. */
export const TRACKING_TOOL_MAX_DAYS = 92;

/**
 * Pure-read tools for the daily tracking domains. None of them writes: logging
 * habits, completing check-ins, changing context, recording measurements or
 * supplement intake, and meal resolution happen only in the apps. Each tool is
 * safe to publish on a read-only MCP key (see READ_ONLY_MCP_TOOL_NAMES).
 */
export const DAILY_TRACKING_READ_TOOL_NAMES = [
  'sparky_get_daily_checkin',
  'sparky_list_daily_checkins',
  'sparky_list_health_context_periods',
  'sparky_list_habits',
  'sparky_get_habit_history',
  'sparky_get_measurement_reminder_status',
  'sparky_get_meal_tracking_status',
  'sparky_get_daily_progress',
  'sparky_get_daily_status_context',
] as const;

export const SUPPLEMENT_READ_TOOL_NAMES = [
  'sparky_list_supplements',
  'sparky_get_supplement',
  'sparky_list_supplement_entries',
] as const;

const dayInput = z.object({ date: optionalDateSchema }).strict();
const rangeInput = z
  .object({
    start_date: dateSchema.describe('Range start (YYYY-MM-DD)'),
    end_date: dateSchema.describe('Range end (YYYY-MM-DD), inclusive'),
  })
  .strict();

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseArgs<T>(
  schema: z.ZodType<T>,
  rawArgs: unknown,
  tz: string
): Parsed<T> {
  const parsed = schema.safeParse(normalizeDayKeywords(rawArgs ?? {}, tz));
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: formatZodError(parsed.error) };
}

function checkRange(start: string, end: string): string | null {
  if (end < start) {
    return toolError(
      'INVALID_RANGE',
      'end_date must not be before start_date.'
    );
  }
  if (daysBetween(start, end) + 1 > TRACKING_TOOL_MAX_DAYS) {
    return toolError(
      'INVALID_RANGE',
      `Ranges cover at most ${TRACKING_TOOL_MAX_DAYS} days.`
    );
  }
  return null;
}

async function run(name: string, task: () => Promise<unknown>) {
  try {
    const result = await task();
    return typeof result === 'string' ? result : formatJsonResult(result);
  } catch (error) {
    log('error', `[${name}] Error:`, error);
    return ERRORS.DB_ERROR(error);
  }
}

const MISSING_DAYS_NOTE =
  'Days without a record are omitted; a missing day means not recorded, never zero or failure.';

export function buildDailyTrackingTools(userId: string, tz: string) {
  const today = () => todayInZone(tz);

  return {
    sparky_get_daily_checkin: tool({
      description:
        'Read the daily check-in for one day (defaults to today): state (draft, completed, skipped), overall day and 1–5 answers with their versioned meanings, note and tags. Read-only.',
      inputSchema: dayInput,
      execute: async (rawArgs) => {
        const args = parseArgs(dayInput, rawArgs, tz);
        if (!args.ok) return args.error;
        const date = args.value.date ?? today();
        return run('sparky_get_daily_checkin', async () => ({
          date,
          question_version: DAILY_CHECKIN_QUESTION_VERSION,
          question_meanings: DAILY_CHECKIN_QUESTIONS_V1,
          overall_day_scale: '1 = very difficult … 5 = great',
          checkin: (await getDailyCheckin(userId, date)) ?? null,
          note: 'checkin null means not recorded. A skipped check-in carries no answers.',
        }));
      },
    }),

    sparky_list_daily_checkins: tool({
      description: `Read daily check-ins in a date range (at most ${TRACKING_TOOL_MAX_DAYS} days). Read-only.`,
      inputSchema: rangeInput,
      execute: async (rawArgs) => {
        const args = parseArgs(rangeInput, rawArgs, tz);
        if (!args.ok) return args.error;
        const { start_date, end_date } = args.value;
        const invalid = checkRange(start_date, end_date);
        if (invalid) return invalid;
        return run('sparky_list_daily_checkins', async () => {
          const checkins = await listDailyCheckins(
            userId,
            start_date,
            end_date
          );
          return {
            start_date,
            end_date,
            days_in_range: daysBetween(start_date, end_date) + 1,
            days_recorded: checkins.length,
            question_meanings: DAILY_CHECKIN_QUESTIONS_V1,
            checkins,
            note: MISSING_DAYS_NOTE,
          };
        });
      },
    }),

    sparky_list_health_context_periods: tool({
      description:
        'Read user-declared injury, illness and vacation periods overlapping an optional date range. These are declarations by the user, not diagnoses. Read-only.',
      inputSchema: z
        .object({
          start_date: optionalDateSchema,
          end_date: optionalDateSchema,
        })
        .strict(),
      execute: async (rawArgs) => {
        const schema = z
          .object({
            start_date: optionalDateSchema,
            end_date: optionalDateSchema,
          })
          .strict();
        const args = parseArgs(schema, rawArgs, tz);
        if (!args.ok) return args.error;
        const { start_date, end_date } = args.value;
        if (start_date && end_date) {
          const invalid = checkRange(start_date, end_date);
          if (invalid) return invalid;
        }
        return run('sparky_list_health_context_periods', async () => ({
          periods: await listHealthContextPeriods(userId, {
            startDate: start_date,
            endDate: end_date,
          }),
          note: 'end_date null means ongoing. Periods never change schedules or records.',
        }));
      },
    }),

    sparky_list_habits: tool({
      description:
        'Read configured habits: type (completion or count), unit, optional target, weekday schedule (0 = Sunday), reminder time and active state. Read-only.',
      inputSchema: z
        .object({ include_inactive: z.boolean().optional() })
        .strict(),
      execute: async (rawArgs) => {
        const schema = z
          .object({ include_inactive: z.boolean().optional() })
          .strict();
        const args = parseArgs(schema, rawArgs, tz);
        if (!args.ok) return args.error;
        return run('sparky_list_habits', async () => ({
          habits: await listHabits(userId, {
            includeInactive: args.value.include_inactive,
          }),
        }));
      },
    }),

    sparky_get_habit_history: tool({
      description: `Read explicit habit logs in a date range (at most ${TRACKING_TOOL_MAX_DAYS} days), optionally for one habit. Completion habits log 1 (done) or 0 (explicitly not done); count habits log the saved number, where 0 is a real record. Read-only.`,
      inputSchema: rangeInput.extend({ habit_id: uuidSchema.optional() }),
      execute: async (rawArgs) => {
        const schema = rangeInput.extend({ habit_id: uuidSchema.optional() });
        const args = parseArgs(schema, rawArgs, tz);
        if (!args.ok) return args.error;
        const { start_date, end_date, habit_id } = args.value;
        const invalid = checkRange(start_date, end_date);
        if (invalid) return invalid;
        return run('sparky_get_habit_history', async () => {
          const logs = await listHabitLogs(
            userId,
            start_date,
            end_date,
            habit_id
          );
          return {
            start_date,
            end_date,
            days_in_range: daysBetween(start_date, end_date) + 1,
            logs,
            note: MISSING_DAYS_NOTE,
          };
        });
      },
    }),

    sparky_get_measurement_reminder_status: tool({
      description:
        'Read measurement reminders (e.g. weigh-in) and, for one day, which reminded measurements are due and whether a value was saved. Read-only.',
      inputSchema: dayInput,
      execute: async (rawArgs) => {
        const args = parseArgs(dayInput, rawArgs, tz);
        if (!args.ok) return args.error;
        const date = args.value.date ?? today();
        return run('sparky_get_measurement_reminder_status', async () => {
          const reminders = await listMeasurementReminders(userId);
          const recorded = await recordedMeasurementsOn(
            userId,
            date,
            reminders.map((reminder) => reminder.measurement_key)
          );
          return {
            date,
            reminders: reminders.map((reminder) => ({
              ...reminder,
              due: isMeasurementReminderDue(reminder, date),
              recorded_at: recorded[reminder.measurement_key] ?? null,
            })),
            note: 'A measurement that is not due is not expected that day.',
          };
        });
      },
    }),

    sparky_get_meal_tracking_status: tool({
      description:
        'Read explicit meal resolution for one day: complete, skipped (no meal), incomplete or pending (no resolution yet), with coverage counts. Logged foods never imply a complete meal. Read-only.',
      inputSchema: dayInput,
      execute: async (rawArgs) => {
        const args = parseArgs(dayInput, rawArgs, tz);
        if (!args.ok) return args.error;
        const date = args.value.date ?? today();
        return run('sparky_get_meal_tracking_status', () =>
          getMealTrackingStatus(userId, date)
        );
      },
    }),

    sparky_get_daily_progress: tool({
      description:
        'Read Daily Progress for one day: the share of explicit, applicable daily tasks the user completed (equal weights), with every item, its state and reason, and per-domain coverage. It is not a health or wellness score; percent is null when no task applies. Read-only.',
      inputSchema: dayInput,
      execute: async (rawArgs) => {
        const args = parseArgs(dayInput, rawArgs, tz);
        if (!args.ok) return args.error;
        const date = args.value.date ?? today();
        return run('sparky_get_daily_progress', async () => ({
          ...(await getDailyProgress(userId, date)),
          note: 'Excluded items were explicitly skipped and leave the denominator. Items reflect records on the server; unsynced phone actions are absent.',
        }));
      },
    }),

    sparky_get_daily_status_context: tool({
      description:
        'Read a compact status for one day: check-in state, active injury/illness/vacation periods, whether optional reminders are paused, and the Daily Progress totals. Read-only.',
      inputSchema: dayInput,
      execute: async (rawArgs) => {
        const args = parseArgs(dayInput, rawArgs, tz);
        if (!args.ok) return args.error;
        const date = args.value.date ?? today();
        return run('sparky_get_daily_status_context', async () => {
          const [checkin, periods, progress] = await Promise.all([
            getDailyCheckin(userId, date),
            listHealthContextPeriods(userId, {
              startDate: date,
              endDate: date,
            }),
            getDailyProgress(userId, date),
          ]);
          return {
            date,
            checkin_state: checkin?.state ?? 'not_recorded',
            active_context: activeContextPeriods(periods, date),
            optional_reminders_paused: discretionaryRemindersPaused(
              periods,
              date
            ),
            daily_progress: {
              version: progress.version,
              completed: progress.completed,
              applicable: progress.applicable,
              percent: progress.percent,
              coverage: progress.coverage,
            },
          };
        });
      },
    }),
  };
}

interface SupplementRow {
  id: string;
  name: string;
  display_name: string | null;
  is_supplement: boolean;
  is_active: boolean;
  dose_amount: number | string | null;
  dose_unit: string | null;
  notes: string | null;
  schedules?: Array<{
    id: string;
    schedule_type_id: string;
    time_of_day: string | null;
    days_of_week: number[] | null;
    with_meal: string | null;
    active: boolean;
  }>;
}

function supplementView(row: SupplementRow) {
  return {
    id: row.id,
    name: row.display_name || row.name,
    active: row.is_active,
    dose_amount: row.dose_amount === null ? null : Number(row.dose_amount),
    dose_unit: row.dose_unit,
    notes: row.notes,
    schedules: (row.schedules ?? []).map((schedule) => ({
      id: schedule.id,
      type: schedule.schedule_type_id,
      time_of_day: schedule.time_of_day?.slice(0, 5) ?? null,
      days_of_week: schedule.days_of_week,
      with_meal: schedule.with_meal,
      active: schedule.active,
    })),
  };
}

async function supplementRows(userId: string): Promise<SupplementRow[]> {
  const rows = (await medicationRepository.listMedications(
    userId
  )) as SupplementRow[];
  // Only rows flagged as supplements; medications never appear here.
  return rows.filter((row) => row.is_supplement === true);
}

export function buildSupplementReadTools(userId: string, tz: string) {
  return {
    sparky_list_supplements: tool({
      description:
        'Read the supplement routine: supplements with dose and schedules. Medications that are not supplements are never included. Read-only.',
      inputSchema: z.object({}).strict(),
      execute: async () =>
        run('sparky_list_supplements', async () => ({
          supplements: (await supplementRows(userId)).map(supplementView),
        })),
    }),

    sparky_get_supplement: tool({
      description:
        'Read one supplement by ID with its schedules and today’s scheduled doses. Returns not found for medications that are not supplements. Read-only.',
      inputSchema: z.object({ supplement_id: uuidSchema }).strict(),
      execute: async (rawArgs) => {
        const schema = z.object({ supplement_id: uuidSchema }).strict();
        const args = parseArgs(schema, rawArgs, tz);
        if (!args.ok) return args.error;
        const id = args.value.supplement_id;
        return run('sparky_get_supplement', async () => {
          const row = (await supplementRows(userId)).find(
            (item) => item.id === id
          );
          if (!row) return ERRORS.NOT_FOUND('Supplement', id);
          const date = todayInZone(tz);
          const doses = (await getSupplementDoses(userId, date, tz)).filter(
            (dose) => dose.medication_id === id
          );
          return { ...supplementView(row), today: { date, doses } };
        });
      },
    }),

    sparky_list_supplement_entries: tool({
      description: `Read recorded supplement intake (taken, skipped, as-needed) in a date range (at most ${TRACKING_TOOL_MAX_DAYS} days). Medication entries are never included. Read-only.`,
      inputSchema: rangeInput,
      execute: async (rawArgs) => {
        const args = parseArgs(rangeInput, rawArgs, tz);
        if (!args.ok) return args.error;
        const { start_date, end_date } = args.value;
        const invalid = checkRange(start_date, end_date);
        if (invalid) return invalid;
        return run('sparky_list_supplement_entries', async () => {
          const supplementIds = new Set(
            (await supplementRows(userId)).map((row) => row.id)
          );
          const entries = (await medicationEntryRepository.listEntries(userId, {
            fromDate: start_date,
            toDate: end_date,
          })) as Array<{
            id: string;
            medication_id: string | null;
            schedule_id: string | null;
            status: string;
            entry_date: unknown;
            taken_at: unknown;
            med_name_snapshot: string | null;
            dose_amount_snapshot: number | string | null;
            dose_unit_snapshot: string | null;
          }>;
          return {
            start_date,
            end_date,
            entries: entries
              // Entries whose item was deleted cannot be verified as
              // supplements and are left out rather than risk a leak.
              .filter(
                (entry) =>
                  entry.medication_id !== null &&
                  supplementIds.has(entry.medication_id)
              )
              .map((entry) => ({
                id: entry.id,
                supplement_id: entry.medication_id,
                schedule_id: entry.schedule_id,
                status: entry.status,
                entry_date: dayString(entry.entry_date),
                taken_at: entry.taken_at,
                name: entry.med_name_snapshot,
                dose_amount:
                  entry.dose_amount_snapshot === null
                    ? null
                    : Number(entry.dose_amount_snapshot),
                dose_unit: entry.dose_unit_snapshot,
              })),
            note: 'Only explicit records are listed; a scheduled dose without an entry was not recorded.',
          };
        });
      },
    }),
  };
}
