import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { evaluateCoachingOutcome } from '@workspace/shared';
import { activityData, activityEntry } from './fixtures/activityPlanning.js';
import { projectActivityPlanning } from '../services/activityPlanningProjection.js';
import { coachingWorkoutEvidence } from '../services/coachingWorkoutEvidence.js';

const outcome = (rows: ReturnType<typeof coachingWorkoutEvidence>) =>
  evaluateCoachingOutcome({
    rows,
    from: '2026-10-01',
    to: '2026-10-02',
    today: '2026-10-02',
    now: new Date('2026-10-02T12:00:00Z'),
    success: {
      metric: 'workout_completion',
      subjectId: '1',
      unit: 'ratio',
      baseline: null,
      target: 1,
      direction: 'minimum',
      minimumCoverage: 0.7,
      reviewDay: '2026-10-02',
    },
  });
describe('coaching shares weekly activity completion', () => {
  it('keeps two shorter lifting sessions started and incomplete until one reaches the saved target', () => {
    const data = activityData();
    Object.assign(data.versions[0].assignments[0], {
      exerciseId: null,
      workoutPresetId: null,
      exercises: [],
      activityType: 'strength',
      label: 'Strength training',
      plannedDurationMinutes: 45,
    });
    data.entries = [0.6, 35.3].map((minutes) =>
      activityEntry({
        record_id: randomUUID(),
        origin_id: null,
        category: 'strength',
        exercise_name: 'Bench press',
        session_name: 'Split 1',
        source: 'sparky',
        completed_count: 1,
        duration_minutes: minutes,
        recorded_at: '2026-10-01T20:35:00Z',
      })
    );
    const evidence = () =>
      coachingWorkoutEvidence(
        projectActivityPlanning(
          data,
          '2026-10-01',
          '2026-10-01',
          'Europe/Berlin',
          '2026-10-02'
        ).occurrences,
        '2026-10-02'
      );
    expect(evidence()[0].value).toMatchObject({ completed: 0, started: 1 });
    expect(outcome(evidence()).value).toBe(0);
    data.entries[1].duration_minutes = 45;
    expect(outcome(evidence()).value).toBe(1);
  });
  it('does not treat partial attendance as full prescription completion', () => {
    const data = activityData();
    data.entries = [activityEntry({ completed_count: 1 })];
    const project = () =>
      projectActivityPlanning(
        data,
        '2026-10-01',
        '2026-10-02',
        'Europe/Berlin',
        '2026-10-02'
      );
    expect(
      outcome(coachingWorkoutEvidence(project().occurrences, '2026-10-02'))
    ).toMatchObject({ value: 0, coverage: 1, interpretation: 'below_target' });
    data.entries[0].completed_count = 2;
    expect(
      outcome(coachingWorkoutEvidence(project().occurrences, '2026-10-02'))
    ).toMatchObject({ value: 1, interpretation: 'met' });
  });
  it('does not count current/future, optional, skipped, or unknown prescriptions as failed sessions', () => {
    const data = activityData();
    const rows = projectActivityPlanning(
      data,
      '2026-10-01',
      '2026-10-01',
      'Europe/Berlin',
      '2026-10-02'
    ).occurrences;
    expect(
      outcome(coachingWorkoutEvidence(rows, '2026-10-01')).value
    ).toBeNull();
    for (const patch of [
      { optional: true },
      { state: 'excluded' as const },
      { reason: 'prescription_unknown' },
    ]) {
      expect(
        outcome(
          coachingWorkoutEvidence(
            rows.map((row) => ({ ...row, ...patch })),
            '2026-10-02'
          )
        ).value
      ).toBeNull();
    }
    const mixed = [
      { ...rows[0], state: 'complete' as const },
      { ...rows[0], id: 'unknown', reason: 'prescription_unknown' },
    ];
    expect(outcome(coachingWorkoutEvidence(mixed, '2026-10-02'))).toMatchObject(
      { value: 1, coverage: 0.5, interpretation: 'insufficient_data' }
    );
    expect(
      outcome(
        coachingWorkoutEvidence(
          [
            { ...rows[0], state: 'complete' as const },
            { ...rows[0], date: '2026-10-02', reason: 'prescription_unknown' },
          ],
          '2026-10-02'
        )
      )
    ).toMatchObject({ value: 1, coverage: 1, interpretation: 'met' });
  });
  it('does not promote legacy attendance-only evidence to success', () => {
    const rows = coachingWorkoutEvidence(
      projectActivityPlanning(
        activityData(),
        '2026-10-01',
        '2026-10-01',
        'Europe/Berlin',
        '2026-10-02'
      ).occurrences,
      '2026-10-02'
    );
    rows[0].value = { templateId: 1, eligible: 1, attended: 1, ratio: 1 };
    expect(outcome(rows).value).toBeNull();
  });
});
