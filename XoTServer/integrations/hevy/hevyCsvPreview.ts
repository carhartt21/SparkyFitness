import Papa from 'papaparse';
import { createHash } from 'node:crypto';
import {
  isValidTimeZone,
  localDateTimeToUtc,
  utcToLocalDateTimeInput,
} from '@workspace/shared';
import type { HevyWorkout } from './hevyDataProcessor.js';

// Hevy's workout-history CSV is a set log. A workout title in this file does
// not identify an independently saved routine, and the file has no workout ID.
const REQUIRED_COLUMNS = [
  'title',
  'start_time',
  'end_time',
  'exercise_title',
  'superset_id',
  'set_index',
  'set_type',
  'weight_kg',
  'reps',
  'distance_km',
  'duration_seconds',
  'rpe',
] as const;
const SUPPORTED_SET_TYPES = new Set(['normal', 'warmup', 'dropset', 'failure']);

interface CsvRow extends Record<string, string | undefined> {
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  exercise_title: string;
  superset_id: string;
  exercise_notes?: string;
  set_index: string;
  set_type: string;
  weight_kg: string;
  reps: string;
  distance_km: string;
  duration_seconds: string;
  rpe: string;
}

export interface HevyCsvSetPreview {
  sourceRow: number;
  index: number;
  type: string;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  rpe: number | null;
}

export interface HevyCsvExercisePreview {
  title: string;
  notes: string;
  supersetId: string | null;
  sets: HevyCsvSetPreview[];
}

export interface HevyCsvWorkoutPreview {
  title: string;
  startTimeLocal: string;
  endTimeLocal: string;
  description: string;
  exercises: HevyCsvExercisePreview[];
}

export interface HevyCsvPreview {
  workouts: HevyCsvWorkoutPreview[];
  rowCount: number;
  warnings: string[];
  /** This CSV never proves which routines are currently saved in Hevy. */
  savedRoutinesIncluded: false;
  /** These local timestamps cannot become UTC instants without a timezone. */
  timezoneRequired: true;
}

const MONTHS: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function parseHevyLocalTime(value: string, timezone: string): Date {
  const match = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4}), (\d{2}):(\d{2})$/.exec(
    value
  );
  if (!match) throw new Error(`Invalid Hevy local timestamp: ${value}`);
  const [, dayText, monthText, yearText, hourText, minuteText] = match;
  const month = MONTHS[monthText!];
  const day = Number(dayText);
  const year = Number(yearText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const calendarDate = new Date(Date.UTC(year, month! - 1, day));
  if (
    !month ||
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() + 1 !== month ||
    calendarDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    throw new Error(`Invalid Hevy local timestamp: ${value}`);
  }
  const local = `${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hourText}:${minuteText}`;
  const instant = localDateTimeToUtc(local, timezone);
  if (
    Number.isNaN(instant.getTime()) ||
    utcToLocalDateTimeInput(instant.toISOString(), timezone) !== local
  ) {
    throw new Error(
      `Hevy local timestamp does not exist in ${timezone}: ${value}`
    );
  }
  // The CSV has no UTC offset. An ambiguous DST fall-back hour would allow
  // two valid instants, so importing it would invent an ordering/time.
  for (const offsetMinutes of [-120, -90, -60, -30, 30, 60, 90, 120]) {
    const alternative = new Date(instant.getTime() + offsetMinutes * 60_000);
    if (
      utcToLocalDateTimeInput(alternative.toISOString(), timezone) === local
    ) {
      throw new Error(
        `Hevy local timestamp is ambiguous in ${timezone}: ${value}`
      );
    }
  }
  return instant;
}

/** Convert reviewed CSV history to the existing idempotent workout ingest shape. */
export function hevyCsvWorkoutsForImport(
  preview: HevyCsvPreview,
  timezone: string
): HevyWorkout[] {
  if (!isValidTimeZone(timezone)) throw new Error('Valid timezone is required');
  return preview.workouts.map((workout) => {
    const start = parseHevyLocalTime(workout.startTimeLocal, timezone);
    const end = parseHevyLocalTime(workout.endTimeLocal, timezone);
    if (end <= start) {
      throw new Error(`Hevy workout ends before it starts: ${workout.title}`);
    }
    const id = `csv_${createHash('sha256')
      .update(
        JSON.stringify([
          workout.title,
          workout.startTimeLocal,
          workout.endTimeLocal,
        ])
      )
      .digest('hex')}`;
    return {
      id,
      title: workout.title,
      description: workout.description,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      exercises: workout.exercises.map((exercise, index) => ({
        index,
        title: exercise.title,
        notes: exercise.notes,
        superset_id: exercise.supersetId,
        sets: exercise.sets.map((set) => ({
          index: set.index,
          type: set.type,
          weight_kg: set.weightKg,
          reps: set.reps,
          distance_meters:
            set.distanceKm === null ? null : set.distanceKm * 1000,
          duration_seconds: set.durationSeconds,
          rpe: set.rpe,
        })),
      })),
    };
  });
}

function optionalNumber(
  value: string | undefined,
  row: number,
  column: string
): number | null {
  if (value === undefined || value.trim() === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`Row ${row}: invalid ${column}`);
  }
  return number;
}

/** Normalize record separators without rewriting line breaks inside quoted notes. */
function normalizeCsvRecordNewlines(csv: string): string {
  let quoted = false;
  let normalized = '';
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"') {
      normalized += char;
      if (quoted && csv[index + 1] === '"') {
        normalized += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === '\r') {
      normalized += '\n';
      if (csv[index + 1] === '\n') index += 1;
    } else {
      normalized += char;
    }
  }
  return normalized;
}

/** Parse an authorized Hevy history export for review without writing diary data. */
export function previewHevyWorkoutCsv(csv: string): HevyCsvPreview {
  // Exports assembled across devices can mix CRLF and LF line endings. Papa
  // detects one delimiter for the file, then treats other line endings as
  // field content and merges adjacent sets into a malformed row. Quoted field
  // content is kept as exported so workout and exercise notes do not change.
  const parsed = Papa.parse<CsvRow>(normalizeCsvRecordNewlines(csv), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim().replace(/^\uFEFF/, ''),
  });
  if (parsed.errors.length > 0) {
    throw new Error(`Invalid Hevy CSV: ${parsed.errors[0]?.message}`);
  }
  const missing = REQUIRED_COLUMNS.filter(
    (column) => !parsed.meta.fields?.includes(column)
  );
  if (missing.length > 0) {
    throw new Error(`Missing Hevy CSV columns: ${missing.join(', ')}`);
  }

  const workouts: HevyCsvWorkoutPreview[] = [];
  const byWorkout = new Map<string, HevyCsvWorkoutPreview>();
  const warnings: string[] = [];
  const firstMatchingRow = new Map<string, number>();
  let previousWorkoutKey: string | null = null;
  for (const [offset, row] of parsed.data.entries()) {
    const sourceRow = offset + 2;
    const title = row.title?.trim();
    const start = row.start_time?.trim();
    const end = row.end_time?.trim();
    const exerciseTitle = row.exercise_title?.trim();
    if (!title || !start || !end || !exerciseTitle) {
      throw new Error(
        `Row ${sourceRow}: workout and exercise names and times are required`
      );
    }
    const index = optionalNumber(row.set_index, sourceRow, 'set_index');
    if (index === null || !Number.isInteger(index)) {
      throw new Error(`Row ${sourceRow}: invalid set_index`);
    }
    const setType = row.set_type?.trim() || 'normal';
    if (!SUPPORTED_SET_TYPES.has(setType)) {
      throw new Error(`Row ${sourceRow}: unsupported set_type ${setType}`);
    }
    // Two identical export rows may be a legitimate repeated set or a source
    // duplicate. Surface the uncertainty in the dry run and retain both rows.
    const rowSignature = JSON.stringify([
      ...REQUIRED_COLUMNS.map((column) => row[column]?.trim() ?? ''),
      row.description?.trim() ?? '',
      row.exercise_notes?.trim() ?? '',
    ]);
    const firstRow = firstMatchingRow.get(rowSignature);
    if (firstRow !== undefined) {
      warnings.push(
        `Possible duplicate: rows ${firstRow} and ${sourceRow} are identical; both are retained as separate sets.`
      );
    } else {
      firstMatchingRow.set(rowSignature, sourceRow);
    }
    const key = JSON.stringify([title, start, end]);
    let workout = byWorkout.get(key);
    if (!workout) {
      workout = {
        title,
        startTimeLocal: start,
        endTimeLocal: end,
        description: row.description ?? '',
        exercises: [],
      };
      byWorkout.set(key, workout);
      workouts.push(workout);
    }

    // Consecutive rows with increasing set indices form one occurrence. A
    // repeated exercise can start again at index zero, including immediately
    // after its previous occurrence or after rows from another workout.
    const supersetId = row.superset_id?.trim() || null;
    const notes = row.exercise_notes ?? '';
    const previous =
      previousWorkoutKey === key ? workout.exercises.at(-1) : null;
    const previousSetIndex = previous?.sets.at(-1)?.index;
    const exercise =
      previous &&
      previous.title === exerciseTitle &&
      previous.supersetId === supersetId &&
      previous.notes === notes &&
      previousSetIndex !== undefined &&
      index > previousSetIndex
        ? previous
        : { title: exerciseTitle, notes, supersetId, sets: [] };
    if (exercise !== previous) {
      workout.exercises.push(exercise);
    }
    exercise.sets.push({
      sourceRow,
      index,
      type: setType,
      weightKg: optionalNumber(row.weight_kg, sourceRow, 'weight_kg'),
      reps: optionalNumber(row.reps, sourceRow, 'reps'),
      distanceKm: optionalNumber(row.distance_km, sourceRow, 'distance_km'),
      durationSeconds: optionalNumber(
        row.duration_seconds,
        sourceRow,
        'duration_seconds'
      ),
      rpe: optionalNumber(row.rpe, sourceRow, 'rpe'),
    });
    previousWorkoutKey = key;
  }

  return {
    workouts,
    rowCount: parsed.data.length,
    warnings,
    savedRoutinesIncluded: false,
    timezoneRequired: true,
  };
}
