import { describe, expect, it } from 'vitest';
import {
  aggregateWorkoutPlanAdherence,
  aggregateExerciseReviewPeriod,
  aggregateExerciseReviewTrend,
  sourceSessionsForExerciseReview,
  type ExerciseReviewRow,
  type WorkoutPlanVersionRow,
} from '../services/exerciseReviewService.js';

function planVersion(
  overrides: Partial<WorkoutPlanVersionRow> = {}
): WorkoutPlanVersionRow {
  return {
    template_id: 1,
    effective_from: '2026-09-01',
    start_date: null,
    end_date: null,
    is_active: true,
    assignments: [{ id: 10, dayOfWeek: 1 }],
    ...overrides,
  };
}

describe('historical workout plan adherence', () => {
  it('uses the schedule in force on each elapsed day and ignores unrecorded today', () => {
    const adherence = aggregateWorkoutPlanAdherence(
      [
        planVersion(),
        planVersion({
          effective_from: '2026-09-08',
          assignments: [{ id: 20, dayOfWeek: 2 }],
        }),
      ],
      [
        { entry_date: '2026-09-07', assignment_id: 10 },
        { entry_date: '2026-09-08', assignment_id: 20 },
        { entry_date: '2026-09-09', assignment_id: 20 },
      ],
      '2026-09-07',
      '2026-09-09',
      '2026-09-09'
    );
    expect(adherence).toMatchObject({
      elapsedDays: 2,
      coveredDays: 2,
      eligibleScheduledSessions: 2,
      attendedScheduledSessions: 2,
      adherencePercent: 100,
    });
  });

  it('keeps unknown pre-snapshot days out of the denominator and honors deletion', () => {
    const adherence = aggregateWorkoutPlanAdherence(
      [
        planVersion({ effective_from: '2026-09-08' }),
        planVersion({ effective_from: '2026-09-09', is_active: false }),
      ],
      [],
      '2026-09-07',
      '2026-09-10',
      '2026-09-11'
    );
    expect(adherence).toMatchObject({
      elapsedDays: 4,
      coveredDays: 3,
      eligibleScheduledSessions: 0,
      attendedScheduledSessions: 0,
      adherencePercent: null,
    });
  });

  it('uses the latest same-day edit instead of the migration baseline', () => {
    const adherence = aggregateWorkoutPlanAdherence(
      [
        planVersion({ effective_from: '2026-09-07' }),
        planVersion({
          effective_from: '2026-09-07',
          assignments: [{ id: 20, dayOfWeek: 1 }],
        }),
      ],
      [{ entry_date: '2026-09-07', assignment_id: 20 }],
      '2026-09-07',
      '2026-09-07',
      '2026-09-08'
    );
    expect(adherence).toMatchObject({
      eligibleScheduledSessions: 1,
      attendedScheduledSessions: 1,
      adherencePercent: 100,
    });
  });
});

function row(
  id: string,
  overrides: Partial<ExerciseReviewRow> = {}
): ExerciseReviewRow {
  return {
    id,
    exercise_preset_entry_id: null,
    entry_date: '2026-09-23',
    exercise_name: 'Exercise',
    category: null,
    notes: null,
    provider_name: null,
    detail_data: null,
    exercise_source_id: null,
    session_name: null,
    session_source: null,
    distance: null,
    duration_minutes: null,
    lifted_volume_kg: null,
    reps: null,
    ...overrides,
  };
}

describe('exercise review aggregation', () => {
  it('links each recorded session once and excludes activity outside the window', () => {
    const sources = sourceSessionsForExerciseReview(
      [
        row('bench', {
          exercise_preset_entry_id: 'workout-1',
          session_name: 'Full Body',
          session_source: 'hevy',
        }),
        row('row', {
          exercise_preset_entry_id: 'workout-1',
          session_name: 'Full Body',
        }),
        row('run', {
          entry_date: '2026-09-24',
          exercise_name: 'Morning Run',
          provider_name: 'Garmin',
        }),
        row('calories', { exercise_name: 'Active Calories' }),
        row('older', { entry_date: '2026-09-20' }),
      ],
      '2026-09-22',
      '2026-09-24'
    );

    expect(sources).toEqual([
      {
        id: 'run',
        type: 'individual',
        entryDate: '2026-09-24',
        name: 'Morning Run',
        source: 'Garmin',
      },
      {
        id: 'workout-1',
        type: 'preset',
        entryDate: '2026-09-23',
        name: 'Full Body',
        source: 'hevy',
      },
    ]);
  });

  it('counts one strength session across exercises and keeps sport facts separate', () => {
    const review = aggregateExerciseReviewPeriod(
      [
        row('bench', {
          exercise_preset_entry_id: 'workout-1',
          exercise_name: 'Bench Press',
          category: 'strength',
          lifted_volume_kg: '900',
          reps: '15',
          duration_minutes: '25',
        }),
        row('row', {
          exercise_preset_entry_id: 'workout-1',
          exercise_name: 'Bent Over Row',
          category: 'strength',
          lifted_volume_kg: '600',
          reps: '12',
          duration_minutes: '20',
        }),
        row('run', {
          exercise_name: 'Morning Run',
          category: 'cardio',
          distance: '5.25',
          duration_minutes: '29.5',
        }),
        row('ride', {
          exercise_name: 'Activity',
          category: 'cardio',
          provider_name: 'Garmin',
          detail_data: { sport: 'cycling' },
          distance: '20',
          duration_minutes: '50',
        }),
        row('unknown', {
          exercise_name: 'Training',
          category: 'cardio',
          duration_minutes: '10',
        }),
        row('excluded', {
          exercise_name: 'Active Calories',
          duration_minutes: '60',
        }),
        row('outside', {
          entry_date: '2026-09-20',
          exercise_name: 'Run',
          distance: '99',
        }),
      ],
      '2026-09-22',
      '2026-09-24'
    );

    expect(review.overall).toMatchObject({
      sessions: 4,
      exerciseEntries: 5,
      distanceMeters: 25250,
      durationMinutes: 134.5,
      liftedVolumeKg: 1500,
      reps: 27,
    });
    expect(review.strength).toMatchObject({
      sessions: 1,
      exerciseEntries: 2,
      liftedVolumeKg: 1500,
      reps: 27,
    });
    expect(review.running).toMatchObject({
      sessions: 1,
      distanceMeters: 5250,
      inferredEntries: 1,
    });
    expect(review.cycling).toMatchObject({
      sessions: 1,
      distanceMeters: 20000,
      inferredEntries: 0,
    });
    expect(review.other).toMatchObject({
      sessions: 1,
      durationMinutes: 10,
    });
  });

  it('keeps empty calendar weeks and separates recorded sport metrics', () => {
    const trend = aggregateExerciseReviewTrend(
      [
        row('run', {
          entry_date: '2026-09-02',
          exercise_name: 'Morning Run',
          distance: '5',
        }),
        row('bench', {
          entry_date: '2026-09-23',
          exercise_name: 'Bench Press',
          category: 'strength',
          lifted_volume_kg: '800',
        }),
      ],
      '2026-09-01',
      '2026-09-25'
    );

    expect(trend.map(({ startDate, endDate }) => [startDate, endDate])).toEqual(
      [
        ['2026-09-01', '2026-09-06'],
        ['2026-09-07', '2026-09-13'],
        ['2026-09-14', '2026-09-20'],
        ['2026-09-21', '2026-09-25'],
      ]
    );
    expect(trend[0].running).toMatchObject({
      sessions: 1,
      distanceMeters: 5000,
    });
    expect(trend[1].running.sessions).toBe(0);
    expect(trend[3].strength).toMatchObject({
      sessions: 1,
      liftedVolumeKg: 800,
    });
  });
});
