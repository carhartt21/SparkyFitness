import {
  buildDailyProgress,
  DEFAULT_DAILY_TRACKING_PREFERENCES,
  type DailyCheckin,
  type Habit,
  type HabitLog,
  type MedicationDetail,
  type MedicationEntry,
} from '@workspace/shared';

// Synthetic daily tracking records for the UI review. Names, amounts and
// times are illustrations for layout checks only, never app defaults.

const dayOffset = (day: string, offset: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const HABITS: Habit[] = [
  {
    id: 'review-habit-mobility',
    name: 'Mobility',
    habit_type: 'completion',
    description: '5–10 min',
    unit: null,
    target: null,
    step: null,
    days: null,
    reminder_time: '08:00',
    active: true,
    sort_order: 0,
    icon: 'exercise-running',
  },
  {
    id: 'review-habit-pullups',
    name: 'Morning pull-ups',
    habit_type: 'count',
    description: 'Build upper body',
    unit: 'reps',
    target: 12,
    step: null,
    days: null,
    reminder_time: '08:00',
    active: true,
    sort_order: 1,
    icon: 'exercise-weights',
  },
  {
    id: 'review-habit-reading',
    name: 'Reading',
    habit_type: 'count',
    description: null,
    unit: 'pages',
    target: 10,
    step: 5,
    days: null,
    reminder_time: null,
    active: true,
    sort_order: 2,
    icon: 'book',
  },
  {
    id: 'review-habit-stretching',
    name: 'Evening stretching',
    habit_type: 'completion',
    description: 'Wind down',
    unit: null,
    target: null,
    step: null,
    days: null,
    reminder_time: '19:00',
    active: true,
    sort_order: 3,
    icon: 'moon',
  },
];

function habitLogs(today: string): HabitLog[] {
  const logs: HabitLog[] = [];
  for (let offset = 0; offset < 90; offset += 1) {
    const date = dayOffset(today, -offset);
    // Every fifth day has no record at all; the chart must show a gap.
    if (offset % 5 === 4) continue;
    logs.push({
      habit_id: 'review-habit-mobility',
      entry_date: date,
      value: 1,
      recorded_at: `${date}T07:30:00Z`,
    });
    if (offset > 0) {
      logs.push({
        habit_id: 'review-habit-pullups',
        entry_date: date,
        value: 8 + ((offset * 3) % 9),
        recorded_at: `${date}T08:10:00Z`,
      });
    }
    if (offset > 0 && offset % 3 !== 0) {
      logs.push({
        habit_id: 'review-habit-stretching',
        entry_date: date,
        value: 1,
        recorded_at: `${date}T19:20:00Z`,
      });
    }
  }
  return logs;
}

const schedule = (
  id: string,
  medicationId: string,
  time: string,
  withMeal: string | null = null
) => ({
  id,
  medication_id: medicationId,
  user_id: 'review-user',
  schedule_type_id: 'daily',
  time_of_day: time,
  dose_amount: null,
  days_of_week: null,
  interval_days: null,
  day_of_month: null,
  cycle_on_days: null,
  cycle_off_days: null,
  with_meal: withMeal,
  prn_reason: null,
  prn_max_per_day: null,
  start_date: '2026-01-01',
  end_date: null,
  active: true,
  source: 'manual',
  custom_fields: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const supplement = (
  id: string,
  name: string,
  doseAmount: number,
  doseUnit: string,
  schedules: ReturnType<typeof schedule>[]
) =>
  ({
    id,
    user_id: 'review-user',
    name,
    display_name: null,
    type_id: 'capsule',
    route_id: null,
    strength_value: null,
    strength_unit: null,
    dose_amount: doseAmount,
    dose_unit: doseUnit,
    is_active: true,
    is_quick: false,
    is_glp1: false,
    is_supplement: true,
    nutrients: {},
    notes: null,
    source: 'manual',
    custom_fields: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    schedules,
  }) as unknown as MedicationDetail;

const SUPPLEMENTS: MedicationDetail[] = [
  supplement('review-supp-a', 'Vitamin D3', 1, 'capsule', [
    schedule('review-sched-a', 'review-supp-a', '08:00:00', 'with'),
  ]),
  supplement('review-supp-b', 'Omega-3', 2, 'capsule', [
    schedule('review-sched-b', 'review-supp-b', '08:00:00'),
  ]),
  supplement('review-supp-c', 'Multivitamin', 1, 'tablet', [
    schedule('review-sched-c', 'review-supp-c', '12:00:00'),
  ]),
  supplement('review-supp-d', 'Magnesium', 1, 'tablet', [
    schedule('review-sched-d', 'review-supp-d', '20:00:00'),
  ]),
];

function supplementEntries(today: string): MedicationEntry[] {
  const entries: MedicationEntry[] = [];
  for (let offset = 0; offset < 60; offset += 1) {
    const date = dayOffset(today, -offset);
    const taken =
      offset === 0
        ? ['a', 'b']
        : offset < 5
          ? ['a', 'b', 'c', 'd']
          : ['a', 'b', 'c'];
    for (const key of taken) {
      entries.push({
        id: `review-entry-${key}-${date}`,
        medication_id: `review-supp-${key}`,
        schedule_id: `review-sched-${key}`,
        user_id: 'review-user',
        status: 'taken',
        taken_at: `${date}T08:05:00Z`,
        scheduled_for: null,
        entry_date: date,
        med_name_snapshot: null,
        dose_amount_snapshot: null,
        dose_unit_snapshot: null,
        notes: null,
        source: 'manual',
        custom_fields: {},
        created_at: `${date}T08:05:00Z`,
        updated_at: `${date}T08:05:00Z`,
      } as unknown as MedicationEntry);
    }
  }
  return entries;
}

function checkin(date: string, today: string): DailyCheckin | null {
  if (date === today) return null;
  return {
    id: `review-checkin-${date}`,
    entry_date: date,
    state: 'completed',
    question_version: 1,
    overall_day: 4,
    energy: 3,
    stress: 2,
    sleep_quality: 4,
    nutrition_on_track: 4,
    activity: 3,
    note: null,
    tags: ['good_routine'],
    completed_at: `${date}T21:00:00Z`,
    skipped_at: null,
    updated_at: `${date}T21:00:00Z`,
  };
}

/** Responses for /api/v2/tracking/* and supplement reads; null when unhandled. */
export function trackingReviewResponse(
  path: string,
  scenario: string,
  today: string
): unknown {
  const populated = scenario === 'populated';
  if (path === '/api/v2/medications') return populated ? SUPPLEMENTS : [];
  if (path === '/api/v2/medications/entries')
    return populated ? supplementEntries(today) : [];
  if (!path.startsWith('/api/v2/tracking/')) return undefined;
  const rest = path.slice('/api/v2/tracking/'.length);
  if (rest === 'preferences') return DEFAULT_DAILY_TRACKING_PREFERENCES;
  if (rest === 'context-periods') return [];
  if (rest === 'measurement-reminders') return [];
  if (rest === 'habits') return populated ? HABITS : [];
  if (rest === 'habit-logs') return populated ? habitLogs(today) : [];
  if (rest === 'checkins') return [];
  if (rest.startsWith('checkins/'))
    return populated ? checkin(rest.slice('checkins/'.length), today) : null;
  if (rest.startsWith('meal-status/')) {
    const date = rest.slice('meal-status/'.length);
    return {
      entry_date: date,
      meals: [],
      coverage: {
        total: 0,
        resolved: 0,
        complete: 0,
        skipped: 0,
        incomplete: 0,
        pending: 0,
      },
    };
  }
  if (rest.startsWith('daily-progress/')) {
    const date = rest.slice('daily-progress/'.length);
    return buildDailyProgress({
      date,
      preferences: DEFAULT_DAILY_TRACKING_PREFERENCES,
      checkin: populated ? checkin(date, today) : null,
      habits: populated ? HABITS : [],
      habitLogs: populated ? habitLogs(today) : [],
      measurementReminders: [],
      recordedMeasurements: {},
      supplementDoses: populated
        ? SUPPLEMENTS.map((item, index) => ({
            schedule_id: `review-sched-${'abcd'[index]}`,
            medication_id: item.id,
            label: item.name,
            status: date === today && index > 1 ? null : 'taken',
            recorded_at: null,
          }))
        : [],
      meals: [],
    });
  }
  return undefined;
}
