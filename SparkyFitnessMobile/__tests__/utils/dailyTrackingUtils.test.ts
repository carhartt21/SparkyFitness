import type {
  DailyCheckin,
  DailyProgress,
  Habit,
  MedicationDetail,
  MedicationEntry,
} from '@workspace/shared';
import { computeHabitTrend } from '../../src/utils/habitTrends';
import {
  daypartOf,
  groupByDaypart,
  supplementDosesFor,
  supplementStreak,
} from '../../src/utils/supplementDay';
import { overlayLocalSupplementResponses } from '../../src/utils/dailyProgressOverlay';
import { summarizeCheckins } from '../../src/utils/insights';

const habit = (overrides: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  name: 'Pull-ups',
  habit_type: 'count',
  description: null,
  unit: 'reps',
  target: 10,
  step: 1,
  days: null,
  reminder_time: null,
  active: true,
  sort_order: 0,
  icon: null,
  ...overrides,
});

const log = (entry_date: string, value: number) => ({
  habit_id: 'h1',
  entry_date,
  value,
  recorded_at: `${entry_date}T08:00:00Z`,
});

describe('computeHabitTrend', () => {
  it('keeps missing days missing and averages recorded values only', () => {
    const trend = computeHabitTrend(
      habit(),
      [log('2026-09-26', 12), log('2026-09-28', 0)],
      '2026-09-28',
      3
    );
    expect(trend.days.map((day) => day.value)).toEqual([12, null, 0]);
    expect(trend.loggedDays).toBe(2);
    expect(trend.average).toBe(6);
    expect(trend.best).toBe(12);
    expect(trend.completedDays).toBe(1);
  });

  it('does not break the streak for today while it is unrecorded', () => {
    const trend = computeHabitTrend(
      habit({ habit_type: 'completion', target: null, step: null }),
      [log('2026-09-26', 1), log('2026-09-27', 1)],
      '2026-09-28',
      7
    );
    expect(trend.currentStreak).toBe(2);
  });

  it('skips unscheduled days rather than breaking the streak', () => {
    // 2026-09-27 is a Sunday; the habit runs Monday to Saturday.
    const trend = computeHabitTrend(
      habit({
        habit_type: 'completion',
        target: null,
        step: null,
        days: [1, 2, 3, 4, 5, 6],
      }),
      [log('2026-09-26', 1), log('2026-09-28', 1)],
      '2026-09-28',
      7
    );
    expect(trend.currentStreak).toBe(2);
  });

  it('ends the streak at an explicit not-done day', () => {
    const trend = computeHabitTrend(
      habit({ habit_type: 'completion', target: null, step: null }),
      [log('2026-09-26', 1), log('2026-09-27', 0), log('2026-09-28', 1)],
      '2026-09-28',
      7
    );
    expect(trend.currentStreak).toBe(1);
  });
});

const medication = (overrides: Partial<MedicationDetail>): MedicationDetail =>
  ({
    id: 'm1',
    name: 'Vitamin D3',
    is_active: true,
    is_supplement: true,
    schedules: [
      {
        id: 's1',
        medication_id: 'm1',
        schedule_type_id: 'daily',
        time_of_day: '08:00:00',
        start_date: '2026-01-01',
        active: true,
      },
    ],
    ...overrides,
  }) as unknown as MedicationDetail;

const entry = (entry_date: string, status: string, schedule_id = 's1') =>
  ({
    id: `${entry_date}-${schedule_id}`,
    medication_id: 'm1',
    schedule_id,
    status,
    entry_date,
  }) as unknown as MedicationEntry;

describe('supplement day helpers', () => {
  it('groups by the schedule time', () => {
    expect(daypartOf('07:30:00')).toBe('morning');
    expect(daypartOf('12:00')).toBe('midday');
    expect(daypartOf('20:00')).toBe('evening');
    expect(daypartOf(null)).toBe('anytime');
  });

  it('never includes medications that are not supplements', () => {
    const doses = supplementDosesFor(
      [
        medication({}),
        medication({ id: 'rx', name: 'Prescription', is_supplement: false }),
      ],
      '2026-09-28',
      'UTC'
    );
    expect(doses.map((dose) => dose.medication.name)).toEqual(['Vitamin D3']);
    expect(groupByDaypart(doses).map((group) => group.daypart)).toEqual([
      'morning',
    ]);
  });

  it('counts consecutive fully taken days and ignores an open today', () => {
    const streak = supplementStreak({
      medications: [medication({})],
      entries: [entry('2026-09-26', 'taken'), entry('2026-09-27', 'taken')],
      today: '2026-09-28',
      timezone: 'UTC',
      lookbackDays: 10,
    });
    expect(streak).toBe(2);
  });

  it('stops at a skipped dose', () => {
    const streak = supplementStreak({
      medications: [medication({})],
      entries: [entry('2026-09-26', 'skipped'), entry('2026-09-27', 'taken')],
      today: '2026-09-28',
      timezone: 'UTC',
      lookbackDays: 10,
    });
    expect(streak).toBe(1);
  });
});

describe('overlayLocalSupplementResponses', () => {
  const progress: DailyProgress = {
    version: 1,
    date: '2026-09-28',
    applicable: 2,
    completed: 0,
    percent: 0,
    coverage: {
      checkin: { applicable: 1, completed: 0 },
      habit: { applicable: 0, completed: 0 },
      measurement: { applicable: 0, completed: 0 },
      supplement: { applicable: 1, completed: 0 },
      meal: { applicable: 0, completed: 0 },
    },
    items: [
      {
        id: 'checkin:2026-09-28',
        domain: 'checkin',
        label: 'Daily check-in',
        date: '2026-09-28',
        applicable: true,
        state: 'pending',
        reference_id: null,
        recorded_at: null,
        reason: 'not_recorded',
      },
      {
        id: 'supplement:s1:2026-09-28',
        domain: 'supplement',
        label: 'Vitamin D3',
        date: '2026-09-28',
        applicable: true,
        state: 'pending',
        reference_id: 's1',
        recorded_at: null,
        reason: 'not_recorded',
      },
    ],
  };

  it('counts a dose taken offline before it syncs', () => {
    const result = overlayLocalSupplementResponses(progress, [
      { scheduleId: 's1', status: 'taken', occurredAt: '2026-09-28T08:01:00Z' },
    ]);
    expect(result.completed).toBe(1);
    expect(result.applicable).toBe(2);
    expect(result.percent).toBe(50);
  });

  it('removes a dose skipped offline from the denominator', () => {
    const result = overlayLocalSupplementResponses(progress, [
      {
        scheduleId: 's1',
        status: 'skipped',
        occurredAt: '2026-09-28T08:01:00Z',
      },
    ]);
    expect(result.applicable).toBe(1);
    expect(result.completed).toBe(0);
  });

  it('returns the server projection unchanged without local responses', () => {
    expect(overlayLocalSupplementResponses(progress, [])).toBe(progress);
  });
});

describe('summarizeCheckins', () => {
  const checkin = (overrides: Partial<DailyCheckin>): DailyCheckin => ({
    id: 'c',
    entry_date: '2026-09-28',
    state: 'completed',
    question_version: 1,
    overall_day: null,
    energy: null,
    stress: null,
    sleep_quality: null,
    nutrition_on_track: null,
    activity: null,
    note: null,
    tags: [],
    completed_at: 't',
    skipped_at: null,
    updated_at: 't',
    ...overrides,
  });

  it('uses explicit denominators and never treats missing answers as zero', () => {
    const summary = summarizeCheckins(
      [
        checkin({ overall_day: 4, energy: 5 }),
        checkin({ overall_day: 2 }),
        checkin({ state: 'skipped', completed_at: null }),
        checkin({ state: 'draft', energy: 1, completed_at: null }),
      ],
      30
    );
    expect(summary).toMatchObject({
      totalDays: 30,
      completedDays: 2,
      skippedDays: 1,
      overallAverage: 3,
      overallAnswered: 2,
    });
    expect(summary.answers.find((answer) => answer.key === 'energy')).toEqual({
      key: 'energy',
      average: 5,
      answered: 1,
    });
    expect(
      summary.answers.find((answer) => answer.key === 'stress')?.average
    ).toBeNull();
  });
});
