import type {
  CreateHabitRequest,
  Habit,
  HabitLog,
  LogHabitRequest,
} from "../schemas/api/DailyTracking.api.zod.ts";

export function isWellnessActivity(habit: Pick<Habit, "category">): boolean {
  return habit.category === "wellness";
}

export function wellnessActivityRequest(name: string): CreateHabitRequest {
  return {
    name: name.trim(),
    category: "wellness",
    habit_type: "completion",
    days: [],
    reminder_time: null,
  };
}

/** Reuse a saved activity on later days, including after a failed log request. */
export async function recordWellnessActivity(input: {
  name: string;
  date: string;
  habits: readonly Habit[];
  create: (body: CreateHabitRequest) => Promise<Habit>;
  log: (id: string, body: LogHabitRequest) => Promise<HabitLog | null>;
}): Promise<HabitLog | null> {
  const name = input.name.trim();
  if (!name || name.length > 50)
    throw new Error("Activity names must contain 1–50 characters.");
  const existing = input.habits.find(
    (habit) =>
      isWellnessActivity(habit) &&
      habit.name.normalize("NFC").toLowerCase() ===
        name.normalize("NFC").toLowerCase(),
  );
  const activity =
    existing ?? (await input.create(wellnessActivityRequest(name)));
  return input.log(activity.id, { entry_date: input.date, value: true });
}

export interface WellnessEntry {
  activityId: string;
  name: string;
  date: string;
}

/** Missing and explicitly false records do not mean an activity happened. */
export function wellnessEntries(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
): WellnessEntry[] {
  const activities = new Map(
    habits.filter(isWellnessActivity).map((habit) => [habit.id, habit]),
  );
  return logs
    .flatMap((log) => {
      const activity = activities.get(log.habit_id);
      return activity && log.value > 0
        ? [
            {
              activityId: activity.id,
              name: activity.name,
              date: log.entry_date,
            },
          ]
        : [];
    })
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name),
    );
}
