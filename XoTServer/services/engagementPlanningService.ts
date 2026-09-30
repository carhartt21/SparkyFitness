import type { PoolClient } from 'pg';
import {
  deriveEngagementPlan,
  instantToDay,
  dayToUtcRange,
  localDateTimeToUtc,
  isHabitDue,
  habitDayState,
  isMeasurementReminderDue,
  type EngagementFacts,
  type EngagementPlanSlot,
} from '@workspace/shared';
import measurementRepository from '../models/measurementRepository.js';
import foodRepository from '../models/foodMisc.js';
import preferenceRepository from '../models/preferenceRepository.js';
import { getClient } from '../db/poolManager.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { getEngagementSettingsV2 } from './engagementService.js';
import { getMobilitySnapshot } from './mobilityService.js';
import {
  getDailyTrackingPreferences,
  getDailyCheckin,
  listHabits,
  listHabitLogs,
  listMeasurementReminders,
  recordedMeasurementsOn,
  listMealStatuses,
} from '../models/dailyTrackingRepository.js';
export async function engagementPlanForUser(userId: string, now = new Date()) {
  const [timezone, settings] = await Promise.all([
    loadUserTimezone(userId),
    getEngagementSettingsV2(userId),
  ]);
  const day = instantToDay(now, timezone);
  const range = dayToUtcRange(day, timezone);
  const [
    preferences,
    checkin,
    habits,
    logs,
    reminders,
    recorded,
    meals,
    mobility,
  ] = await Promise.all([
    getDailyTrackingPreferences(userId),
    getDailyCheckin(userId, day),
    listHabits(userId),
    listHabitLogs(userId, day, day),
    listMeasurementReminders(userId),
    recordedMeasurementsOn(userId, day, ['weight']),
    listMealStatuses(userId, day),
    getMobilitySnapshot(userId, day, day),
  ]);
  const [waterTotal, waterPreferences] = await Promise.all([
    measurementRepository.getWaterIntakeByDate(userId, day),
    preferenceRepository.getUserPreferences(userId),
  ]);
  const foodWater = waterPreferences?.add_food_water_to_intake
    ? await foodRepository.getFoodDerivedWaterMlForDate(userId, day)
    : 0;
  const effectiveWater = Number(waterTotal?.water_ml ?? 0) + foodWater;
  const client: PoolClient = await getClient(userId, userId);
  let facts: EngagementFacts;
  try {
    const values = await client.query(
      `SELECT
      (SELECT jsonb_agg(entry_time) FROM food_entries WHERE user_id=$1 AND entry_date=$2) AS food_times,
      (SELECT jsonb_agg(consumed_at) FROM nutrition_captures WHERE user_id=$1 AND entry_date=$2) AS capture_times,
      (SELECT count(*) FROM nutrition_captures WHERE user_id=$1 AND entry_date=$2 AND completion_state='incomplete') AS photos,
      (SELECT max(logged_at) FROM water_intake_entries WHERE user_id=$1 AND entry_date=$2 AND water_ml>0) AS latest_drink,
      (SELECT sum(water_ml * COALESCE(hydration_factor,1)) FROM water_intake_entries WHERE user_id=$1 AND entry_date=$2) AS water,
      (SELECT water_goal_ml FROM user_goals WHERE user_id=$1 AND (goal_date<=$2 OR goal_date IS NULL) ORDER BY goal_date DESC NULLS LAST,updated_at DESC LIMIT 1) AS goal,
      EXISTS(SELECT 1 FROM engagement_subject_states WHERE user_id=$1 AND started_at >= $3 AND started_at < $4) AS movement_started,
      EXISTS(SELECT 1 FROM health_context_periods WHERE user_id=$1 AND pause_discretionary_reminders AND start_date<=$2 AND (end_date IS NULL OR end_date>=$2)) AS paused`,
      [userId, day, range.start, range.end]
    );
    const row = values.rows[0] as {
      food_times: Array<string | null> | null;
      capture_times: string[] | null;
      photos: string;
      latest_drink: Date | null;
      water: string | null;
      goal: number | null;
      movement_started: boolean;
      paused: boolean;
    };
    facts = {
      paused: row.paused,
      capturedTimes: row.food_times?.some((time) => time === null)
        ? null
        : [
            ...(row.food_times ?? []).map((time) =>
              localDateTimeToUtc(`${day}T${time}`, timezone).toISOString()
            ),
            ...(row.capture_times ?? []),
          ],
      resolvedMealTimes: meals
        .filter(
          (meal) => meal.status === 'complete' || meal.status === 'skipped'
        )
        .map((meal) => meal.default_time)
        .filter((time): time is string => !!time),
      pendingPhotoCount: Number(row.photos),
      water: {
        latestAt: row.latest_drink?.toISOString() ?? null,
        goalMet: row.goal === null ? null : effectiveWater >= Number(row.goal),
      },
      movementStarted: row.movement_started,
      subjects: [],
    };
  } finally {
    client.release();
  }
  facts.subjects.push({
    kind: 'check_in',
    id: 'daily',
    time: preferences.checkin_reminder_time,
    enabled: preferences.checkin_reminder_enabled,
    resolved: checkin?.state === 'completed' || checkin?.state === 'skipped',
  });
  for (const habit of habits)
    if (habit.reminder_time)
      facts.subjects.push({
        kind: 'habit',
        id: habit.id,
        time: habit.reminder_time,
        enabled: preferences.habit_reminders_enabled && isHabitDue(habit, day),
        resolved:
          habitDayState(
            habit,
            logs.find((log) => log.habit_id === habit.id)
          ) !== 'not_recorded',
      });
  for (const reminder of reminders)
    if (reminder.measurement_key === 'weight')
      facts.subjects.push({
        kind: 'weigh_in',
        id: reminder.id,
        time: reminder.reminder_time,
        enabled: isMeasurementReminderDue(reminder, day),
        resolved: recorded.weight !== undefined,
      });
  for (const { data: plan, deleted } of mobility.plans)
    if (!deleted)
      facts.subjects.push({
        kind: 'mobility',
        id: plan.id,
        time: plan.time,
        enabled: true,
        resolved: plan.state !== 'planned',
      });
  const derived = deriveEngagementPlan({ now, timezone, settings, facts });
  return { ...derived, settings, timezone, day };
}
export function sameEngagementSlot(
  slot: EngagementPlanSlot,
  row: { kind: string; subject_id: string; scheduled_at: Date }
): boolean {
  return (
    slot.kind === row.kind &&
    slot.subjectId === row.subject_id &&
    Math.abs(slot.preferredAt - row.scheduled_at.getTime()) <= 20 * 60_000
  );
}

export function occurrenceEligible(
  plan: Awaited<ReturnType<typeof engagementPlanForUser>>,
  row: {
    kind: string;
    subject_id: string;
    scheduled_at: Date;
    slot_key: string;
  }
): boolean {
  if (row.slot_key.includes(':snooze:'))
    return (
      row.slot_key.includes(`:${plan.day}:`) &&
      plan.unresolvedSubjects.some(
        (subject) =>
          subject.kind === row.kind && subject.subjectId === row.subject_id
      )
    );
  return plan.candidates.some(
    (slot) => slot.id === row.slot_key && sameEngagementSlot(slot, row)
  );
}
