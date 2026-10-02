import { describe, expect, it, vi } from 'vitest';
import {
  buildDailyProgress,
  createHabitRequestSchema,
  isHabitDue,
  recordWellnessActivity,
  wellnessActivityRequest,
  wellnessEntries,
  type Habit,
  type HabitLog,
} from '@workspace/shared';

const sauna: Habit = {
  id: 'sauna',
  name: 'Sauna',
  category: 'wellness',
  habit_type: 'completion',
  days: [],
  reminder_time: null,
  description: null,
  unit: null,
  target: null,
  step: null,
  active: true,
  sort_order: 0,
  icon: null,
};
const date = '2026-10-02';
const logged: HabitLog = {
  habit_id: sauna.id,
  entry_date: date,
  value: 1,
  recorded_at: '2026-10-02T18:00:00Z',
};

describe('wellness activity tracking', () => {
  it('creates an unscheduled completion definition with only an activity name', () => {
    expect(
      createHabitRequestSchema.parse(wellnessActivityRequest(' Sauna '))
    ).toEqual({
      name: 'Sauna',
      category: 'wellness',
      habit_type: 'completion',
      days: [],
      reminder_time: null,
    });
  });
  it.each([
    { habit_type: 'count' },
    { days: [1] },
    { reminder_time: '18:00' },
    { target: 20 },
    { step: 1 },
    { unit: 'minutes' },
  ])('rejects session/goal configuration %j', (extra) => {
    expect(
      createHabitRequestSchema.safeParse({
        ...wellnessActivityRequest('Sauna'),
        ...extra,
      }).success
    ).toBe(false);
  });
  it('keeps the existing weekday requirement for ordinary habits', () => {
    expect(
      createHabitRequestSchema.safeParse({
        name: 'Reading',
        habit_type: 'completion',
        days: [],
      }).success
    ).toBe(false);
    expect(
      createHabitRequestSchema.safeParse({
        name: 'Reading',
        habit_type: 'completion',
      }).success
    ).toBe(true);
  });
  it('never turns a wellness log into an applicable progress task or reminder', () => {
    // The category remains a guard even against an incorrectly scheduled fixture.
    expect(isHabitDue({ ...sauna, days: null }, date)).toBe(false);
    const result = buildDailyProgress({
      date,
      preferences: {
        include_checkin: false,
        include_habits: true,
        include_supplements: false,
        include_meals: false,
      },
      checkin: null,
      habits: [sauna],
      habitLogs: [logged],
      measurementReminders: [],
      recordedMeasurements: {},
      supplementDoses: [],
      meals: [],
    });
    expect(result).toMatchObject({
      applicable: 0,
      completed: 0,
      percent: null,
      items: [],
    });
  });
  it('reuses an existing wellness activity and preserves the selected calendar day', async () => {
    const create = vi.fn();
    const log = vi.fn().mockResolvedValue(logged);
    await recordWellnessActivity({
      name: ' SAUNA ',
      date,
      habits: [sauna],
      create,
      log,
    });
    expect(create).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('sauna', {
      entry_date: date,
      value: true,
    });
  });
  it('does not reuse an ordinary habit with the same name', async () => {
    const create = vi.fn().mockResolvedValue(sauna);
    const log = vi.fn().mockResolvedValue(logged);
    await recordWellnessActivity({
      name: 'Sauna',
      date,
      habits: [{ ...sauna, category: 'habit' }],
      create,
      log,
    });
    expect(create).toHaveBeenCalledWith(wellnessActivityRequest('Sauna'));
  });
  it('propagates a failed save so the caller retains its retry input', async () => {
    const create = vi.fn().mockResolvedValue(sauna);
    const log = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(
      recordWellnessActivity({ name: 'Sauna', date, habits: [], create, log })
    ).rejects.toThrow('offline');
  });
  it('keeps archived activity history and omits false, absent, and ordinary habit records', () => {
    expect(
      wellnessEntries(
        [
          { ...sauna, active: false },
          { ...sauna, id: 'regular', category: 'habit' },
        ],
        [
          logged,
          { ...logged, habit_id: 'regular' },
          { ...logged, entry_date: '2026-10-01', value: 0 },
          { ...logged, entry_date: '2026-09-30' },
        ]
      )
    ).toEqual([
      { activityId: 'sauna', name: 'Sauna', date },
      { activityId: 'sauna', name: 'Sauna', date: '2026-09-30' },
    ]);
  });
});
