import { addDays, dayOfWeek } from "./utils/timezone.ts";
import type {
  ActivityOccurrence,
  ActivityRecord,
} from "./schemas/api/ActivityPlanning.api.zod.ts";
/** Monday-first local calendar week, without converting the day to an instant. */
export function activityWeekRange(day: string) {
  const start_date = addDays(day, -((dayOfWeek(day) + 6) % 7));
  return { start_date, end_date: addDays(start_date, 6) };
}
export function linkableActivityRecords(
  occurrence: ActivityOccurrence,
  records: readonly ActivityRecord[],
) {
  return records.filter(
    (record) =>
      record.date === occurrence.date &&
      record.confirmed &&
      record.origin_assignment_ids.length === 0 &&
      (!record.linked_occurrence_id ||
        record.linked_occurrence_id === occurrence.id),
  );
}
