import { describe, expect, it } from 'vitest';
import {
  buildDailyProgress,
  discretionaryRemindersPaused,
  favourableShare,
  habitDayState,
  hasCheckinResponse,
  isHabitDue,
  progressionStage,
  summarizeMealCoverage,
  weekdayOfDay,
  type DailyProgressInput,
  type Habit,
} from '@workspace/shared';

const DATE = '2026-09-28'; // a Monday

const habit = (overrides: Partial<Habit>): Habit => ({
  id: 'h',
  name: 'Habit',
  habit_type: 'completion',
  description: null,
  unit: null,
  target: null,
  step: null,
  days: null,
  reminder_time: null,
  active: true,
  sort_order: 0,
  icon: null,
  ...overrides,
});

const baseInput = (
  overrides: Partial<DailyProgressInput> = {}
): DailyProgressInput => ({
  date: DATE,
  preferences: {
    include_checkin: false,
    include_habits: true,
    include_supplements: true,
    include_meals: false,
  },
  checkin: null,
  habits: [],
  habitLogs: [],
  measurementReminders: [],
  recordedMeasurements: {},
  supplementDoses: [],
  meals: [],
  ...overrides,
});

describe('buildDailyProgress', () => {
  it('returns a neutral (null) percent when nothing applies', () => {
    const progress = buildDailyProgress(baseInput());
    expect(progress.applicable).toBe(0);
    expect(progress.percent).toBeNull();
    expect(progressionStage(progress.percent)).toBe('ready');
  });

  it('weights explicit tasks equally', () => {
    const progress = buildDailyProgress(
      baseInput({
        habits: [habit({ id: 'a' }), habit({ id: 'b' })],
        habitLogs: [
          { habit_id: 'a', entry_date: DATE, value: 1, recorded_at: 'x' },
        ],
        supplementDoses: [
          {
            schedule_id: 's1',
            medication_id: 'm1',
            label: 'Supplement',
            status: 'taken',
            recorded_at: 'y',
          },
          {
            schedule_id: 's2',
            medication_id: 'm2',
            label: 'Supplement 2',
            status: null,
            recorded_at: null,
          },
        ],
      })
    );
    expect(progress.completed).toBe(2);
    expect(progress.applicable).toBe(4);
    expect(progress.percent).toBe(50);
    expect(progress.version).toBe(1);
  });

  it('drops explicitly skipped tasks from the denominator', () => {
    const progress = buildDailyProgress(
      baseInput({
        preferences: {
          include_checkin: true,
          include_habits: true,
          include_supplements: true,
          include_meals: false,
        },
        checkin: {
          id: 'c',
          state: 'skipped',
          completed_at: null,
          skipped_at: 'z',
          updated_at: 'z',
        },
        supplementDoses: [
          {
            schedule_id: 's1',
            medication_id: 'm1',
            label: 'Supplement',
            status: 'skipped',
            recorded_at: 'y',
          },
        ],
      })
    );
    expect(progress.applicable).toBe(0);
    expect(progress.items.map((item) => item.reason)).toEqual([
      'checkin_skipped',
      'dose_skipped',
    ]);
  });

  it('never completes a meal because foods were logged', () => {
    const progress = buildDailyProgress(
      baseInput({
        preferences: {
          include_checkin: false,
          include_habits: false,
          include_supplements: false,
          include_meals: true,
        },
        meals: [
          {
            meal_type_id: 'b',
            name: 'breakfast',
            state: 'pending',
            logged_item_count: 3,
            updated_at: null,
          },
          {
            meal_type_id: 'l',
            name: 'lunch',
            state: 'skipped',
            logged_item_count: 0,
            updated_at: 't',
          },
        ],
      })
    );
    expect(progress.items.map((item) => [item.label, item.state])).toEqual([
      ['breakfast', 'started'],
      ['lunch', 'complete'],
    ]);
    expect(progress.percent).toBe(50);
  });

  it('counts only due habits and opted-in measurement reminders', () => {
    const weekdayOnlyTuesday = habit({ id: 'tue', days: [2] });
    const inactive = habit({ id: 'off', active: false });
    const progress = buildDailyProgress(
      baseInput({
        habits: [weekdayOnlyTuesday, inactive],
        measurementReminders: [
          {
            id: 'r1',
            measurement_key: 'weight',
            enabled: true,
            days: null,
            daypart: 'morning',
            reminder_time: '07:30',
            include_in_daily_progress: true,
          },
          {
            id: 'r2',
            measurement_key: 'custom:00000000-0000-0000-0000-000000000000',
            enabled: true,
            days: null,
            daypart: 'evening',
            reminder_time: '20:00',
            include_in_daily_progress: false,
          },
        ],
        recordedMeasurements: {},
      })
    );
    expect(progress.items.map((item) => item.id)).toEqual([
      `measurement:weight:${DATE}`,
    ]);
    expect(progress.items[0].state).toBe('pending');
  });
});

describe('habitDayState', () => {
  it('keeps an explicit 0 distinct from no record', () => {
    const count = habit({ habit_type: 'count', target: null });
    expect(habitDayState(count, undefined)).toBe('not_recorded');
    expect(habitDayState(count, { value: 0 })).toBe('complete');
    const targeted = habit({ habit_type: 'count', target: 10 });
    expect(habitDayState(targeted, { value: 0 })).toBe('not_done');
    expect(habitDayState(targeted, { value: 4 })).toBe('started');
    expect(habitDayState(targeted, { value: 10 })).toBe('complete');
  });

  it('treats a completion habit saved as not done as a record', () => {
    expect(habitDayState(habit({}), { value: 0 })).toBe('not_done');
    expect(habitDayState(habit({}), { value: 1 })).toBe('complete');
  });
});

describe('calendar and context helpers', () => {
  it('derives weekdays from the calendar day alone', () => {
    expect(weekdayOfDay('2026-09-28')).toBe(1);
    expect(isHabitDue(habit({ days: [1] }), '2026-09-28')).toBe(true);
    expect(isHabitDue(habit({ days: [0, 6] }), '2026-09-28')).toBe(false);
  });

  it('pauses discretionary reminders only inside an opted-in period', () => {
    const periods = [
      {
        start_date: '2026-09-20',
        end_date: '2026-09-25',
        pause_discretionary_reminders: true,
      },
      {
        start_date: '2026-09-27',
        end_date: null,
        pause_discretionary_reminders: false,
      },
    ];
    expect(discretionaryRemindersPaused(periods, '2026-09-22')).toBe(true);
    expect(discretionaryRemindersPaused(periods, '2026-09-28')).toBe(false);
  });
});

describe('check-in helpers', () => {
  it('refuses empty check-ins', () => {
    expect(hasCheckinResponse({})).toBe(false);
    expect(hasCheckinResponse({ note: '   ' })).toBe(false);
    expect(hasCheckinResponse({ tags: ['busy_day'] })).toBe(true);
    expect(hasCheckinResponse({ stress: 1 })).toBe(true);
  });

  it('does not treat higher stress as better', () => {
    expect(favourableShare(5, 'higher_is_better')).toBe(1);
    expect(favourableShare(5, 'higher_is_worse')).toBe(0);
  });
});

describe('summarizeMealCoverage', () => {
  it('reports resolved and incomplete meals separately', () => {
    expect(
      summarizeMealCoverage([
        { state: 'complete' },
        { state: 'skipped' },
        { state: 'complete' },
        { state: 'incomplete' },
      ])
    ).toEqual({
      total: 4,
      resolved: 3,
      complete: 2,
      skipped: 1,
      incomplete: 1,
      pending: 0,
    });
  });
});
