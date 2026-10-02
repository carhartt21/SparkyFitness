import { readProgressObjectives } from '../models/dailyProgressObjectives.js';
import { getActivityPlanning } from './activityPlanningService.js';
import { withActivityProgress } from '@workspace/shared';
import {
  addDays,
  buildDailyProgress,
  dayStateFromProgress,
  getDueDosesForDate,
  instantToDay,
  summarizeMealCoverage,
  todayInZone,
  type DailyProgressDay,
  type DailyProgress,
  type DailyProgressInput,
  type MealTrackingStatus,
  type SharedMedication,
} from '@workspace/shared';
import medicationRepository from '../models/medicationRepository.js';
import medicationEntryRepository from '../models/medicationEntryRepository.js';
import {
  firstDailyCheckinDate,
  getDailyCheckin,
  getDailyTrackingPreferences,
  getDailyTrackingPreferencesUpdatedAt,
  listDailyCheckins,
  listHabitDefinitionsWithHistory,
  listMealActivityInRange,
  listMeasurementRemindersWithHistory,
  recordedWeightsInRange,
  recordedCustomMeasurementsInRange,
  listHabitLogs,
  listHabits,
  listMealStatuses,
  listMeasurementReminders,
  recordedMeasurementsOn,
} from '../models/dailyTrackingRepository.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';

interface SupplementMedication extends SharedMedication {
  id: string;
  name: string;
  display_name: string | null;
  is_supplement: boolean;
  dose_amount: number | string | null;
  dose_unit: string | null;
}

interface MedicationEntryRow {
  schedule_id: string | null;
  status: string;
  entry_date: Date | string;
  taken_at: Date | string;
  updated_at: Date | string;
}

export interface SupplementDose {
  schedule_id: string;
  medication_id: string;
  label: string;
  time_of_day: string | null;
  dose_amount: number | null;
  dose_unit: string | null;
  status: 'taken' | 'skipped' | null;
  recorded_at: string | null;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Scheduled supplement doses for a day with their explicit record. Only
 * medications flagged is_supplement are read, so no medication data leaks
 * into supplement views. PRN items are never scheduled tasks.
 */
export async function getSupplementDoses(
  userId: string,
  date: string,
  timezone?: string
): Promise<SupplementDose[]> {
  const tz = timezone ?? (await loadUserTimezone(userId));
  const medications = (await medicationRepository.listMedications(userId, {
    activeOnly: true,
  })) as SupplementMedication[];
  const supplements = medications.filter((med) => med.is_supplement);
  if (supplements.length === 0) return [];
  const due = getDueDosesForDate(supplements, date, tz);
  const entries = (await medicationEntryRepository.listEntries(userId, {
    fromDate: date,
    toDate: date,
  })) as MedicationEntryRow[];
  const bySchedule = new Map<string, MedicationEntryRow>();
  for (const entry of entries) {
    if (!entry.schedule_id) continue;
    if (entry.status !== 'taken' && entry.status !== 'skipped') continue;
    bySchedule.set(entry.schedule_id, entry);
  }
  return due.map(({ medication, schedule }) => {
    const entry = bySchedule.get(schedule.id);
    const amount = schedule.dose_amount ?? medication.dose_amount;
    return {
      schedule_id: schedule.id,
      medication_id: medication.id,
      label: medication.display_name || medication.name,
      time_of_day: schedule.time_of_day
        ? schedule.time_of_day.slice(0, 5)
        : null,
      dose_amount:
        amount === null || amount === undefined ? null : Number(amount),
      dose_unit: medication.dose_unit,
      status: entry ? (entry.status as 'taken' | 'skipped') : null,
      recorded_at: entry ? toIso(entry.updated_at ?? entry.taken_at) : null,
    };
  });
}

export async function getMealTrackingStatus(
  userId: string,
  date: string
): Promise<MealTrackingStatus> {
  const rows = await listMealStatuses(userId, date);
  const meals = rows.map((row) => ({
    meal_type_id: row.meal_type_id,
    name: row.name,
    state: row.status ?? ('pending' as const),
    logged_item_count: row.logged_item_count,
    updated_at: row.updated_at,
  }));
  return { entry_date: date, meals, coverage: summarizeMealCoverage(meals) };
}

export async function getDailyProgressInput(
  userId: string,
  date: string,
  includeObjectives = false
): Promise<DailyProgressInput> {
  const [preferences, checkin, habits, habitLogs, reminders] =
    await Promise.all([
      getDailyTrackingPreferences(userId),
      getDailyCheckin(userId, date),
      listHabits(userId),
      listHabitLogs(userId, date, date),
      listMeasurementReminders(userId),
    ]);
  const [recordedMeasurements, supplementDoses, mealStatus] = await Promise.all(
    [
      recordedMeasurementsOn(
        userId,
        date,
        reminders
          .filter((reminder) => reminder.include_in_daily_progress)
          .map((reminder) => reminder.measurement_key)
      ),
      preferences.include_supplements
        ? getSupplementDoses(userId, date)
        : Promise.resolve([]),
      preferences.include_meals
        ? getMealTrackingStatus(userId, date)
        : Promise.resolve(null),
    ]
  );
  const objectives = includeObjectives
    ? await readProgressObjectives(
        userId,
        date,
        Boolean(
          mealStatus &&
          mealStatus.coverage.total > 0 &&
          mealStatus.coverage.resolved === mealStatus.coverage.total
        )
      )
    : {};
  return {
    ...objectives,
    date,
    preferences,
    checkin,
    habits,
    habitLogs,
    measurementReminders: reminders,
    recordedMeasurements,
    supplementDoses,
    meals: mealStatus?.meals ?? [],
  };
}

export async function getDailyProgress(
  userId: string,
  date: string,
  includeObjectives = false
): Promise<DailyProgress> {
  const base = buildDailyProgress(
    await getDailyProgressInput(userId, date, includeObjectives)
  );
  return includeObjectives
    ? withActivityProgress(
        base,
        (await getActivityPlanning(userId, date, date)).occurrences
      )
    : base;
}

interface ScheduleWithHistory {
  id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface SupplementWithHistory extends SupplementMedication {
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  schedules: (NonNullable<SupplementMedication['schedules']>[number] &
    ScheduleWithHistory)[];
}

/** Longest calendar range read in one request (a six-week month grid). */
export const DAILY_PROGRESS_RANGE_MAX_DAYS = 42;

/**
 * Daily Progress for each day of a calendar range, using the same projection
 * as the X. A past day is reconstructed only from definitions that existed
 * unchanged on that day; if a habit, reminder, supplement schedule or the
 * tracking preferences changed afterwards, or the day predates any tracking,
 * the day is "unknown" rather than guessed. Future days are unknown.
 */
export async function getDailyProgressRange(
  userId: string,
  startDate: string,
  endDate: string,
  includeObjectives = false
): Promise<DailyProgressDay[]> {
  const tz = await loadUserTimezone(userId);
  const today = todayInZone(tz);
  const dayOf = (value: Date | string) =>
    instantToDay(value instanceof Date ? value : new Date(value), tz);

  const [
    preferences,
    preferencesUpdatedAt,
    habits,
    habitLogs,
    checkins,
    firstCheckin,
    reminders,
    weights,
    medications,
    entries,
  ] = await Promise.all([
    getDailyTrackingPreferences(userId),
    getDailyTrackingPreferencesUpdatedAt(userId),
    listHabitDefinitionsWithHistory(userId),
    listHabitLogs(userId, startDate, endDate),
    listDailyCheckins(userId, startDate, endDate),
    firstDailyCheckinDate(userId),
    listMeasurementRemindersWithHistory(userId),
    recordedWeightsInRange(userId, startDate, endDate),
    medicationRepository.listMedications(userId) as Promise<
      SupplementWithHistory[]
    >,
    medicationEntryRepository.listEntries(userId, {
      fromDate: startDate,
      toDate: endDate,
    }) as Promise<MedicationEntryRow[]>,
  ]);
  const supplements = medications.filter((med) => med.is_supplement);
  const customMeasurements = await recordedCustomMeasurementsInRange(
    userId,
    startDate,
    endDate,
    reminders
      .filter((reminder) => reminder.include_in_daily_progress)
      .map((reminder) => reminder.measurement_key)
  );
  const meals = preferences.include_meals
    ? await Promise.all([
        getMealTrackingStatus(userId, startDate),
        listMealActivityInRange(userId, startDate, endDate),
      ])
    : null;

  // The first day anything tracked existed; earlier days are unknown.
  const starts = [
    firstCheckin,
    preferencesUpdatedAt ? dayOf(preferencesUpdatedAt) : null,
    ...habits.map((habit) => dayOf(habit.created_at)),
    ...reminders.map((reminder) => dayOf(reminder.created_at)),
    ...supplements.flatMap((med) =>
      med.schedules.map((schedule) => dayOf(schedule.created_at))
    ),
  ].filter((day): day is string => Boolean(day));
  const trackingStart = starts.length > 0 ? starts.sort()[0] : null;

  // True when a definition that applied on `day` was edited afterwards.
  const changedAfter = (day: string) =>
    (preferencesUpdatedAt !== null && dayOf(preferencesUpdatedAt) > day) ||
    habits.some(
      (habit) => dayOf(habit.created_at) <= day && dayOf(habit.updated_at) > day
    ) ||
    reminders.some(
      (reminder) =>
        dayOf(reminder.created_at) <= day && dayOf(reminder.updated_at) > day
    ) ||
    supplements.some(
      (med) =>
        (dayOf(med.created_at) <= day && dayOf(med.updated_at) > day) ||
        med.schedules.some(
          (schedule) =>
            dayOf(schedule.created_at) <= day &&
            dayOf(schedule.updated_at) > day
        )
    );

  const activity = includeObjectives
    ? await getActivityPlanning(userId, startDate, endDate)
    : null;
  const days: DailyProgressDay[] = [];
  for (let day = startDate; day <= endDate; day = addDays(day, 1)) {
    if (
      day > today ||
      activity?.occurrences.some(
        (row) => row.date === day && row.reason === 'prescription_unknown'
      ) ||
      (day < today &&
        (trackingStart === null || day < trackingStart || changedAfter(day)))
    ) {
      days.push({ date: day, state: 'unknown', completed: 0, applicable: 0 });
      continue;
    }
    const dayEntries = entries.filter(
      (entry) =>
        (entry.entry_date instanceof Date
          ? dayOf(entry.entry_date)
          : String(entry.entry_date).slice(0, 10)) === day
    );
    const bySchedule = new Map<string, MedicationEntryRow>();
    for (const entry of dayEntries) {
      if (
        entry.schedule_id &&
        (entry.status === 'taken' || entry.status === 'skipped')
      )
        bySchedule.set(entry.schedule_id, entry);
    }
    const supplementDoses = getDueDosesForDate(
      supplements.filter((med) => med.is_active),
      day,
      tz
    ).map(({ medication, schedule }) => {
      const entry = bySchedule.get(schedule.id);
      return {
        schedule_id: schedule.id,
        medication_id: medication.id,
        label: medication.display_name || medication.name,
        status: entry ? (entry.status as 'taken' | 'skipped') : null,
        recorded_at: entry ? toIso(entry.updated_at ?? entry.taken_at) : null,
      };
    });
    const checkin = checkins.find((item) => item.entry_date === day) ?? null;
    const objectives = includeObjectives
      ? await readProgressObjectives(
          userId,
          day,
          Boolean(
            meals &&
            meals[0].meals.length > 0 &&
            meals[0].meals.every((meal) => {
              const status = meals[1].find(
                (row) =>
                  row.entry_date === day &&
                  row.meal_type_id === meal.meal_type_id
              )?.status;
              return status === 'complete' || status === 'skipped';
            })
          )
        )
      : {};
    const progress = buildDailyProgress({
      ...objectives,
      date: day,
      preferences: {
        ...preferences,
        // Keep historical days conservative; today uses the same enabled
        // check-in preference as the single-day progress summary.
        include_checkin:
          preferences.include_checkin &&
          (day === today || (firstCheckin !== null && day >= firstCheckin)),
      },
      checkin,
      habits: habits.filter((habit) => dayOf(habit.created_at) <= day),
      habitLogs,
      measurementReminders: reminders.filter(
        (reminder) => dayOf(reminder.created_at) <= day
      ),
      recordedMeasurements: {
        ...(weights[day] ? { weight: weights[day] } : {}),
        ...customMeasurements[day],
      },
      supplementDoses: preferences.include_supplements ? supplementDoses : [],
      meals: meals
        ? meals[0].meals.map((meal) => {
            const activity = meals[1].find(
              (row) =>
                row.entry_date === day && row.meal_type_id === meal.meal_type_id
            );
            return {
              meal_type_id: meal.meal_type_id,
              name: meal.name,
              state: activity?.status ?? 'pending',
              logged_item_count: activity?.logged_item_count ?? 0,
              updated_at: activity?.updated_at ?? null,
            };
          })
        : [],
    });
    const combined = activity
      ? withActivityProgress(progress, activity.occurrences)
      : progress;
    days.push({
      date: day,
      state: dayStateFromProgress(combined),
      completed: combined.completed,
      applicable: combined.applicable,
    });
  }
  return days;
}
