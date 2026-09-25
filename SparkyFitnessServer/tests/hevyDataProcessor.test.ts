import { vi, beforeEach, describe, it, expect } from 'vitest';

vi.mock('../models/exerciseEntry.js', () => ({
  default: {
    createExerciseEntry: vi.fn().mockResolvedValue({ id: 'entry-1' }),
    getExistingExerciseSourceIds: vi.fn().mockResolvedValue([]),
    deleteExerciseEntriesByEntrySourceAndDate: vi
      .fn()
      .mockResolvedValue(undefined),
  },
}));
vi.mock('../models/exercise.js', () => ({
  default: {
    findExerciseByNameAndUserId: vi
      .fn()
      .mockImplementation((name: string) =>
        Promise.resolve({ id: `exercise-${name}` })
      ),
    createExercise: vi.fn().mockResolvedValue({ id: 'exercise-new' }),
  },
}));
vi.mock('../models/measurementRepository.js', () => ({
  default: { upsertCheckInMeasurements: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../models/activityDetailsRepository.js', () => ({
  default: {
    createActivityDetail: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../models/workoutPresetRepository.js', () => ({
  default: {
    getWorkoutPresetByName: vi.fn().mockResolvedValue(null),
    getWorkoutPresetBySource: vi.fn().mockResolvedValue(null),
    createWorkoutPreset: vi.fn().mockResolvedValue({ id: 42 }),
    addExerciseToWorkoutPreset: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../models/exercisePresetEntryRepository.js', () => ({
  default: {
    createExercisePresetEntry: vi
      .fn()
      .mockResolvedValue({ id: 'preset-entry-1' }),
    getExercisePresetEntriesByDate: vi.fn().mockResolvedValue([]),
    deleteExercisePresetEntry: vi.fn().mockResolvedValue(true),
    deleteExercisePresetEntriesByEntrySourceAndDate: vi
      .fn()
      .mockResolvedValue(undefined),
  },
}));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

import {
  processHevyUserInfo,
  processHevyRoutines,
  processHevyWorkouts,
} from '../integrations/hevy/hevyDataProcessor.js';
import type {
  HevyRoutine,
  HevyWorkout,
} from '../integrations/hevy/hevyDataProcessor.js';
import exerciseEntryRepository from '../models/exerciseEntry.js';
import activityDetailsRepository from '../models/activityDetailsRepository.js';
import workoutPresetRepository from '../models/workoutPresetRepository.js';
import exercisePresetEntryRepository from '../models/exercisePresetEntryRepository.js';
import measurementRepository from '../models/measurementRepository.js';
import {
  hevyCsvWorkoutsForImport,
  previewHevyWorkoutCsv,
} from '../integrations/hevy/hevyCsvPreview.js';

const UID = 'user-1';
const CID = 'user-1';

// A workout with three exercises: two untimed, one with per-set durations.
function sampleWorkout(): HevyWorkout {
  return {
    id: 'workout-abc',
    title: 'Vid plan A',
    routine_id: 'routine-1',
    description: '',
    start_time: '2026-07-13T05:52:14+00:00',
    end_time: '2026-07-13T06:52:14+00:00', // 60 minutes
    exercises: [
      {
        index: 0,
        title: 'Bulgarian Split Squat',
        notes: '',
        exercise_template_id: 'B5D3A742',
        superset_id: null,
        sets: [
          {
            index: 0,
            type: 'normal',
            weight_kg: 20,
            reps: 6,
            duration_seconds: null,
            distance_meters: null,
            rpe: null,
          },
          {
            index: 1,
            type: 'normal',
            weight_kg: 20,
            reps: 8,
            duration_seconds: null,
            distance_meters: null,
            rpe: null,
          },
        ],
      },
      {
        index: 1,
        title: 'Pull Up',
        notes: '',
        exercise_template_id: '1B2B1E7C',
        superset_id: 'ss-1',
        sets: [
          {
            index: 0,
            type: 'normal',
            weight_kg: null,
            reps: 6,
            duration_seconds: null,
            distance_meters: null,
            rpe: null,
          },
        ],
      },
      {
        index: 2,
        title: 'Plank',
        notes: '',
        exercise_template_id: 'PLANK01',
        superset_id: null,
        sets: [
          {
            index: 0,
            type: 'normal',
            weight_kg: null,
            reps: null,
            duration_seconds: 90,
            distance_meters: null,
            rpe: null,
          },
          {
            index: 1,
            type: 'normal',
            weight_kg: null,
            reps: null,
            duration_seconds: 90,
            distance_meters: null,
            rpe: null,
          },
        ],
      },
    ],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function callForExercise(name: string): any[] | undefined {
  return (
    exerciseEntryRepository.createExerciseEntry as unknown as {
      mock: { calls: unknown[][] };
    }
  ).mock.calls.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c) => (c[1] as any).exercise_id === `exercise-${name}`
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function entryArgForExercise(name: string): any {
  return callForExercise(name)?.[1];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processHevyUserInfo — measurement day', () => {
  it('uses the user-local day for a timestamp but preserves a date-only value', async () => {
    await processHevyUserInfo(
      UID,
      CID,
      {
        user: { weight_kg: 80, updated_at: '2026-09-24T00:30:00Z' },
      },
      'America/Los_Angeles'
    );
    await processHevyUserInfo(
      UID,
      CID,
      { user: { height_cm: 180, updated_at: '2026-09-24' } },
      'America/Los_Angeles'
    );

    expect(
      measurementRepository.upsertCheckInMeasurements
    ).toHaveBeenNthCalledWith(1, UID, CID, '2026-09-23', { weight: 80 });
    expect(
      measurementRepository.upsertCheckInMeasurements
    ).toHaveBeenNthCalledWith(2, UID, CID, '2026-09-24', { height: 180 });
  });

  it('does not invent a day for an ambiguous timestamp', async () => {
    await expect(
      processHevyUserInfo(
        UID,
        CID,
        {
          user: { weight_kg: 80, updated_at: '2026-09-24T00:30:00' },
        },
        'America/Los_Angeles'
      )
    ).rejects.toThrow('Hevy measurement timestamp has no UTC offset');

    expect(
      measurementRepository.upsertCheckInMeasurements
    ).not.toHaveBeenCalled();
  });

  it('propagates a failed measurement write to the sync outcome', async () => {
    vi.mocked(
      measurementRepository.upsertCheckInMeasurements
    ).mockRejectedValueOnce(new Error('measurement write failed'));

    await expect(
      processHevyUserInfo(
        UID,
        CID,
        { user: { weight_kg: 80, updated_at: '2026-09-24' } },
        'UTC'
      )
    ).rejects.toThrow('measurement write failed');
  });

  it('does not treat an unneeded timestamp as a failed measurement', async () => {
    await expect(
      processHevyUserInfo(
        UID,
        CID,
        { user: { updated_at: '2026-09-24T00:30:00' } },
        'UTC'
      )
    ).resolves.toBeUndefined();
    expect(
      measurementRepository.upsertCheckInMeasurements
    ).not.toHaveBeenCalled();
  });
});

describe('processHevyWorkouts — field mapping', () => {
  it('keeps each CSV weight reduction as its own ordered drop-set row', async () => {
    const csv = [
      'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Bench Press,,,0,normal,60,8,,0,',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Bench Press,,,1,dropset,45,6,,0,',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Bench Press,,,2,dropset,30,7,,0,',
    ].join('\n');
    const workouts = hevyCsvWorkoutsForImport(
      previewHevyWorkoutCsv(csv),
      'Europe/Berlin'
    );

    const result = await processHevyWorkouts(
      UID,
      CID,
      workouts,
      'Europe/Berlin'
    );

    expect(result.failed).toEqual([]);
    expect(entryArgForExercise('Bench Press').sets).toEqual([
      expect.objectContaining({
        set_number: 1,
        set_type: 'Working Set',
        weight: 60,
        reps: 8,
      }),
      expect.objectContaining({
        set_number: 2,
        set_type: 'Drop Set',
        weight: 45,
        reps: 6,
      }),
      expect.objectContaining({
        set_number: 3,
        set_type: 'Drop Set',
        weight: 30,
        reps: 7,
      }),
    ]);
  });

  it('maps entry_time from the workout start time in the user timezone', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    expect(entryArgForExercise('Bulgarian Split Squat').entry_time).toBe(
      '05:52'
    );
  });

  it('shifts entry_time into a negative-offset timezone', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'America/New_York');
    // 05:52 UTC is 01:52 in New York (EDT, -04:00)
    expect(entryArgForExercise('Bulgarian Split Squat').entry_time).toBe(
      '01:52'
    );
  });

  it.each(['start_time', 'end_time'] as const)(
    'rejects an offset-free workout %s before writing a session',
    async (field) => {
      const workout = sampleWorkout();
      workout[field] = '2026-07-13T05:52:14';

      const result = await processHevyWorkouts(UID, CID, [workout], 'UTC');

      expect(result).toMatchObject({
        imported: 0,
        failed: [
          {
            id: 'workout-abc',
            message: `Hevy workout ${field === 'start_time' ? 'start' : 'end'} time has no UTC offset.`,
          },
        ],
      });
      expect(
        exercisePresetEntryRepository.createExercisePresetEntry
      ).not.toHaveBeenCalled();
    }
  );

  it('sets a stable per-exercise source_id (workout id + exercise index)', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    expect(entryArgForExercise('Bulgarian Split Squat').source_id).toBe(
      'workout-abc_0'
    );
    expect(entryArgForExercise('Pull Up').source_id).toBe('workout-abc_1');
  });

  it('maps the Hevy superset id to a numeric per-workout group', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    expect(
      entryArgForExercise('Bulgarian Split Squat').superset_group
    ).toBeNull();
    // First distinct superset id in the workout → group 1 (numeric, not the raw id).
    expect(entryArgForExercise('Pull Up').superset_group).toBe(1);
  });

  it('allocates workout minutes without double-counting timed sets', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    expect(entryArgForExercise('Bulgarian Split Squat').duration_minutes).toBe(
      57
    );
    expect(entryArgForExercise('Pull Up').duration_minutes).toBe(0);
  });

  it('uses summed per-set duration for timed exercises', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    // 90 + 90 = 180s → 3 min
    expect(entryArgForExercise('Plank').duration_minutes).toBe(3);
  });

  it('keeps a timed warm-up short when it precedes the main exercises', async () => {
    const workout = sampleWorkout();
    workout.exercises = [
      {
        index: 0,
        title: 'Warm Up',
        superset_id: null,
        sets: [
          {
            index: 0,
            type: 'normal',
            weight_kg: null,
            reps: 0,
            duration_seconds: 180,
            distance_meters: null,
            rpe: null,
          },
        ],
      },
      ...workout.exercises!.map((exercise) => ({
        ...exercise,
        index: exercise.index + 1,
      })),
    ];

    await processHevyWorkouts(UID, CID, [workout], 'UTC');
    expect(entryArgForExercise('Warm Up').duration_minutes).toBe(3);
    expect(entryArgForExercise('Bulgarian Split Squat').duration_minutes).toBe(
      54
    );
    expect(entryArgForExercise('Plank').duration_minutes).toBe(3);
  });

  it('converts Hevy metres to the kilometres the distance column stores', async () => {
    // The Hevy API always reports `distance_meters` in metres regardless of the
    // user's display units, while exercise_entries.distance is kilometres like
    // every other integration writes it. Storing the raw sum made a 500 m row
    // read as 500 km.
    const workout = sampleWorkout();
    workout.exercises = [
      ...(workout.exercises ?? []),
      {
        index: 3,
        title: 'Rowing Machine',
        notes: '',
        exercise_template_id: 'ROW001',
        superset_id: null,
        sets: [
          {
            index: 0,
            type: 'normal',
            weight_kg: null,
            reps: null,
            duration_seconds: 120,
            distance_meters: 500,
            rpe: null,
          },
          {
            index: 1,
            type: 'normal',
            weight_kg: null,
            reps: null,
            duration_seconds: 120,
            distance_meters: 750,
            rpe: null,
          },
        ],
      },
    ];

    await processHevyWorkouts(UID, CID, [workout], 'UTC');

    // 500 m + 750 m = 1250 m = 1.25 km, not 1250.
    expect(entryArgForExercise('Rowing Machine').distance).toBe(1.25);
    expect(
      entryArgForExercise('Rowing Machine').sets.map(
        (set: { distance: number | null }) => set.distance
      )
    ).toEqual([0.5, 0.75]);
  });

  it('keeps short Hevy distances from rounding away to zero', async () => {
    const workout = sampleWorkout();
    workout.exercises = [
      ...(workout.exercises ?? []),
      {
        index: 3,
        title: "Farmer's Walk",
        notes: '',
        exercise_template_id: 'FARM01',
        superset_id: null,
        sets: [
          {
            index: 0,
            type: 'normal',
            weight_kg: 80,
            reps: null,
            duration_seconds: null,
            distance_meters: 50,
            rpe: null,
          },
        ],
      },
    ];

    await processHevyWorkouts(UID, CID, [workout], 'UTC');

    expect(entryArgForExercise("Farmer's Walk").distance).toBe(0.05);
  });

  it('leaves distance null for exercises with no distance sets', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    expect(entryArgForExercise('Pull Up').distance).toBeNull();
  });

  it('stores per-set duration in integer seconds (issue #1903)', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entryArgForExercise('Plank').sets.map((s: any) => s.duration)
    ).toEqual([90, 90]);
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entryArgForExercise('Pull Up').sets.every((s: any) => s.duration === null)
    ).toBe(true);
  });

  it('keeps configured rest intervals on completed-workout sets', async () => {
    const workout = sampleWorkout();
    workout.exercises![0]!.rest_seconds = '90';
    workout.exercises![1]!.rest_seconds = -1;

    await processHevyWorkouts(UID, CID, [workout], 'UTC');

    expect(
      entryArgForExercise('Bulgarian Split Squat').sets.map(
        (set: { rest_time: number | null }) => set.rest_time
      )
    ).toEqual([90, 90]);
    expect(entryArgForExercise('Pull Up').sets[0].rest_time).toBeNull();
  });
});

describe('processHevyWorkouts — session grouping', () => {
  it('does not infer a saved routine from a completed workout title', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    expect(workoutPresetRepository.createWorkoutPreset).not.toHaveBeenCalled();
  });

  it('creates one preset entry (session) for the workout, sourced Hevy', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    expect(
      exercisePresetEntryRepository.createExercisePresetEntry
    ).toHaveBeenCalledTimes(1);
    expect(
      exercisePresetEntryRepository.createExercisePresetEntry
    ).toHaveBeenCalledWith(
      UID,
      expect.objectContaining({
        workout_preset_id: null,
        name: 'Vid plan A',
        source_id: 'workout-abc',
        entry_date: '2026-07-13',
        source: 'Hevy',
      }),
      CID
    );
  });

  it('links every exercise entry to the preset entry (5th arg + field)', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    for (const name of ['Bulgarian Split Squat', 'Pull Up', 'Plank']) {
      const call = callForExercise(name)!;
      expect(call[3]).toBe('Hevy'); // entrySource
      expect(call[4]).toBe('preset-entry-1'); // exercisePresetEntryId (5th arg)
      expect(call[1].exercise_preset_entry_id).toBe('preset-entry-1');
    }
  });
});

describe('processHevyWorkouts — duplicate workout guard', () => {
  it('processes a repeated workout id once (no orphan/empty preset entry)', async () => {
    // Same workout twice (mirrors the mock bundle holding page 1 under two keys).
    await processHevyWorkouts(
      UID,
      CID,
      [sampleWorkout(), sampleWorkout()],
      'UTC'
    );
    expect(
      exercisePresetEntryRepository.createExercisePresetEntry
    ).toHaveBeenCalledTimes(1);
    expect(exerciseEntryRepository.createExerciseEntry).toHaveBeenCalledTimes(
      3
    );
  });

  it('keeps distinct workouts with the same title on one day', async () => {
    const second = { ...sampleWorkout(), id: 'workout-def' };
    vi.mocked(exercisePresetEntryRepository.getExercisePresetEntriesByDate)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { source: 'Hevy', source_id: 'workout-abc', name: 'Vid plan A' },
      ]);
    await processHevyWorkouts(UID, CID, [sampleWorkout(), second], 'UTC');
    expect(
      exercisePresetEntryRepository.createExercisePresetEntry
    ).toHaveBeenCalledTimes(2);
    expect(
      vi
        .mocked(exercisePresetEntryRepository.createExercisePresetEntry)
        .mock.calls.map((call) => call[1].source_id)
    ).toEqual(['workout-abc', 'workout-def']);
  });
});

describe('processHevyWorkouts — import outcomes', () => {
  it('reports an unknown set type and removes the partial session', async () => {
    const workout = sampleWorkout();
    workout.exercises![1]!.sets![0]!.type = 'assisted';

    const result = await processHevyWorkouts(UID, CID, [workout], 'UTC');

    expect(result).toEqual({
      imported: 0,
      skipped: 0,
      failed: [
        { id: 'workout-abc', message: 'Unsupported Hevy set type: assisted' },
      ],
    });
    expect(
      exercisePresetEntryRepository.deleteExercisePresetEntry
    ).toHaveBeenCalledWith('preset-entry-1', UID);
  });

  it('reports an imported workout and skips a repeated ID', async () => {
    const result = await processHevyWorkouts(
      UID,
      CID,
      [sampleWorkout(), sampleWorkout()],
      'UTC'
    );

    expect(result).toEqual({ imported: 1, skipped: 1, failed: [] });
  });

  it('removes a newly created partial session and reports the failure', async () => {
    vi.mocked(exerciseEntryRepository.createExerciseEntry)
      .mockResolvedValueOnce({ id: 'entry-1' })
      .mockRejectedValueOnce(new Error('set write failed'));

    const result = await processHevyWorkouts(
      UID,
      CID,
      [sampleWorkout()],
      'UTC'
    );

    expect(result).toEqual({
      imported: 0,
      skipped: 0,
      failed: [{ id: 'workout-abc', message: 'set write failed' }],
    });
    expect(
      exercisePresetEntryRepository.deleteExercisePresetEntry
    ).toHaveBeenCalledWith('preset-entry-1', UID);
  });

  it('reports cleanup failure so a partial workout is not silently treated as retryable', async () => {
    vi.mocked(
      exerciseEntryRepository.createExerciseEntry
    ).mockRejectedValueOnce(new Error('set write failed'));
    vi.mocked(
      exercisePresetEntryRepository.deleteExercisePresetEntry
    ).mockRejectedValueOnce(new Error('session delete failed'));

    const result = await processHevyWorkouts(
      UID,
      CID,
      [sampleWorkout()],
      'UTC'
    );

    expect(result.failed[0]?.message).toContain(
      'partial-session cleanup failed'
    );
    expect(result.failed[0]?.message).toContain('Manual review is required');
  });
});

describe('processHevyRoutines — saved templates', () => {
  const routine: HevyRoutine = {
    id: 'routine-1',
    title: 'Vid plan A',
    exercises: [
      {
        index: 0,
        title: 'Bench Press',
        notes: 'Pause at the bottom',
        rest_seconds: 90,
        superset_id: 0,
        sets: [
          {
            index: 0,
            type: 'normal',
            weight_kg: 60,
            reps: null,
            rep_range: { start: 8, end: 12 },
            distance_meters: null,
            duration_seconds: null,
            rpe: null,
          },
          {
            index: 1,
            type: 'dropset',
            weight_kg: 40,
            reps: 10,
            distance_meters: null,
            duration_seconds: null,
            rpe: null,
          },
        ],
      },
      {
        index: 1,
        title: 'Pull Up',
        superset_id: 0,
        sets: [],
      },
    ],
  };

  it('imports a saved routine with a stable source identity and mapped sets', async () => {
    await processHevyRoutines(UID, CID, [routine]);
    expect(workoutPresetRepository.createWorkoutPreset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Vid plan A',
        source: 'Hevy',
        source_id: 'routine-1',
        exercises: [
          expect.objectContaining({
            superset_group: 1,
            notes: 'Pause at the bottom',
            sets: [
              expect.objectContaining({
                reps: 8,
                rest_time: 90,
                notes: expect.stringContaining('8–12'),
              }),
              expect.objectContaining({ set_type: 'Drop Set' }),
            ],
          }),
          expect.objectContaining({ superset_group: 1 }),
        ],
      })
    );
  });

  it('preserves a locally edited import on re-sync', async () => {
    vi.mocked(
      workoutPresetRepository.getWorkoutPresetBySource
    ).mockResolvedValueOnce({ id: 42 });
    await processHevyRoutines(UID, CID, [routine]);
    expect(workoutPresetRepository.createWorkoutPreset).not.toHaveBeenCalled();
  });

  it('does not mistake a local preset with the same title for this Hevy routine', async () => {
    vi.mocked(workoutPresetRepository.getWorkoutPresetByName).mockResolvedValue(
      { id: 7 }
    );
    await processHevyRoutines(UID, CID, [routine]);
    expect(
      workoutPresetRepository.getWorkoutPresetByName
    ).not.toHaveBeenCalled();
    expect(workoutPresetRepository.createWorkoutPreset).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: 'routine-1' })
    );
  });

  it('reports a failed saved routine and continues to the next one', async () => {
    vi.mocked(workoutPresetRepository.createWorkoutPreset)
      .mockRejectedValueOnce(new Error('preset write failed'))
      .mockResolvedValueOnce({ id: 43 });

    const result = await processHevyRoutines(UID, CID, [
      routine,
      { ...routine, id: 'routine-2', title: 'Vid plan B' },
    ]);

    expect(result).toEqual({
      imported: 1,
      skipped: 0,
      failed: [{ id: 'routine-1', message: 'preset write failed' }],
    });
    expect(workoutPresetRepository.createWorkoutPreset).toHaveBeenCalledTimes(
      2
    );
  });
});

describe('processHevyWorkouts — re-sync cleanup', () => {
  it('never range-deletes Hevy history during re-sync', async () => {
    const older = sampleWorkout();
    older.id = 'workout-old';
    older.start_time = '2026-07-08T05:00:00+00:00';
    older.end_time = '2026-07-08T06:00:00+00:00';
    await processHevyWorkouts(UID, CID, [sampleWorkout(), older], 'UTC');

    expect(
      exerciseEntryRepository.deleteExerciseEntriesByEntrySourceAndDate
    ).not.toHaveBeenCalled();
    expect(
      exercisePresetEntryRepository.deleteExercisePresetEntriesByEntrySourceAndDate
    ).not.toHaveBeenCalled();
  });

  it('preserves an existing workout identified by a source exercise', async () => {
    vi.mocked(
      exerciseEntryRepository.getExistingExerciseSourceIds
    ).mockResolvedValueOnce(['workout-abc_0']);
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    expect(
      exercisePresetEntryRepository.createExercisePresetEntry
    ).not.toHaveBeenCalled();
    expect(exerciseEntryRepository.createExerciseEntry).not.toHaveBeenCalled();
  });

  it('preserves an ambiguous same-title same-day legacy session', async () => {
    vi.mocked(
      exercisePresetEntryRepository.getExercisePresetEntriesByDate
    ).mockResolvedValueOnce([{ source: 'Hevy', name: 'Vid plan A' }]);
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');
    expect(
      exercisePresetEntryRepository.createExercisePresetEntry
    ).not.toHaveBeenCalled();
  });
});

describe('processHevyWorkouts — raw JSON activity detail', () => {
  it('stores full_activity_data per entry', async () => {
    await processHevyWorkouts(UID, CID, [sampleWorkout()], 'UTC');

    expect(activityDetailsRepository.createActivityDetail).toHaveBeenCalledWith(
      UID,
      expect.objectContaining({
        exercise_entry_id: 'entry-1',
        provider_name: 'Hevy',
        detail_type: 'full_activity_data',
        detail_data: expect.objectContaining({
          workout: expect.objectContaining({ id: 'workout-abc' }),
          exercise: expect.objectContaining({ title: 'Bulgarian Split Squat' }),
        }),
      })
    );
    // One detail row per exercise
    expect(
      activityDetailsRepository.createActivityDetail
    ).toHaveBeenCalledTimes(3);
  });
});
