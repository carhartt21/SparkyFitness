import type {
  DailyCheckin,
  Habit,
  HabitLog,
  HealthContextPeriod,
  MealTrackingItem,
  MealTrackingStatus,
  MeasurementReminder,
} from "../schemas/api/DailyTracking.api.zod.ts";

// --- Check-in definitions (versioned) ------------------------------------

export const DAILY_CHECKIN_QUESTION_VERSION = 1;

/**
 * Direction of a 1–5 answer. Only "higher_is_better" answers may be colored
 * as improving with a higher value; stress is the opposite, and "neutral"
 * answers are never colored as good or bad.
 */
export type CheckinPolarity = "higher_is_better" | "higher_is_worse";

export interface CheckinQuestionDefinition {
  key:
    "energy" | "stress" | "sleep_quality" | "nutrition_on_track" | "activity";
  /** Meaning of 1 and 5 for this question in this version. */
  low: string;
  high: string;
  polarity: CheckinPolarity;
}

/** Version 1 meanings. Never edit in place; add a version instead. */
export const DAILY_CHECKIN_QUESTIONS_V1: readonly CheckinQuestionDefinition[] =
  [
    {
      key: "energy",
      low: "Very low energy",
      high: "Very high energy",
      polarity: "higher_is_better",
    },
    {
      key: "stress",
      low: "Very little stress",
      high: "Very stressful",
      polarity: "higher_is_worse",
    },
    {
      key: "sleep_quality",
      low: "Very poor sleep",
      high: "Very good sleep",
      polarity: "higher_is_better",
    },
    {
      key: "nutrition_on_track",
      low: "Far off track",
      high: "Fully on track",
      polarity: "higher_is_better",
    },
    {
      key: "activity",
      low: "Not active",
      high: "Very active",
      polarity: "higher_is_better",
    },
  ];

/** Overall day, 1 = very difficult … 5 = great. */
export const DAILY_CHECKIN_OVERALL_OPTIONS = [
  { value: 1, key: "very_difficult", label: "Very difficult" },
  { value: 2, key: "difficult", label: "Difficult" },
  { value: 3, key: "okay", label: "Okay" },
  { value: 4, key: "good", label: "Good" },
  { value: 5, key: "great", label: "Great" },
] as const;

/** Built-in tag slugs. Custom tags are stored as their trimmed text. */
export const DAILY_CHECKIN_BUILT_IN_TAGS = [
  "cravings",
  "busy_day",
  "great_workout",
  "low_sleep",
  "social_event",
  "good_routine",
] as const;
export type DailyCheckinBuiltInTag =
  (typeof DAILY_CHECKIN_BUILT_IN_TAGS)[number];

export function isBuiltInCheckinTag(
  tag: string,
): tag is DailyCheckinBuiltInTag {
  return (DAILY_CHECKIN_BUILT_IN_TAGS as readonly string[]).includes(tag);
}

/** Answer quality on a 0–1 scale where 1 is favourable, respecting polarity. */
export function favourableShare(
  value: number,
  polarity: CheckinPolarity,
): number {
  const share = (value - 1) / 4;
  return polarity === "higher_is_worse" ? 1 - share : share;
}

interface CheckinDraft {
  overall_day?: number | null;
  energy?: number | null;
  stress?: number | null;
  sleep_quality?: number | null;
  nutrition_on_track?: number | null;
  activity?: number | null;
  note?: string | null;
  tags?: readonly string[];
}

/** True when a draft carries at least one response; empty completes are refused. */
export function hasCheckinResponse(draft: CheckinDraft): boolean {
  return (
    draft.overall_day != null ||
    draft.energy != null ||
    draft.stress != null ||
    draft.sleep_quality != null ||
    draft.nutrition_on_track != null ||
    draft.activity != null ||
    (draft.note ?? "").trim() !== "" ||
    (draft.tags?.length ?? 0) > 0
  );
}

// --- Calendar helpers -------------------------------------------------------

/** Weekday (0 = Sunday) of a YYYY-MM-DD calendar day, timezone-free. */
export function weekdayOfDay(day: string): number {
  const [year = 1970, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}

function scheduledOn(days: readonly number[] | null, day: string): boolean {
  return days === null || days.includes(weekdayOfDay(day));
}

// --- Health context ---------------------------------------------------------

export function contextPeriodCoversDay(
  period: Pick<HealthContextPeriod, "start_date" | "end_date">,
  day: string,
): boolean {
  return (
    period.start_date <= day &&
    (period.end_date === null || day <= period.end_date)
  );
}

export function activeContextPeriods<
  P extends Pick<HealthContextPeriod, "start_date" | "end_date">,
>(periods: readonly P[], day: string): P[] {
  return periods.filter((period) => contextPeriodCoversDay(period, day));
}

/**
 * Whether optional reminders are paused on a day. Scheduled medication and
 * supplement reminders are never paused by context.
 */
export function discretionaryRemindersPaused(
  periods: readonly Pick<
    HealthContextPeriod,
    "start_date" | "end_date" | "pause_discretionary_reminders"
  >[],
  day: string,
): boolean {
  return periods.some(
    (period) =>
      period.pause_discretionary_reminders &&
      contextPeriodCoversDay(period, day),
  );
}

// --- Habits -----------------------------------------------------------------

export function isHabitDue(
  habit: Pick<Habit, "active" | "days">,
  day: string,
): boolean {
  return habit.active && scheduledOn(habit.days, day);
}

export type HabitDayState =
  "complete" | "started" | "not_done" | "not_recorded";

/**
 * A completion habit is complete only when saved as done. A count habit with a
 * target is complete at or above it; without a target any saved value
 * (including an explicit 0) completes the recording task.
 */
export function habitDayState(
  habit: Pick<Habit, "habit_type" | "target">,
  log: Pick<HabitLog, "value"> | undefined,
): HabitDayState {
  if (!log) return "not_recorded";
  if (habit.habit_type === "completion")
    return log.value > 0 ? "complete" : "not_done";
  if (habit.target == null) return "complete";
  if (log.value >= habit.target) return "complete";
  return log.value > 0 ? "started" : "not_done";
}

// --- Measurements -------------------------------------------------------------

export function isMeasurementReminderDue(
  reminder: Pick<MeasurementReminder, "enabled" | "days">,
  day: string,
): boolean {
  return reminder.enabled && scheduledOn(reminder.days, day);
}

// --- Meals --------------------------------------------------------------------

export function summarizeMealCoverage(
  meals: readonly Pick<MealTrackingItem, "state">[],
): MealTrackingStatus["coverage"] {
  const count = (state: MealTrackingItem["state"]) =>
    meals.filter((meal) => meal.state === state).length;
  const complete = count("complete");
  const skipped = count("skipped");
  return {
    total: meals.length,
    resolved: complete + skipped,
    complete,
    skipped,
    incomplete: count("incomplete"),
    pending: count("pending"),
  };
}

// --- Daily Progress -----------------------------------------------------------

export const DAILY_PROGRESS_VERSION = 1;

export type DailyProgressDomain =
  "checkin" | "habit" | "measurement" | "supplement" | "meal" | "activity";

/**
 * complete: the explicit task is done.
 * started: partly recorded (count below target, meal marked incomplete, food
 *   logged without a resolution).
 * pending: nothing recorded yet.
 * excluded: the user explicitly declined the task (skipped check-in, skipped
 *   dose); it leaves the denominator instead of counting as a failure.
 */
export type DailyProgressItemState =
  "complete" | "started" | "pending" | "excluded";

export interface DailyProgressItem {
  id: string;
  domain: DailyProgressDomain;
  label: string;
  date: string;
  applicable: boolean;
  state: DailyProgressItemState;
  /** Source record (check-in, habit, reminder, schedule, meal type). */
  reference_id: string | null;
  /** When the resolving record was saved, if any. */
  recorded_at: string | null;
  /** Machine-readable explanation of the state. */
  reason: string;
}

export interface DailyProgressInput {
  date: string;
  preferences: {
    include_checkin: boolean;
    include_habits: boolean;
    include_supplements: boolean;
    include_meals: boolean;
  };
  checkin: Pick<
    DailyCheckin,
    "id" | "state" | "completed_at" | "skipped_at" | "updated_at"
  > | null;
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  measurementReminders: readonly MeasurementReminder[];
  /** measurement_key → recorded timestamp for this date. */
  recordedMeasurements: Readonly<Record<string, string>>;
  supplementDoses: readonly {
    schedule_id: string;
    medication_id: string;
    label: string;
    status: "taken" | "skipped" | null;
    recorded_at: string | null;
  }[];
  meals: readonly Pick<
    MealTrackingItem,
    "meal_type_id" | "name" | "state" | "logged_item_count" | "updated_at"
  >[];
}

export interface DailyProgress {
  version: number;
  date: string;
  items: DailyProgressItem[];
  applicable: number;
  completed: number;
  /** 0–100, or null when no task applies (render a neutral X). */
  percent: number | null;
  coverage: Record<
    Exclude<DailyProgressDomain, "activity">,
    { applicable: number; completed: number }
  > & { activity?: { applicable: number; completed: number } };
}

/**
 * Daily Progress is the share of explicit, applicable daily tasks the user has
 * completed, with equal weights. It is not a health, wellness or adherence
 * score and never infers a record from another domain.
 */
export function buildDailyProgress(input: DailyProgressInput): DailyProgress {
  const items: DailyProgressItem[] = [];
  const { date, preferences } = input;
  const push = (item: Omit<DailyProgressItem, "date" | "applicable">) =>
    items.push({ ...item, date, applicable: item.state !== "excluded" });

  if (preferences.include_checkin) {
    const checkin = input.checkin;
    push({
      id: `checkin:${date}`,
      domain: "checkin",
      label: "Daily check-in",
      reference_id: checkin?.id ?? null,
      state:
        checkin?.state === "completed"
          ? "complete"
          : checkin?.state === "skipped"
            ? "excluded"
            : checkin?.state === "draft"
              ? "started"
              : "pending",
      recorded_at:
        checkin?.state === "completed"
          ? checkin.completed_at
          : checkin?.state === "skipped"
            ? checkin.skipped_at
            : (checkin?.updated_at ?? null),
      reason:
        checkin?.state === "completed"
          ? "checkin_completed"
          : checkin?.state === "skipped"
            ? "checkin_skipped"
            : checkin?.state === "draft"
              ? "checkin_draft"
              : "not_recorded",
    });
  }

  if (preferences.include_habits) {
    const logs = new Map(
      input.habitLogs
        .filter((log) => log.entry_date === date)
        .map((log) => [log.habit_id, log]),
    );
    for (const habit of input.habits) {
      if (!isHabitDue(habit, date)) continue;
      const log = logs.get(habit.id);
      const state = habitDayState(habit, log);
      push({
        id: `habit:${habit.id}:${date}`,
        domain: "habit",
        label: habit.name,
        reference_id: habit.id,
        state:
          state === "complete"
            ? "complete"
            : state === "not_recorded"
              ? "pending"
              : "started",
        recorded_at: log?.recorded_at ?? null,
        reason:
          state === "complete"
            ? "habit_complete"
            : state === "started"
              ? "below_target"
              : state === "not_done"
                ? "recorded_not_done"
                : "not_recorded",
      });
    }
  }

  for (const reminder of input.measurementReminders) {
    if (
      !reminder.include_in_daily_progress ||
      !isMeasurementReminderDue(reminder, date)
    )
      continue;
    const recordedAt =
      input.recordedMeasurements[reminder.measurement_key] ?? null;
    push({
      id: `measurement:${reminder.measurement_key}:${date}`,
      domain: "measurement",
      label: reminder.measurement_key,
      reference_id: reminder.id,
      state: recordedAt ? "complete" : "pending",
      recorded_at: recordedAt,
      reason: recordedAt ? "measurement_recorded" : "not_recorded",
    });
  }

  if (preferences.include_supplements) {
    for (const dose of input.supplementDoses) {
      push({
        id: `supplement:${dose.schedule_id}:${date}`,
        domain: "supplement",
        label: dose.label,
        reference_id: dose.schedule_id,
        state:
          dose.status === "taken"
            ? "complete"
            : dose.status === "skipped"
              ? "excluded"
              : "pending",
        recorded_at: dose.recorded_at,
        reason:
          dose.status === "taken"
            ? "dose_taken"
            : dose.status === "skipped"
              ? "dose_skipped"
              : "not_recorded",
      });
    }
  }

  if (preferences.include_meals) {
    for (const meal of input.meals) {
      const resolved = meal.state === "complete" || meal.state === "skipped";
      push({
        id: `meal:${meal.meal_type_id}:${date}`,
        domain: "meal",
        label: meal.name,
        reference_id: meal.meal_type_id,
        // A skipped meal ("no meal") resolves the tracking task.
        state: resolved
          ? "complete"
          : meal.state === "incomplete" || meal.logged_item_count > 0
            ? "started"
            : "pending",
        recorded_at: meal.updated_at,
        reason:
          meal.state === "complete"
            ? "meal_complete"
            : meal.state === "skipped"
              ? "meal_skipped"
              : meal.state === "incomplete"
                ? "meal_incomplete"
                : meal.logged_item_count > 0
                  ? "food_logged_unresolved"
                  : "not_recorded",
      });
    }
  }

  return summarizeDailyProgressItems(date, items);
}

/**
 * Totals for a list of progress items. Exported so a client can recount after
 * overlaying local, not-yet-synced records with the same rules.
 */
export function summarizeDailyProgressItems(
  date: string,
  items: DailyProgressItem[],
  version = DAILY_PROGRESS_VERSION,
): DailyProgress {
  const coverage: DailyProgress["coverage"] = {
    checkin: { applicable: 0, completed: 0 },
    habit: { applicable: 0, completed: 0 },
    measurement: { applicable: 0, completed: 0 },
    supplement: { applicable: 0, completed: 0 },
    meal: { applicable: 0, completed: 0 },
  };
  if (version >= 2 || items.some((item) => item.domain === "activity"))
    coverage.activity = { applicable: 0, completed: 0 };
  for (const item of items) {
    if (!item.applicable) continue;
    const domainCoverage = coverage[item.domain];
    if (!domainCoverage) continue;
    domainCoverage.applicable += 1;
    if (item.state === "complete") domainCoverage.completed += 1;
  }
  const applicable = items.filter((item) => item.applicable).length;
  const completed = items.filter(
    (item) => item.applicable && item.state === "complete",
  ).length;
  return {
    version,
    date,
    items,
    applicable,
    completed,
    percent: applicable === 0 ? null : (completed / applicable) * 100,
    coverage,
  };
}

/** Progression X color stage. 0% is ready (graphite), not a failure. */
export type ProgressionStage =
  "ready" | "started" | "progressing" | "completed";

export function progressionStage(percent: number | null): ProgressionStage {
  if (percent === null || percent <= 0) return "ready";
  if (percent >= 100) return "completed";
  return percent < 50 ? "started" : "progressing";
}

// --- Calendar ------------------------------------------------------------------

/**
 * Per-day state for calendar marks, derived from the same Daily Progress
 * projection as the X. "unknown" covers days the app cannot reconstruct
 * (future days, before tracking started, or definitions changed since); it
 * is never shown as zero or as complete.
 */
export type DailyProgressDayState =
  "unknown" | "none" | "not_started" | "partial" | "complete";

export interface DailyProgressDay {
  date: string;
  state: DailyProgressDayState;
  completed: number;
  applicable: number;
}

export function dayStateFromProgress(
  progress: Pick<DailyProgress, "applicable" | "completed">,
): DailyProgressDayState {
  if (progress.applicable === 0) return "none";
  if (progress.completed === 0) return "not_started";
  return progress.completed >= progress.applicable ? "complete" : "partial";
}

/** Opt-in version 2: explicit scheduled activities join the equal-weight task list. */
export function withActivityProgress(
  progress: DailyProgress,
  occurrences: readonly import("../schemas/api/ActivityPlanning.api.zod.ts").ActivityOccurrence[],
): DailyProgress {
  return summarizeDailyProgressItems(
    progress.date,
    [
      ...progress.items.filter((item) => item.domain !== "activity"),
      ...occurrences
        .filter((row) => row.date === progress.date)
        .map((row) => ({
          id: row.id,
          domain: "activity" as const,
          label: row.label,
          date: row.date,
          applicable:
            row.state !== "excluded" && row.reason !== "prescription_unknown",
          state: row.state,
          reference_id: row.source_id,
          recorded_at: row.recorded_at,
          reason: row.reason,
        })),
    ],
    2,
  );
}
