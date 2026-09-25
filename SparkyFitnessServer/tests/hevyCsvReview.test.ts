import { describe, expect, it } from 'vitest';
import { buildHevyCsvReview } from '../integrations/hevy/hevyCsvReview.js';
import type { HevyWorkout } from '../integrations/hevy/hevyDataProcessor.js';

const workouts: HevyWorkout[] = [
  {
    id: 'csv-first',
    title: 'Full Body',
    start_time: '2026-09-23T19:42:00.000Z',
    end_time: '2026-09-23T20:34:00.000Z',
    exercises: [
      { index: 0, title: 'Bench Press', sets: [] },
      { index: 1, title: 'Ring Row', sets: [] },
    ],
  },
];

describe('Hevy CSV review', () => {
  it('shows exact exercise-name mapping and flags nonidentical same-day sessions without merging them', () => {
    const review = buildHevyCsvReview(
      workouts,
      'Europe/Berlin',
      ['Bench Press', 'ring row'],
      [
        {
          id: 'same-import',
          name: 'Full Body',
          entry_date: '2026-09-23',
          source: 'Hevy',
          source_id: 'csv-first',
        },
        {
          id: 'apple',
          name: 'Full Body',
          entry_date: '2026-09-23',
          source: 'Apple Health',
          source_id: 'health-1',
        },
        {
          id: 'other-day',
          name: 'Full Body',
          entry_date: '2026-09-24',
          source: 'manual',
          source_id: null,
        },
      ]
    );

    expect(review.exerciseMappings).toEqual([
      { title: 'Bench Press', status: 'existing-name' },
      { title: 'Ring Row', status: 'will-create' },
    ]);
    expect(review.potentialDuplicateSessions).toEqual([
      {
        workoutIndex: 0,
        existingSessionId: 'apple',
        existingSource: 'Apple Health',
        entryDate: '2026-09-23',
      },
    ]);
  });
});
