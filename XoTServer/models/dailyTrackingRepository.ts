import type { PoolClient } from 'pg';
import { getClient } from '../db/poolManager.js';
import {
  DAILY_CHECKIN_QUESTION_VERSION,
  DEFAULT_DAILY_TRACKING_PREFERENCES,
  hasCheckinResponse,
  type CreateHabitRequest,
  type CreateHealthContextPeriodRequest,
  type DailyCheckin,
  type DailyTrackingPreferences,
  type Habit,
  type HabitLog,
  type HealthContextPeriod,
  type MealDayStatusValue,
  type MeasurementReminder,
  type SaveDailyCheckinRequest,
  type UpdateDailyTrackingPreferencesRequest,
  type UpdateHabitRequest,
  type UpdateHealthContextPeriodRequest,
  type UpsertMeasurementReminderRequest,
} from '@workspace/shared';

/** A request the caller must correct; routes map it to 400/404/409. */
export class DailyTrackingError extends Error {
  constructor(
    readonly statusCode: 400 | 404 | 409,
    message: string
  ) {
    super(message);
  }
}

async function withClient<T>(
  userId: string,
  actorId: string | undefined,
  task: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient(userId, actorId ?? null);
  try {
    return await task(client);
  } finally {
    client.release();
  }
}

function dayString(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  // pg returns DATE columns as local-midnight Date objects.
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function clock(value: string | null): string | null {
  return value === null ? null : value.slice(0, 5);
}

// --- Daily check-in ---------------------------------------------------------

interface CheckinRow {
  id: string;
  entry_date: Date | string;
  state: DailyCheckin['state'];
  question_version: number;
  overall_day: number | null;
  energy: number | null;
  stress: number | null;
  sleep_quality: number | null;
  nutrition_on_track: number | null;
  activity: number | null;
  note: string | null;
  tags: string[];
  completed_at: Date | null;
  skipped_at: Date | null;
  updated_at: Date;
}

const CHECKIN_COLUMNS = `id, entry_date, state, question_version, overall_day,
  energy, stress, sleep_quality, nutrition_on_track, activity, note, tags,
  completed_at, skipped_at, updated_at`;

function toCheckin(row: CheckinRow): DailyCheckin {
  return {
    ...row,
    entry_date: dayString(row.entry_date),
    completed_at: iso(row.completed_at),
    skipped_at: iso(row.skipped_at),
    updated_at: iso(row.updated_at) ?? '',
  };
}

function normalizeTags(tags: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  for (const tag of tags ?? []) {
    const trimmed = tag.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

export async function getDailyCheckin(
  userId: string,
  date: string
): Promise<DailyCheckin | null> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<CheckinRow>(
      `SELECT ${CHECKIN_COLUMNS} FROM daily_checkins
       WHERE user_id = $1 AND entry_date = $2`,
      [userId, date]
    );
    return result.rows[0] ? toCheckin(result.rows[0]) : null;
  });
}

export async function listDailyCheckins(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyCheckin[]> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<CheckinRow>(
      `SELECT ${CHECKIN_COLUMNS} FROM daily_checkins
       WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3
       ORDER BY entry_date ASC`,
      [userId, startDate, endDate]
    );
    return result.rows.map(toCheckin);
  });
}

/**
 * Save a draft or complete a check-in. Saving over a skipped day reopens it.
 * A completed check-in must carry at least one response.
 */
export async function saveDailyCheckin(
  userId: string,
  actorId: string,
  date: string,
  body: SaveDailyCheckinRequest
): Promise<DailyCheckin> {
  const tags = normalizeTags(body.tags);
  const note = body.note?.trim() ? body.note.trim() : null;
  if (
    body.state === 'completed' &&
    !hasCheckinResponse({ ...body, note, tags })
  ) {
    throw new DailyTrackingError(
      400,
      'Add at least one answer, note or tag before completing the check-in.'
    );
  }
  return withClient(userId, actorId, async (client) => {
    const result = await client.query<CheckinRow>(
      `INSERT INTO daily_checkins (
         user_id, entry_date, state, question_version, overall_day, energy,
         stress, sleep_quality, nutrition_on_track, activity, note, tags,
         completed_at, skipped_at, created_by_user_id, updated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         CASE WHEN $3 = 'completed' THEN NOW() END, NULL, $13, $13)
       ON CONFLICT (user_id, entry_date) DO UPDATE SET
         state = EXCLUDED.state,
         question_version = EXCLUDED.question_version,
         overall_day = EXCLUDED.overall_day,
         energy = EXCLUDED.energy,
         stress = EXCLUDED.stress,
         sleep_quality = EXCLUDED.sleep_quality,
         nutrition_on_track = EXCLUDED.nutrition_on_track,
         activity = EXCLUDED.activity,
         note = EXCLUDED.note,
         tags = EXCLUDED.tags,
         completed_at = CASE
           WHEN EXCLUDED.state = 'completed'
             THEN COALESCE(daily_checkins.completed_at, NOW())
         END,
         skipped_at = NULL,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = NOW()
       RETURNING ${CHECKIN_COLUMNS}`,
      [
        userId,
        date,
        body.state,
        body.question_version ?? DAILY_CHECKIN_QUESTION_VERSION,
        body.overall_day ?? null,
        body.energy ?? null,
        body.stress ?? null,
        body.sleep_quality ?? null,
        body.nutrition_on_track ?? null,
        body.activity ?? null,
        note,
        tags,
        actorId,
      ]
    );
    return toCheckin(result.rows[0]);
  });
}

/** Skipping clears every response: a skip is never a score. */
export async function skipDailyCheckin(
  userId: string,
  actorId: string,
  date: string
): Promise<DailyCheckin> {
  return withClient(userId, actorId, async (client) => {
    const result = await client.query<CheckinRow>(
      `INSERT INTO daily_checkins (
         user_id, entry_date, state, question_version, skipped_at,
         created_by_user_id, updated_by_user_id)
       VALUES ($1, $2, 'skipped', $3, NOW(), $4, $4)
       ON CONFLICT (user_id, entry_date) DO UPDATE SET
         state = 'skipped', overall_day = NULL, energy = NULL, stress = NULL,
         sleep_quality = NULL, nutrition_on_track = NULL, activity = NULL,
         note = NULL, tags = '{}', completed_at = NULL, skipped_at = NOW(),
         updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = NOW()
       RETURNING ${CHECKIN_COLUMNS}`,
      [userId, date, DAILY_CHECKIN_QUESTION_VERSION, actorId]
    );
    return toCheckin(result.rows[0]);
  });
}

/** Removes the day's check-in, returning it to "not recorded". */
export async function deleteDailyCheckin(
  userId: string,
  actorId: string,
  date: string
): Promise<boolean> {
  return withClient(userId, actorId, async (client) => {
    const result = await client.query(
      'DELETE FROM daily_checkins WHERE user_id = $1 AND entry_date = $2',
      [userId, date]
    );
    return (result.rowCount ?? 0) > 0;
  });
}

// --- Health context ---------------------------------------------------------

interface ContextRow {
  id: string;
  kind: HealthContextPeriod['kind'];
  start_date: Date | string;
  end_date: Date | string | null;
  note: string | null;
  body_area: string | null;
  limitation: string | null;
  pause_discretionary_reminders: boolean;
  updated_at: Date;
}

const CONTEXT_COLUMNS = `id, kind, start_date, end_date, note, body_area,
  limitation, pause_discretionary_reminders, updated_at`;

function toContext(row: ContextRow): HealthContextPeriod {
  return {
    ...row,
    start_date: dayString(row.start_date),
    end_date: row.end_date === null ? null : dayString(row.end_date),
    updated_at: iso(row.updated_at) ?? '',
  };
}

/** Periods overlapping [startDate, endDate]; either bound may be omitted. */
export async function listHealthContextPeriods(
  userId: string,
  range: { startDate?: string; endDate?: string } = {}
): Promise<HealthContextPeriod[]> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<ContextRow>(
      `SELECT ${CONTEXT_COLUMNS} FROM health_context_periods
       WHERE user_id = $1
         AND ($2::date IS NULL OR end_date IS NULL OR end_date >= $2::date)
         AND ($3::date IS NULL OR start_date <= $3::date)
       ORDER BY start_date DESC, created_at DESC`,
      [userId, range.startDate ?? null, range.endDate ?? null]
    );
    return result.rows.map(toContext);
  });
}

export async function createHealthContextPeriod(
  userId: string,
  body: CreateHealthContextPeriodRequest
): Promise<HealthContextPeriod> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<ContextRow>(
      `INSERT INTO health_context_periods (
         user_id, kind, start_date, end_date, note, body_area, limitation,
         pause_discretionary_reminders)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${CONTEXT_COLUMNS}`,
      [
        userId,
        body.kind,
        body.start_date,
        body.end_date ?? null,
        body.note || null,
        body.kind === 'injury' ? body.body_area || null : null,
        body.kind === 'injury' ? body.limitation || null : null,
        body.pause_discretionary_reminders ?? false,
      ]
    );
    return toContext(result.rows[0]);
  });
}

export async function updateHealthContextPeriod(
  userId: string,
  id: string,
  body: UpdateHealthContextPeriodRequest
): Promise<HealthContextPeriod> {
  return withClient(userId, undefined, async (client) => {
    const current = await client.query<ContextRow>(
      `SELECT ${CONTEXT_COLUMNS} FROM health_context_periods
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    const row = current.rows[0];
    if (!row) throw new DailyTrackingError(404, 'Context period not found.');
    const merged = { ...toContext(row), ...body };
    if (merged.end_date && merged.end_date < merged.start_date) {
      throw new DailyTrackingError(
        400,
        'End date must not be before the start date.'
      );
    }
    const injury = merged.kind === 'injury';
    const result = await client.query<ContextRow>(
      `UPDATE health_context_periods SET
         kind = $3, start_date = $4, end_date = $5, note = $6, body_area = $7,
         limitation = $8, pause_discretionary_reminders = $9, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING ${CONTEXT_COLUMNS}`,
      [
        id,
        userId,
        merged.kind,
        merged.start_date,
        merged.end_date ?? null,
        merged.note || null,
        injury ? merged.body_area || null : null,
        injury ? merged.limitation || null : null,
        merged.pause_discretionary_reminders,
      ]
    );
    return toContext(result.rows[0]);
  });
}

export async function deleteHealthContextPeriod(
  userId: string,
  id: string
): Promise<boolean> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query(
      'DELETE FROM health_context_periods WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  });
}

// --- Habits -----------------------------------------------------------------

interface HabitRow {
  id: string;
  name: string;
  display_name: string | null;
  measurement_type: string;
  habit_type: Habit['habit_type'];
  habit_description: string | null;
  habit_target: string | number | null;
  habit_step: string | number | null;
  habit_days: number[] | null;
  habit_reminder_time: string | null;
  habit_active: boolean;
  habit_sort_order: number;
  habit_icon: string | null;
}

const HABIT_COLUMNS = `id, name, display_name, measurement_type, habit_type,
  habit_description, habit_target, habit_step, habit_days, habit_reminder_time,
  habit_active, habit_sort_order, habit_icon`;

/** Completion habits store a placeholder unit in the NOT NULL column. */
const COMPLETION_UNIT = 'habit';

function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.display_name || row.name,
    habit_type: row.habit_type,
    description: row.habit_description,
    unit:
      row.habit_type === 'count' && row.measurement_type !== COMPLETION_UNIT
        ? row.measurement_type
        : null,
    target: row.habit_target === null ? null : Number(row.habit_target),
    step: row.habit_step === null ? null : Number(row.habit_step),
    days: row.habit_days,
    reminder_time: clock(row.habit_reminder_time),
    active: row.habit_active,
    sort_order: row.habit_sort_order,
    icon: row.habit_icon,
  };
}

export async function listHabits(
  userId: string,
  opts: { includeInactive?: boolean } = {}
): Promise<Habit[]> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<HabitRow>(
      `SELECT ${HABIT_COLUMNS} FROM custom_categories
       WHERE user_id = $1 AND habit_type IS NOT NULL
         AND ($2::boolean OR habit_active)
       ORDER BY habit_sort_order ASC, created_at ASC`,
      [userId, opts.includeInactive ?? false]
    );
    return result.rows.map(toHabit);
  });
}

async function readHabit(
  client: PoolClient,
  userId: string,
  id: string
): Promise<HabitRow> {
  const result = await client.query<HabitRow>(
    `SELECT ${HABIT_COLUMNS} FROM custom_categories
     WHERE id = $1 AND user_id = $2 AND habit_type IS NOT NULL`,
    [id, userId]
  );
  if (!result.rows[0]) throw new DailyTrackingError(404, 'Habit not found.');
  return result.rows[0];
}

export async function createHabit(
  userId: string,
  actorId: string,
  body: CreateHabitRequest
): Promise<Habit> {
  return withClient(userId, actorId, async (client) => {
    const count = body.habit_type === 'count';
    // `name` is the stable category identifier (max 50) and must stay unique
    // enough for sync; the user-facing name lives in display_name.
    const result = await client.query<HabitRow>(
      `INSERT INTO custom_categories (
         user_id, name, display_name, measurement_type, frequency, data_type,
         habit_type, habit_description, habit_target, habit_step, habit_days,
         habit_reminder_time, habit_active, habit_sort_order, habit_icon,
         created_by_user_id, updated_by_user_id)
       VALUES ($1, $2, $2, $3, 'Daily', $4, $5, $6, $7, $8, $9, $10, $11,
         COALESCE($12, (SELECT COALESCE(MAX(habit_sort_order) + 1, 0)
           FROM custom_categories WHERE user_id = $1 AND habit_type IS NOT NULL)),
         $13, $14, $14)
       RETURNING ${HABIT_COLUMNS}`,
      [
        userId,
        body.name,
        count ? body.unit?.trim() || 'count' : COMPLETION_UNIT,
        count ? 'numeric' : 'boolean',
        body.habit_type,
        body.description || null,
        count ? (body.target ?? null) : null,
        count ? (body.step ?? null) : null,
        body.days ?? null,
        body.reminder_time ?? null,
        body.active ?? true,
        body.sort_order ?? null,
        body.icon || null,
        actorId,
      ]
    );
    return toHabit(result.rows[0]);
  });
}

export async function updateHabit(
  userId: string,
  actorId: string,
  id: string,
  body: UpdateHabitRequest
): Promise<Habit> {
  return withClient(userId, actorId, async (client) => {
    const current = toHabit(await readHabit(client, userId, id));
    const count = current.habit_type === 'count';
    if (
      !count &&
      ((body.target !== undefined && body.target !== null) ||
        (body.step !== undefined && body.step !== null))
    ) {
      throw new DailyTrackingError(
        400,
        'Completion habits have no target or step.'
      );
    }
    const next = { ...current, ...body };
    const result = await client.query<HabitRow>(
      `UPDATE custom_categories SET
         display_name = $3, measurement_type = $4, habit_description = $5,
         habit_target = $6, habit_step = $7, habit_days = $8,
         habit_reminder_time = $9, habit_active = $10, habit_sort_order = $11,
         habit_icon = $12, updated_by_user_id = $13, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING ${HABIT_COLUMNS}`,
      [
        id,
        userId,
        next.name,
        count ? next.unit?.trim() || 'count' : COMPLETION_UNIT,
        next.description || null,
        count ? next.target : null,
        count ? next.step : null,
        next.days,
        next.reminder_time,
        next.active,
        next.sort_order,
        next.icon || null,
        actorId,
      ]
    );
    return toHabit(result.rows[0]);
  });
}

/** Deletes the habit and its history (custom_measurements cascade). */
export async function deleteHabit(
  userId: string,
  id: string
): Promise<boolean> {
  return withClient(userId, undefined, async (client) => {
    await readHabit(client, userId, id);
    await client.query(
      'DELETE FROM custom_measurements WHERE category_id = $1 AND user_id = $2',
      [id, userId]
    );
    const result = await client.query(
      'DELETE FROM custom_categories WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  });
}

interface HabitLogRow {
  category_id: string;
  entry_date: Date | string;
  value: string;
  updated_at: Date | null;
  entry_timestamp: Date;
}

function toHabitLog(row: HabitLogRow): HabitLog | null {
  const value =
    row.value === 'true' ? 1 : row.value === 'false' ? 0 : Number(row.value);
  if (!Number.isFinite(value)) return null;
  return {
    habit_id: row.category_id,
    entry_date: dayString(row.entry_date),
    value,
    recorded_at: iso(row.updated_at ?? row.entry_timestamp) ?? '',
  };
}

/**
 * Logs per habit and day. Legacy data may hold several rows for a day; the
 * latest saved one wins. Days without a row are absent, never zero.
 */
export async function listHabitLogs(
  userId: string,
  startDate: string,
  endDate: string,
  habitId?: string
): Promise<HabitLog[]> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<HabitLogRow>(
      `SELECT DISTINCT ON (cm.category_id, cm.entry_date)
         cm.category_id, cm.entry_date, cm.value, cm.updated_at, cm.entry_timestamp
       FROM custom_measurements cm
       JOIN custom_categories cc ON cc.id = cm.category_id
       WHERE cm.user_id = $1 AND cc.habit_type IS NOT NULL
         AND cm.entry_date BETWEEN $2 AND $3
         AND ($4::uuid IS NULL OR cm.category_id = $4::uuid)
       ORDER BY cm.category_id, cm.entry_date,
         COALESCE(cm.updated_at, cm.entry_timestamp) DESC`,
      [userId, startDate, endDate, habitId ?? null]
    );
    return result.rows
      .map(toHabitLog)
      .filter((log): log is HabitLog => log !== null);
  });
}

/**
 * Saves an explicit value, or clears the day when value is null. Only an
 * explicit call writes a log; nothing here derives one from other data.
 */
export async function logHabit(
  userId: string,
  actorId: string,
  habitId: string,
  date: string,
  value: boolean | number | null
): Promise<HabitLog | null> {
  return withClient(userId, actorId, async (client) => {
    const habit = toHabit(await readHabit(client, userId, habitId));
    if (habit.habit_type === 'completion' && typeof value === 'number') {
      throw new DailyTrackingError(400, 'Completion habits take true/false.');
    }
    if (habit.habit_type === 'count' && typeof value === 'boolean') {
      throw new DailyTrackingError(400, 'Count habits take a number.');
    }
    await client.query('BEGIN');
    try {
      await client.query(
        `DELETE FROM custom_measurements
         WHERE user_id = $1 AND category_id = $2 AND entry_date = $3`,
        [userId, habitId, date]
      );
      if (value === null) {
        await client.query('COMMIT');
        return null;
      }
      const stored = String(value);
      const result = await client.query<HabitLogRow>(
        `INSERT INTO custom_measurements (
           user_id, category_id, value, entry_date, entry_timestamp, source,
           created_by_user_id, updated_by_user_id, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), 'manual', $5, $5, NOW())
         RETURNING category_id, entry_date, value, updated_at, entry_timestamp`,
        [userId, habitId, stored, date, actorId]
      );
      await client.query('COMMIT');
      return toHabitLog(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

// --- Measurement reminders ----------------------------------------------------

interface ReminderRow {
  id: string;
  measurement_key: string;
  enabled: boolean;
  days: number[] | null;
  daypart: MeasurementReminder['daypart'];
  reminder_time: string;
  include_in_daily_progress: boolean;
}

const REMINDER_COLUMNS = `id, measurement_key, enabled, days, daypart,
  reminder_time, include_in_daily_progress`;

function toReminder(row: ReminderRow): MeasurementReminder {
  return { ...row, reminder_time: clock(row.reminder_time) ?? '' };
}

export async function listMeasurementReminders(
  userId: string
): Promise<MeasurementReminder[]> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<ReminderRow>(
      `SELECT ${REMINDER_COLUMNS} FROM measurement_reminders
       WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    return result.rows.map(toReminder);
  });
}

export async function upsertMeasurementReminder(
  userId: string,
  body: UpsertMeasurementReminderRequest
): Promise<MeasurementReminder> {
  return withClient(userId, undefined, async (client) => {
    if (body.measurement_key.startsWith('custom:')) {
      const categoryId = body.measurement_key.slice('custom:'.length);
      const owned = await client.query(
        `SELECT 1 FROM custom_categories
         WHERE id = $1 AND user_id = $2 AND habit_type IS NULL`,
        [categoryId, userId]
      );
      if (!owned.rows[0]) {
        throw new DailyTrackingError(404, 'Measurement category not found.');
      }
    }
    const result = await client.query<ReminderRow>(
      `INSERT INTO measurement_reminders (
         user_id, measurement_key, enabled, days, daypart, reminder_time,
         include_in_daily_progress)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'morning'), COALESCE($6::time, '07:30'),
         COALESCE($7, FALSE))
       ON CONFLICT (user_id, measurement_key) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         days = CASE WHEN $8 THEN EXCLUDED.days ELSE measurement_reminders.days END,
         daypart = COALESCE($5, measurement_reminders.daypart),
         reminder_time = COALESCE($6::time, measurement_reminders.reminder_time),
         include_in_daily_progress = COALESCE($7, measurement_reminders.include_in_daily_progress),
         updated_at = NOW()
       RETURNING ${REMINDER_COLUMNS}`,
      [
        userId,
        body.measurement_key,
        body.enabled,
        body.days ?? null,
        body.daypart ?? null,
        body.reminder_time ?? null,
        body.include_in_daily_progress ?? null,
        body.days !== undefined,
      ]
    );
    return toReminder(result.rows[0]);
  });
}

export async function deleteMeasurementReminder(
  userId: string,
  id: string
): Promise<boolean> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query(
      'DELETE FROM measurement_reminders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  });
}

/**
 * When each reminded measurement was saved on a date. Only a saved value
 * counts; nothing is prefilled or carried forward from earlier days.
 */
export async function recordedMeasurementsOn(
  userId: string,
  date: string,
  keys: readonly string[]
): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  return withClient(userId, undefined, async (client) => {
    const recorded: Record<string, string> = {};
    if (keys.includes('weight')) {
      const weight = await client.query<{ updated_at: Date }>(
        `SELECT updated_at FROM check_in_measurements
         WHERE user_id = $1 AND entry_date = $2 AND weight IS NOT NULL
         ORDER BY updated_at DESC LIMIT 1`,
        [userId, date]
      );
      if (weight.rows[0])
        recorded.weight = weight.rows[0].updated_at.toISOString();
    }
    const categoryIds = keys
      .filter((key) => key.startsWith('custom:'))
      .map((key) => key.slice('custom:'.length));
    if (categoryIds.length > 0) {
      const custom = await client.query<{ category_id: string; at: Date }>(
        `SELECT category_id, MAX(COALESCE(updated_at, entry_timestamp)) AS at
         FROM custom_measurements
         WHERE user_id = $1 AND entry_date = $2 AND category_id = ANY($3::uuid[])
         GROUP BY category_id`,
        [userId, date, categoryIds]
      );
      for (const row of custom.rows) {
        recorded[`custom:${row.category_id}`] = row.at.toISOString();
      }
    }
    return recorded;
  });
}

// --- Meal status --------------------------------------------------------------

export interface MealTypeWithStatus {
  default_time: string | null;
  meal_type_id: string;
  name: string;
  status: MealDayStatusValue | null;
  updated_at: string | null;
  logged_item_count: number;
}

/** Visible meal types for the account with the date's explicit status. */
export async function listMealStatuses(
  userId: string,
  date: string
): Promise<MealTypeWithStatus[]> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<{
      meal_type_id: string;
      default_time: string | null;
      name: string;
      status: MealDayStatusValue | null;
      updated_at: Date | null;
      logged_item_count: string;
    }>(
      `SELECT mt.id AS meal_type_id, mt.default_time,
         COALESCE(umv.name_override, mt.name) AS name,
         mds.status, mds.updated_at,
         (SELECT COUNT(*) FROM food_entries fe
            WHERE fe.user_id = $1 AND fe.entry_date = $2
              AND fe.meal_type_id = mt.id)
         + (SELECT COUNT(*) FROM food_entry_meals fem
            WHERE fem.user_id = $1 AND fem.entry_date = $2
              AND fem.meal_type_id = mt.id)
           AS logged_item_count
       FROM meal_types mt
       LEFT JOIN user_meal_visibilities umv
         ON umv.meal_type_id = mt.id AND umv.user_id = $1
       LEFT JOIN meal_day_statuses mds
         ON mds.meal_type_id = mt.id AND mds.user_id = $1 AND mds.entry_date = $2
       WHERE (mt.user_id = $1 OR mt.user_id IS NULL)
         AND COALESCE(umv.is_visible, mt.is_visible)
       ORDER BY COALESCE(umv.sort_order_override, mt.sort_order) ASC, mt.id ASC`,
      [userId, date]
    );
    return result.rows.map((row) => ({
      meal_type_id: row.meal_type_id,
      default_time: row.default_time,
      name: row.name,
      status: row.status,
      updated_at: iso(row.updated_at),
      logged_item_count: Number(row.logged_item_count),
    }));
  });
}

export async function setMealStatus(
  userId: string,
  actorId: string,
  date: string,
  mealTypeId: string,
  status: MealDayStatusValue | null
): Promise<void> {
  await withClient(userId, actorId, async (client) => {
    const mealType = await client.query(
      'SELECT 1 FROM meal_types WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
      [mealTypeId, userId]
    );
    if (!mealType.rows[0]) throw new DailyTrackingError(404, 'Meal not found.');
    if (status === null) {
      await client.query(
        `DELETE FROM meal_day_statuses
         WHERE user_id = $1 AND entry_date = $2 AND meal_type_id = $3`,
        [userId, date, mealTypeId]
      );
      return;
    }
    await client.query(
      `INSERT INTO meal_day_statuses (
         user_id, entry_date, meal_type_id, status, created_by_user_id,
         updated_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (user_id, entry_date, meal_type_id) DO UPDATE SET
         status = EXCLUDED.status,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = NOW()`,
      [userId, date, mealTypeId, status, actorId]
    );
  });
}

// --- Preferences --------------------------------------------------------------

interface PreferencesRow {
  include_checkin: boolean;
  include_habits: boolean;
  include_supplements: boolean;
  include_meals: boolean;
  checkin_reminder_enabled: boolean;
  checkin_reminder_time: string;
  habit_reminders_enabled: boolean;
}

const PREFERENCE_COLUMNS = `include_checkin, include_habits, include_supplements,
  include_meals, checkin_reminder_enabled, checkin_reminder_time,
  habit_reminders_enabled`;

function toPreferences(row: PreferencesRow): DailyTrackingPreferences {
  return {
    ...row,
    checkin_reminder_time: clock(row.checkin_reminder_time) ?? '',
  };
}

export async function getDailyTrackingPreferences(
  userId: string
): Promise<DailyTrackingPreferences> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<PreferencesRow>(
      `SELECT ${PREFERENCE_COLUMNS} FROM daily_tracking_preferences
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]
      ? toPreferences(result.rows[0])
      : { ...DEFAULT_DAILY_TRACKING_PREFERENCES };
  });
}

export async function updateDailyTrackingPreferences(
  userId: string,
  patch: UpdateDailyTrackingPreferencesRequest
): Promise<DailyTrackingPreferences> {
  const current = await getDailyTrackingPreferences(userId);
  const next = { ...current, ...patch };
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<PreferencesRow>(
      `INSERT INTO daily_tracking_preferences (
         user_id, include_checkin, include_habits, include_supplements,
         include_meals, checkin_reminder_enabled, checkin_reminder_time,
         habit_reminders_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         include_checkin = EXCLUDED.include_checkin,
         include_habits = EXCLUDED.include_habits,
         include_supplements = EXCLUDED.include_supplements,
         include_meals = EXCLUDED.include_meals,
         checkin_reminder_enabled = EXCLUDED.checkin_reminder_enabled,
         checkin_reminder_time = EXCLUDED.checkin_reminder_time,
         habit_reminders_enabled = EXCLUDED.habit_reminders_enabled,
         updated_at = NOW()
       RETURNING ${PREFERENCE_COLUMNS}`,
      [
        userId,
        next.include_checkin,
        next.include_habits,
        next.include_supplements,
        next.include_meals,
        next.checkin_reminder_enabled,
        next.checkin_reminder_time,
        next.habit_reminders_enabled,
      ]
    );
    return toPreferences(result.rows[0]);
  });
}

// --- History (calendar) ---------------------------------------------------------
// Bounded reads for the Daily Progress calendar. Timestamps let the service
// refuse to apply a definition to a day it did not yet exist in that form.

export interface HabitDefinitionHistory extends Habit {
  created_at: string;
  updated_at: string;
}

export async function listHabitDefinitionsWithHistory(
  userId: string
): Promise<HabitDefinitionHistory[]> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<
      HabitRow & { created_at: Date; updated_at: Date }
    >(
      `SELECT ${HABIT_COLUMNS}, created_at, updated_at FROM custom_categories
       WHERE user_id = $1 AND habit_type IS NOT NULL
       ORDER BY habit_sort_order ASC, created_at ASC`,
      [userId]
    );
    return result.rows.map((row) => ({
      ...toHabit(row),
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    }));
  });
}

export interface MeasurementReminderHistory extends MeasurementReminder {
  created_at: string;
  updated_at: string;
}

export async function listMeasurementRemindersWithHistory(
  userId: string
): Promise<MeasurementReminderHistory[]> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<
      ReminderRow & { created_at: Date; updated_at: Date }
    >(
      `SELECT ${REMINDER_COLUMNS}, created_at, updated_at FROM measurement_reminders
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows.map((row) => ({
      ...toReminder(row),
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    }));
  });
}

/** When the tracking preferences last changed, or null if never saved. */
export async function getDailyTrackingPreferencesUpdatedAt(
  userId: string
): Promise<string | null> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<{ updated_at: Date }>(
      'SELECT updated_at FROM daily_tracking_preferences WHERE user_id = $1',
      [userId]
    );
    return result.rows[0]?.updated_at.toISOString() ?? null;
  });
}

export async function firstDailyCheckinDate(
  userId: string
): Promise<string | null> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<{ first: Date | string | null }>(
      'SELECT MIN(entry_date) AS first FROM daily_checkins WHERE user_id = $1',
      [userId]
    );
    const first = result.rows[0]?.first ?? null;
    return first === null ? null : dayString(first);
  });
}

/** Saved weights per day in a range: entry_date → last update. */
export async function recordedWeightsInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Record<string, string>> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<{ entry_date: Date | string; at: Date }>(
      `SELECT entry_date, MAX(updated_at) AS at FROM check_in_measurements
       WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3 AND weight IS NOT NULL
       GROUP BY entry_date`,
      [userId, startDate, endDate]
    );
    return Object.fromEntries(
      result.rows.map((row) => [
        dayString(row.entry_date),
        row.at.toISOString(),
      ])
    );
  });
}

/** Saved custom measurements by day and reminder key for a bounded calendar range. */
export async function recordedCustomMeasurementsInRange(
  userId: string,
  startDate: string,
  endDate: string,
  keys: readonly string[]
): Promise<Record<string, Record<string, string>>> {
  const categoryIds = [
    ...new Set(
      keys
        .filter((key) => key.startsWith('custom:'))
        .map((key) => key.slice('custom:'.length))
    ),
  ];
  if (categoryIds.length === 0) return {};
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<{
      entry_date: Date | string;
      category_id: string;
      at: Date;
    }>(
      `SELECT entry_date, category_id,
              MAX(COALESCE(updated_at, entry_timestamp)) AS at
       FROM custom_measurements
       WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3
         AND category_id = ANY($4::uuid[])
       GROUP BY entry_date, category_id`,
      [userId, startDate, endDate, categoryIds]
    );
    const recorded: Record<string, Record<string, string>> = {};
    for (const row of result.rows) {
      const day = dayString(row.entry_date);
      (recorded[day] ??= {})[`custom:${row.category_id}`] =
        row.at.toISOString();
    }
    return recorded;
  });
}

export interface MealDayRow {
  entry_date: string;
  meal_type_id: string;
  status: MealDayStatusValue | null;
  updated_at: string | null;
  logged_item_count: number;
}

/** Explicit meal statuses and logged-item counts per day and meal type. */
export async function listMealActivityInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<MealDayRow[]> {
  return withClient(userId, undefined, async (client) => {
    const result = await client.query<{
      entry_date: Date | string;
      meal_type_id: string;
      status: MealDayStatusValue | null;
      updated_at: Date | null;
      logged_item_count: string;
    }>(
      `WITH counts AS (
         SELECT entry_date, meal_type_id, COUNT(*) AS n FROM food_entries
         WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3
         GROUP BY entry_date, meal_type_id
         UNION ALL
         SELECT entry_date, meal_type_id, COUNT(*) AS n FROM food_entry_meals
         WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3
         GROUP BY entry_date, meal_type_id
       ), totals AS (
         SELECT entry_date, meal_type_id, SUM(n) AS n FROM counts
         GROUP BY entry_date, meal_type_id
       )
       SELECT COALESCE(s.entry_date, t.entry_date) AS entry_date,
              COALESCE(s.meal_type_id, t.meal_type_id) AS meal_type_id,
              s.status, s.updated_at, COALESCE(t.n, 0) AS logged_item_count
       FROM (SELECT * FROM meal_day_statuses
             WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3) s
       FULL OUTER JOIN totals t
         ON t.entry_date = s.entry_date AND t.meal_type_id = s.meal_type_id`,
      [userId, startDate, endDate]
    );
    return result.rows.map((row) => ({
      entry_date: dayString(row.entry_date),
      meal_type_id: row.meal_type_id,
      status: row.status,
      updated_at: iso(row.updated_at),
      logged_item_count: Number(row.logged_item_count),
    }));
  });
}
