import {
  getDueDosesForDate,
  type MedicationDetail,
  type MedicationEntry,
} from '@workspace/shared';
import { addDays } from './dateUtils';
import { doseSlotStatus, entryMatchesDose, type DueDose } from './medications';

export type Daypart = 'morning' | 'midday' | 'evening' | 'anytime';

export const DAYPART_ORDER: readonly Daypart[] = [
  'morning',
  'midday',
  'evening',
  'anytime',
];

/** The schedule's own time decides the group; untimed doses are "any time". */
export function daypartOf(timeOfDay: string | null | undefined): Daypart {
  if (!timeOfDay) return 'anytime';
  const hour = Number(timeOfDay.slice(0, 2));
  if (!Number.isFinite(hour)) return 'anytime';
  if (hour < 11) return 'morning';
  if (hour < 17) return 'midday';
  return 'evening';
}

/** Scheduled supplement doses only; medications never appear here. */
export function supplementDosesFor(
  medications: readonly MedicationDetail[],
  date: string,
  timezone: string
): DueDose[] {
  return getDueDosesForDate(
    medications.filter((medication) => medication.is_supplement === true),
    date,
    timezone
  );
}

export function groupByDaypart(doses: readonly DueDose[]) {
  const groups = new Map<Daypart, DueDose[]>();
  for (const dose of doses) {
    const part = daypartOf(dose.schedule.time_of_day);
    groups.set(part, [...(groups.get(part) ?? []), dose]);
  }
  return DAYPART_ORDER.filter((part) => groups.has(part)).map((part) => ({
    daypart: part,
    doses: groups.get(part) ?? [],
  }));
}

/**
 * Days in a row on which every scheduled supplement dose was recorded as
 * taken, counting back from `today`. Days without a scheduled dose are
 * skipped; today only counts once complete and never breaks the run.
 * Bounded by `lookbackDays` (the entries the caller loaded).
 */
export function supplementStreak(input: {
  medications: readonly MedicationDetail[];
  entries: readonly MedicationEntry[];
  today: string;
  timezone: string;
  lookbackDays: number;
}): number {
  let streak = 0;
  for (let offset = 0; offset < input.lookbackDays; offset += 1) {
    const day = addDays(input.today, -offset);
    const doses = supplementDosesFor(input.medications, day, input.timezone);
    if (doses.length === 0) continue;
    const dayEntries = input.entries.filter(
      (entry) => entry.entry_date === day
    );
    const allTaken = doses.every(
      (dose) =>
        doseSlotStatus(
          dayEntries.find((entry) =>
            entryMatchesDose(entry, dose.medication.id, dose.schedule.id)
          )
        ) === 'taken'
    );
    if (allTaken) {
      streak += 1;
      continue;
    }
    if (offset === 0) continue;
    break;
  }
  return streak;
}
