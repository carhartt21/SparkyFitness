import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  activityWeekRange,
  classifyActivitySport,
  withActivityProgress,
  summarizeDailyProgressItems,
} from '@workspace/shared';
import { projectActivityPlanning } from '../services/activityPlanningProjection.js';
import type { ActivityPlanningData } from '../models/activityPlanningRepository.js';
const DAY = '2026-10-01';
const owner = randomUUID();
import {
  activityData,
  activityEntry,
  exerciseId,
} from './fixtures/activityPlanning.js';
const project = (rows: ActivityPlanningData, from = DAY, to = DAY) =>
  projectActivityPlanning(rows, from, to, 'Europe/Berlin', DAY);
describe('activity planning completion truth', () => {
  it('uses Monday-first weeks across calendar boundaries', () => {
    expect(activityWeekRange(DAY)).toEqual({
      start_date: '2026-09-28',
      end_date: '2026-10-04',
    });
    expect(activityWeekRange('2027-01-01')).toEqual({
      start_date: '2026-12-28',
      end_date: '2027-01-03',
    });
  });
  it.each([
    'Running',
    'Walking',
    'Cycling',
    'Weightlifting',
    'Soccer',
    'Mobility',
    'Stretching',
  ])('classifies %s', (name) =>
    expect(classifyActivitySport({ exerciseName: name }).sport).not.toBe(
      'other'
    )
  );
  it('classifies a planned exercise by its category when the name says nothing', () => {
    const rows = activityData();
    const assignment = rows.versions[0]!.assignments[0]!;
    assignment.label = 'Pull Workout — Back & Biceps';
    assignment.exercises = [
      {
        exerciseId,
        name: 'Pull Workout — Back & Biceps',
        expectedSets: 2,
        sets: [],
      },
    ];
    expect(project(rows).occurrences[0]?.activity_type).toBe('other');
    rows.exerciseCategories = { [exerciseId]: 'Strength' };
    expect(project(rows).occurrences[0]?.activity_type).toBe('strength');
    // A preset mixing categories keeps the name-based classification.
    const second = randomUUID();
    assignment.exercises.push({
      exerciseId: second,
      name: 'Easy jog',
      expectedSets: 1,
      sets: [],
    });
    rows.exerciseCategories[second] = 'Cardio';
    expect(project(rows).occurrences[0]?.activity_type).toBe('other');
  });

  it('keeps prefills pending, partial sets started and complete sets confirmed', () => {
    const rows = activityData();
    rows.entries = [activityEntry()];
    expect(project(rows).occurrences[0].state).toBe('pending');
    rows.entries[0].completed_count = 1;
    expect(project(rows).occurrences[0].state).toBe('started');
    rows.entries[0].completed_count = 2;
    expect(project(rows).occurrences[0].state).toBe('complete');
    rows.entries = [];
    expect(project(rows).occurrences[0].state).toBe('pending');
  });
  it('keeps whole-activity prefills pending and requires actual duration/distance targets', () => {
    const rows = activityData();
    Object.assign(rows.versions[0].assignments[0], {
      exerciseId: null,
      exercises: [],
      activityType: 'running',
      plannedDurationMinutes: 30,
      plannedDistanceKm: 5,
    });
    rows.entries = [
      activityEntry({
        source: 'Workout Plan',
        duration_minutes: 30,
        distance: 5,
      }),
    ];
    expect(project(rows).occurrences[0].state).toBe('pending');
    rows.entries[0].source = 'manual';
    rows.entries[0].duration_minutes = 20;
    expect(project(rows).occurrences[0].state).toBe('started');
    rows.entries[0].duration_minutes = 30;
    expect(project(rows).occurrences[0]).toMatchObject({
      state: 'complete',
      reason: 'activity_targets_recorded',
      activity_type: 'running',
    });
    rows.entries[0].distance = null;
    expect(project(rows).occurrences[0].state).toBe('started');
    expect(project(rows, DAY, DAY).records[0].confirmed).toBe(true);
  });
  it('omits rest and does not double-count optional or old workout tasks', () => {
    const rows = activityData();
    rows.versions[0].assignments[0].activityType = 'rest';
    expect(project(rows).occurrences).toEqual([]);
    rows.versions[0].assignments[0].activityType = 'weightlifting';
    rows.versions[0].assignments[0].isOptional = true;
    const old = summarizeDailyProgressItems(DAY, [
      {
        id: 'old',
        domain: 'workout',
        date: DAY,
        label: 'Training',
        state: 'complete',
        applicable: true,
        reference_id: '1',
        recorded_at: null,
        reason: 'recorded',
      },
    ]);
    const result = withActivityProgress(old, project(rows).occurrences);
    expect(result.items.map((item) => item.domain)).toEqual(['activity']);
    expect(result.applicable).toBe(0);
    expect(result.items[0]).toMatchObject({
      activity_type: 'running',
      optional: true,
    });
  });
  it('never fills missing exercises with duplicate/excess sets or separate sessions', () => {
    const rows = activityData();
    const second = randomUUID();
    rows.versions[0].assignments[0].exercises!.push({
      exerciseId: second,
      name: 'Walking',
      expectedSets: 1,
      sets: [],
    });
    rows.entries = [
      activityEntry({ completed_count: 10 }),
      activityEntry({ completed_count: 10 }),
    ];
    expect(project(rows).occurrences[0].state).toBe('started');
    rows.entries.push(
      activityEntry({ exercise_id: second, completed_count: 1 })
    );
    expect(project(rows).occurrences[0].state).toBe('started');
    rows.entries[2].record_id = rows.entries[0].record_id;
    expect(project(rows).occurrences[0].state).toBe('complete');
  });
  it('retains confirmed snapshot evidence after library deletion', () => {
    const rows = activityData();
    rows.entries = [activityEntry({ exercise_id: null, completed_count: 2 })];
    expect(project(rows).occurrences[0].state).toBe('complete');
  });
  it('pins the original prescription when the same assignment ID is edited', () => {
    const rows = activityData();
    rows.entries = [activityEntry({ completed_count: 2 })];
    const replacement = {
      ...rows.versions[0],
      id: '2',
      captured_at: '2026-10-01T11:00:00Z',
      assignments: rows.versions[0].assignments.map((row) => ({
        ...row,
        exercises: row.exercises!.map((exercise) => ({
          ...exercise,
          expectedSets: 3,
        })),
      })),
    };
    rows.versions.push(replacement);
    expect(project(rows).occurrences[0]).toMatchObject({
      state: 'complete',
      expected_sets: 2,
    });
    rows.resolutions = [
      {
        user_id: owner,
        occurrence_id: 'workout:1:1:2026-10-01',
        local_day: DAY,
        revision: 1,
        action: 'skip',
        record_id: null,
        entry_id: null,
        updated_at: '2026-10-01T12:30:00Z',
      },
    ];
    expect(project(rows).occurrences[0].expected_sets).toBe(2);
    rows.resolutions = [];
    rows.entries[0].first_confirmed_at = '2026-10-01T12:00:00Z';
    expect(project(rows).occurrences[0]).toMatchObject({
      state: 'started',
      expected_sets: 3,
    });
  });
  it('does not suppress an unrelated weekday insertion', () => {
    const rows = activityData();
    rows.entries = [activityEntry({ completed_count: 2 })];
    rows.versions.push({
      ...rows.versions[0],
      id: '2',
      captured_at: '2026-10-01T11:00:00Z',
      assignments: [
        {
          ...rows.versions[0].assignments[0],
          id: 9,
          exerciseId: randomUUID(),
          label: 'Cycling',
        },
        ...rows.versions[0].assignments,
      ],
    });
    expect(project(rows).occurrences.map((row) => row.assignment_id)).toEqual([
      1, 9,
    ]);
  });
  it('retains a recorded same-day slot after replacement or plan deletion', () => {
    const rows = activityData();
    rows.entries = [activityEntry({ completed_count: 2 })];
    const changed = {
      ...rows.versions[0],
      id: '2',
      captured_at: '2026-10-01T11:00:00Z',
      assignments: rows.versions[0].assignments.map((row) => ({
        ...row,
        id: 9,
        label: 'Updated run',
      })),
    };
    rows.versions.push(changed);
    expect(project(rows).occurrences).toHaveLength(1);
    expect(project(rows).occurrences[0]).toMatchObject({
      assignment_id: 1,
      state: 'complete',
    });
    changed.is_active = false;
    expect(project(rows).occurrences[0].state).toBe('complete');
  });
  it('does not use one exercise row for two prescribed slots', () => {
    const rows = activityData();
    rows.versions[0].assignments[0].exercises!.push({
      ...rows.versions[0].assignments[0].exercises![0],
    });
    rows.entries = [activityEntry({ completed_count: 10 })];
    expect(project(rows).occurrences[0].state).toBe('started');
  });
  it('does not count unknown legacy prescriptions in completion coverage', () => {
    const rows = activityData();
    delete rows.versions[0].assignments[0].exercises;
    rows.entries = [activityEntry({ completed_count: 2 })];
    const result = project(rows);
    expect(result.summary[0].unknown).toBe(1);
    expect(
      withActivityProgress(
        summarizeDailyProgressItems(DAY, []),
        result.occurrences
      )
    ).toMatchObject({ applicable: 0, percent: null });
  });
  it('keeps legacy prescriptions unknown and future days unconfirmed', () => {
    const rows = activityData();
    delete rows.versions[0].assignments[0].exercises;
    rows.entries = [activityEntry({ completed_count: 99 })];
    expect(project(rows).occurrences[0]).toMatchObject({
      state: 'started',
      expected_sets: null,
    });
    const future = activityData();
    future.entries = [
      activityEntry({ entry_date: '2026-10-08', completed_count: 2 }),
    ];
    expect(
      project(future, '2026-10-08', '2026-10-08').occurrences[0].state
    ).toBe('pending');
    expect(
      project(activityData(), '2026-09-24', '2026-09-24').occurrences
    ).toEqual([]);
  });
  it('preserves versions, rest days and sequential plans outside dated counts', () => {
    const rows = activityData();
    rows.versions.push({
      ...rows.versions[0],
      id: '2',
      effective_from: '2026-10-02',
      is_active: false,
    });
    expect(project(rows, DAY, '2026-10-08').occurrences).toHaveLength(1);
    expect(project(activityData(), '2026-10-02', '2026-10-02').summary).toEqual(
      []
    );
    const sequence = activityData();
    sequence.versions[0].assignments[0].dayOfWeek = null;
    expect(project(sequence).occurrences).toEqual([]);
    expect(project(sequence).workout_plans[0].schedule_type).toBe('sequential');
  });
  it('requires a surviving confirmed link and excludes skipped tasks', () => {
    const rows = activityData();
    const actual = activityEntry({
      origin_id: null,
      source: 'manual',
      duration_minutes: 30,
    });
    rows.entries = [actual];
    rows.resolutions = [
      {
        user_id: owner,
        occurrence_id: 'workout:1:1:2026-10-01',
        local_day: DAY,
        revision: 1,
        action: 'link',
        record_id: actual.record_id,
        entry_id: actual.id,
        updated_at: '2026-10-01T10:00:00Z',
      },
    ];
    expect(project(rows).occurrences[0]).toMatchObject({
      state: 'complete',
      reason: 'owner_linked_record',
    });
    rows.entries = [];
    rows.resolutions[0].entry_id = null;
    expect(project(rows).occurrences[0].state).toBe('pending');
    rows.resolutions[0] = {
      ...rows.resolutions[0],
      action: 'skip',
      record_id: null,
    };
    const result = project(rows);
    expect(result.occurrences[0].state).toBe('excluded');
    expect(result.summary[0].excluded).toBe(1);
  });
  it('preserves v1 and opts scheduled activity into v2', () => {
    const base = summarizeDailyProgressItems(DAY, [], 1);
    expect(base.version).toBe(1);
    expect(base.coverage).not.toHaveProperty('activity');
    const rows = activityData();
    expect(withActivityProgress(base, project(rows).occurrences)).toMatchObject(
      { version: 2, applicable: 1, completed: 0 }
    );
    rows.entries = [activityEntry({ completed_count: 2 })];
    expect(withActivityProgress(base, project(rows).occurrences).percent).toBe(
      100
    );
  });
});

describe('imported whole-activity completion', () => {
  const runningPlan = () => {
    const data = activityData();
    Object.assign(data.versions[0].assignments[0], {
      exerciseId: null,
      workoutPresetId: null,
      exercises: [],
      activityType: 'running',
      label: 'running',
      plannedDurationMinutes: 30,
      plannedDistanceKm: 5,
    });
    data.entries = [
      activityEntry({
        origin_id: null,
        source: 'Apple Health',
        exercise_name: 'Running',
        duration_minutes: 35,
        distance: 5.2,
        recorded_at: '2026-10-01T11:00:00Z',
        completed_count: 0,
      }),
    ];
    return data;
  };
  it('resolves a confirmed imported Running record without a plan ID or writes', () => {
    const data = runningPlan();
    const original = structuredClone(data);
    expect(project(data).occurrences[0]).toMatchObject({
      state: 'complete',
      reason: 'compatible_activity_recorded',
      evidence_ids: [data.entries[0].id],
    });
    expect(data).toEqual(original);
  });
  it.each([
    { exercise_name: 'Walking' },
    { source: 'Workout Plan' },
    { entry_date: '2026-09-30' },
    { duration_minutes: 0, distance: 0 },
    { recorded_at: '2026-10-01T09:00:00Z' },
    { origin_id: 99 },
  ])(
    'excludes incompatible, planned, earlier or reserved evidence: %j',
    (change) => {
      const data = runningPlan();
      Object.assign(data.entries[0], change);
      expect(project(data).occurrences[0].state).toBe('pending');
    }
  );
  it.each([{ duration_minutes: 20 }, { distance: null }, { distance: 4 }])(
    'shows a shorter or incomplete run as started: %j',
    (change) => {
      const data = runningPlan();
      Object.assign(data.entries[0], change);
      expect(project(data).occurrences[0].state).toBe('started');
    }
  );
  it('requires one whole record and never sums several short sessions', () => {
    const data = runningPlan();
    data.entries[0].duration_minutes = 15;
    data.entries.push(
      activityEntry({
        ...data.entries[0],
        id: randomUUID(),
        record_id: randomUUID(),
      })
    );
    expect(project(data).occurrences[0].state).toBe('started');
    data.entries[1].record_id = data.entries[0].record_id;
    expect(project(data).occurrences[0].state).toBe('pending');
  });
  it('uses a record once and gives a constrained goal priority over attendance', () => {
    const data = runningPlan();
    data.versions[0].assignments.push({
      ...data.versions[0].assignments[0],
      id: 2,
      plannedDistanceKm: null,
      plannedDurationMinutes: null,
    });
    expect(project(data).occurrences.map((row) => row.state)).toEqual([
      'complete',
      'pending',
    ]);
    data.entries.push(
      activityEntry({
        ...data.entries[0],
        id: randomUUID(),
        record_id: randomUUID(),
        distance: 1,
        duration_minutes: 10,
      })
    );
    expect(project(data).occurrences.map((row) => row.state)).toEqual([
      'complete',
      'complete',
    ]);
    data.entries.reverse();
    expect(project(data).occurrences.map((row) => row.state)).toEqual([
      'complete',
      'complete',
    ]);
  });
  it('preserves explicit skip and link reservations', () => {
    const data = runningPlan();
    data.resolutions = [
      {
        user_id: owner,
        occurrence_id: `workout:1:1:${DAY}`,
        local_day: DAY,
        revision: 1,
        action: 'skip',
        record_id: null,
        entry_id: null,
        updated_at: '2026-10-01T12:00:00Z',
      },
    ];
    expect(project(data).occurrences[0].state).toBe('excluded');
    data.resolutions[0] = {
      ...data.resolutions[0],
      occurrence_id: `workout:1:99:${DAY}`,
      action: 'link',
      record_id: data.entries[0].record_id,
      entry_id: data.entries[0].id,
    };
    expect(project(data).occurrences[0].state).toBe('pending');
  });
  it('matches imports even when a plan prefill exists', () => {
    const data = runningPlan();
    data.entries.push(
      activityEntry({
        source: 'Workout Plan',
        duration_minutes: 30,
        distance: 5,
      })
    );
    expect(project(data).occurrences[0]).toMatchObject({
      state: 'complete',
      reason: 'compatible_activity_recorded',
    });
  });
  it('pins the prescription when an imported run precedes an edit or deletion', () => {
    const data = runningPlan();
    const edited = structuredClone(data.versions[0]);
    edited.id = '2';
    edited.captured_at = '2026-10-01T12:00:00Z';
    edited.assignments[0].plannedDistanceKm = 10;
    data.versions.push(edited);
    expect(project(data).occurrences[0].state).toBe('complete');
    edited.is_active = false;
    edited.assignments = [];
    expect(project(data).occurrences).toHaveLength(1);
    expect(project(data).occurrences[0].state).toBe('complete');
  });
  it('does not backfill a new goal with an earlier imported run', () => {
    const data = runningPlan();
    data.versions[0].captured_at = '2026-10-01T12:00:00Z';
    expect(project(data).occurrences[0].state).toBe('pending');
  });
  it('removes inferred completion when the source record disappears', () => {
    const data = runningPlan();
    expect(project(data).occurrences[0].state).toBe('complete');
    data.entries = [];
    expect(project(data).occurrences[0].state).toBe('pending');
  });
});
