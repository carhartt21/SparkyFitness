import {
  buildDailyProgress,
  getDueDosesForDate,
  summarizeMealCoverage,
  type DailyProgress,
  type DailyProgressInput,
  type MealTrackingStatus,
  type SharedMedication,
} from '@workspace/shared';
import medicationRepository from '../models/medicationRepository.js';
import medicationEntryRepository from '../models/medicationEntryRepository.js';
import {
  getDailyCheckin,
  getDailyTrackingPreferences,
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
  date: string
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
  return {
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
  date: string
): Promise<DailyProgress> {
  return buildDailyProgress(await getDailyProgressInput(userId, date));
}
