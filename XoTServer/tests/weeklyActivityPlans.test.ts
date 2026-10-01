import { describe, expect, it } from 'vitest';
import {
  workoutPlanWriteSchema,
  buildDailyProgress,
  type DailyProgressInput,
} from '@workspace/shared';

const plan = {
  plan_name: 'Synthetic week',
  start_date: '2026-10-05',
  schedule_type: 'weekly',
  entry_mode: 'prompt',
  assignments: [
    { day_of_week: 1, activity_type: 'running', planned_distance_km: 10 },
    { day_of_week: 1, activity_type: 'strength', planned_duration_minutes: 45 },
    { day_of_week: 2, activity_type: 'soccer', planned_time: '19:30' },
  ],
};

describe('whole-activity planning contract', () => {
  it('accepts multiple independent sessions and account-local times', () => {
    expect(workoutPlanWriteSchema.parse(plan).assignments).toHaveLength(3);
  });
  it.each([
    { activity_type: 'running', workout_preset_id: 3 },
    { activity_type: 'rest', planned_duration_minutes: 30 },
    { activity_type: 'running', planned_distance_km: 0 },
    { activity_type: 'running', planned_duration_minutes: -1 },
    { activity_type: 'running', planned_time: '25:00' },
    { activity_type: 'running', day_of_week: 8 },
  ])('rejects invalid session %j', (assignment) => {
    expect(
      workoutPlanWriteSchema.safeParse({
        ...plan,
        assignments: [{ day_of_week: 1, ...assignment }],
      }).success
    ).toBe(false);
  });
  it('does not turn a planned activity into a prefilled completion', () => {
    expect(
      workoutPlanWriteSchema.safeParse({ ...plan, entry_mode: 'prefill' })
        .success
    ).toBe(false);
  });
  it('rejects impossible dates and reversed ranges', () => {
    expect(
      workoutPlanWriteSchema.safeParse({ ...plan, start_date: '2026-02-30' })
        .success
    ).toBe(false);
    expect(
      workoutPlanWriteSchema.safeParse({ ...plan, end_date: '2026-10-01' })
        .success
    ).toBe(false);
  });
  it('retains saved presets and advanced exercise sets', () => {
    const result = workoutPlanWriteSchema.parse({
      ...plan,
      assignments: [
        { day_of_week: 1, workout_preset_id: 17 },
        {
          day_of_week: 2,
          exercise_id: '00000000-0000-4000-8000-000000000001',
          sets: [{ set_number: 1, set_type: 'Drop Set', reps: 12, weight: 25 }],
        },
      ],
    });
    expect(result.assignments?.[1].sets?.[0].set_type).toBe('Drop Set');
  });
});

describe('daily objectives and planned training', () => {
  const input: DailyProgressInput = {
    date: '2026-10-05',
    preferences: {
      include_checkin: false,
      include_habits: false,
      include_supplements: false,
      include_meals: false,
    },
    checkin: null,
    habits: [],
    habitLogs: [],
    measurementReminders: [],
    recordedMeasurements: {},
    supplementDoses: [],
    meals: [],
  };
  it('uses actual completion evidence; optional sessions do not penalize an unrecorded day', () => {
    const result = buildDailyProgress({
      ...input,
      workouts: [
        {
          assignment_id: '1',
          plan_id: '3',
          label: '10 km run',
          recorded_at: null,
          optional: false,
        },
        {
          assignment_id: '2',
          plan_id: '3',
          label: 'Optional swim',
          recorded_at: null,
          optional: true,
        },
        {
          assignment_id: '3',
          plan_id: '3',
          label: 'Recorded training',
          recorded_at: '2026-10-05T16:00:00Z',
          optional: false,
        },
      ],
    });
    expect(result.items.map((item) => item.state)).toEqual([
      'pending',
      'excluded',
      'complete',
    ]);
    expect(result.percent).toBe(50);
  });
  it('keeps unknown objective values unknown and separates nutrition review from meeting targets', () => {
    const result = buildDailyProgress({
      ...input,
      goals: [
        {
          key: 'activity_duration',
          value: null,
          target: 45,
          unit: 'min',
          complete: false,
        },
        {
          key: 'nutrition_review',
          value: null,
          target: 1,
          unit: '',
          complete: true,
          summary: { calories: 2000 },
        },
      ],
    });
    expect(result.items[0].value).toBeNull();
    expect(result.items[0].state).toBe('pending');
    expect(result.items[1].goal_summary).toEqual({ calories: 2000 });
    expect(result.coverage.goal).toEqual({ applicable: 2, completed: 1 });
  });
});
