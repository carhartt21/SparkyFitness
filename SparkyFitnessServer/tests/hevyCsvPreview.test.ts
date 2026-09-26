import { describe, expect, it } from 'vitest';
import {
  hevyCsvWorkoutsForImport,
  previewHevyWorkoutCsv,
} from '../integrations/hevy/hevyCsvPreview.js';

const HEADER =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';

describe('Hevy history CSV preview', () => {
  it('parses mixed export line endings without merging adjacent sets', () => {
    const csv =
      HEADER +
      '\r\n' +
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,"first ""quoted"" line\r\nsecond line",0,normal,40,10,,0,' +
      '\n' +
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,0,dropset,30,12,,0,' +
      '\r\n' +
      'Sample B,"21 Sep 2026, 21:42","21 Sep 2026, 22:34",,Row,,,0,normal,35,10,,0,';

    const preview = previewHevyWorkoutCsv(csv);

    expect(preview.rowCount).toBe(3);
    expect(preview.workouts).toHaveLength(2);
    expect(preview.workouts[0]?.exercises[0]?.notes).toBe(
      'first "quoted" line\r\nsecond line'
    );
    expect(preview.workouts[0]?.exercises[1]?.sets[0]?.type).toBe('dropset');
  });

  it('retains completed set semantics and separates a repeated exercise occurrence', () => {
    const csv = [
      HEADER,
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Warm Up,,,0,normal,,0,,180,',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Bench Press,1,,0,warmup,40,10,,0,',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Bench Press,1,,1,normal,60,8,,0,8',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,1,,0,normal,,12,,0,',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Bench Press,1,,0,dropset,30,12,,0,',
    ].join('\n');

    const preview = previewHevyWorkoutCsv(csv);
    expect(preview.rowCount).toBe(5);
    expect(preview.workouts).toHaveLength(1);
    expect(preview.workouts[0]?.exercises).toHaveLength(4);
    expect(preview.workouts[0]?.exercises[0]?.sets[0]).toMatchObject({
      reps: 0,
      weightKg: null,
      durationSeconds: 180,
    });
    expect(
      preview.workouts[0]?.exercises[1]?.sets.map((set) => set.type)
    ).toEqual(['warmup', 'normal']);
    expect(preview.workouts[0]?.exercises[1]?.supersetId).toBe('1');
    expect(preview.workouts[0]?.exercises[3]?.sets[0]?.type).toBe('dropset');
    expect(preview.savedRoutinesIncluded).toBe(false);
    expect(preview.timezoneRequired).toBe(true);
  });

  it('keeps workouts separate when their titles match but start times differ', () => {
    const csv = [
      HEADER,
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,0,normal,,12,,0,',
      'Sample A,"21 Sep 2026, 21:46","21 Sep 2026, 22:33",,Row,,,0,normal,,10,,0,',
    ].join('\n');
    expect(previewHevyWorkoutCsv(csv).workouts).toHaveLength(2);
  });

  it('separates adjacent repeated exercises when set numbering restarts', () => {
    const csv = [
      HEADER,
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,0,normal,40,10,,0,',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,1,normal,40,8,,0,',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,0,normal,30,12,,0,',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,1,normal,30,10,,0,',
    ].join('\n');

    const exercises = previewHevyWorkoutCsv(csv).workouts[0]?.exercises;
    expect(
      exercises?.map((exercise) => exercise.sets.map((set) => set.index))
    ).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it('warns about identical source rows without dropping either completed set', () => {
    const repeated =
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,0,normal,40,10,,0,';
    const csv = [
      HEADER,
      repeated,
      repeated,
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,1,normal,40,10,,0,',
    ].join('\n');

    const preview = previewHevyWorkoutCsv(csv);

    expect(preview.warnings).toEqual([
      'Possible duplicate: rows 2 and 3 are identical; both are retained as separate sets.',
    ]);
    expect(preview.rowCount).toBe(3);
    expect(
      preview.workouts[0]?.exercises.flatMap((exercise) => exercise.sets)
    ).toHaveLength(3);
    expect(
      hevyCsvWorkoutsForImport(preview, 'Europe/Berlin')[0]?.exercises?.flatMap(
        (exercise) => exercise.sets
      )
    ).toHaveLength(3);
  });

  it('does not merge exercise rows separated by another workout', () => {
    const csv = [
      HEADER,
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,0,normal,40,10,,0,',
      'Sample B,"21 Sep 2026, 21:42","21 Sep 2026, 22:34",,Row,,,0,normal,35,10,,0,',
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,1,normal,40,8,,0,',
    ].join('\n');

    const workouts = previewHevyWorkoutCsv(csv).workouts;
    expect(
      workouts[0]?.exercises.map((exercise) => exercise.sets.length)
    ).toEqual([1, 1]);
  });

  it('rejects malformed numeric fields rather than silently changing training data', () => {
    const csv = [
      HEADER,
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,0,normal,,oops,,0,',
    ].join('\n');
    expect(() => previewHevyWorkoutCsv(csv)).toThrow('Row 2: invalid reps');
  });

  it('rejects an unknown set type rather than importing it as a working set', () => {
    const csv = [
      HEADER,
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,,,0,assisted,30,12,,0,',
    ].join('\n');
    expect(() => previewHevyWorkoutCsv(csv)).toThrow(
      'Row 2: unsupported set_type assisted'
    );
  });

  it('converts local times, sets, and distances without inventing saved routines', () => {
    const csv = [
      HEADER,
      'Sample A,"23 Sep 2026, 21:42","23 Sep 2026, 22:34",,Row,2,,0,dropset,30,12,0.75,120,8',
    ].join('\n');
    const preview = previewHevyWorkoutCsv(csv);
    const [workout] = hevyCsvWorkoutsForImport(preview, 'Europe/Berlin');

    expect(workout).toMatchObject({
      title: 'Sample A',
      start_time: '2026-09-23T19:42:00.000Z',
      end_time: '2026-09-23T20:34:00.000Z',
      exercises: [
        {
          index: 0,
          superset_id: '2',
          sets: [
            {
              type: 'dropset',
              distance_meters: 750,
              duration_seconds: 120,
              rpe: 8,
            },
          ],
        },
      ],
    });
    expect(workout?.id).toMatch(/^csv_[a-f0-9]{64}$/);
    expect(hevyCsvWorkoutsForImport(preview, 'Europe/Berlin')[0]?.id).toBe(
      workout?.id
    );
    expect(preview.savedRoutinesIncluded).toBe(false);
  });

  it('rejects missing timezone and ambiguous DST times before import', () => {
    const csv = [
      HEADER,
      'Sample A,"25 Oct 2026, 02:30","25 Oct 2026, 03:30",,Row,,,0,normal,,10,,0,',
    ].join('\n');
    const preview = previewHevyWorkoutCsv(csv);
    expect(() => hevyCsvWorkoutsForImport(preview, '')).toThrow(
      'Valid timezone is required'
    );
    expect(() => hevyCsvWorkoutsForImport(preview, 'Europe/Berlin')).toThrow(
      'ambiguous'
    );
  });

  it('rejects nonexistent local times and reversed workouts', () => {
    const nonexistent = previewHevyWorkoutCsv(
      [
        HEADER,
        'Sample A,"29 Mar 2026, 02:30","29 Mar 2026, 03:30",,Row,,,0,normal,,10,,0,',
      ].join('\n')
    );
    expect(() =>
      hevyCsvWorkoutsForImport(nonexistent, 'Europe/Berlin')
    ).toThrow('does not exist');

    const reversed = previewHevyWorkoutCsv(
      [
        HEADER,
        'Sample A,"23 Sep 2026, 22:34","23 Sep 2026, 21:42",,Row,,,0,normal,,10,,0,',
      ].join('\n')
    );
    expect(() => hevyCsvWorkoutsForImport(reversed, 'Europe/Berlin')).toThrow(
      'ends before it starts'
    );
  });
});
