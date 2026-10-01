/** Opt-in only: disposable migrated *_test database, never production. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { endPool, getClient, getSystemClient } from '../db/poolManager.js';
import plans, {
  preparePlannedActivityExercise,
} from '../models/workoutPlanTemplateRepository.js';
import { readProgressObjectives } from '../models/dailyProgressObjectives.js';

const owner = randomUUID();
const other = randomUUID();
const day = '2026-10-05';
describe.runIf(process.env.RUN_WEEKLY_ACTIVITY_INTEGRATION_TEST === '1')(
  'weekly activities with migrated schema and real RLS',
  () => {
    beforeAll(async () => {
      if (!process.env.SPARKY_FITNESS_DB_NAME?.endsWith('_test'))
        throw new Error('Use a disposable *_test database.');
      const db = await getSystemClient();
      try {
        for (const id of [owner, other])
          await db.query(
            'INSERT INTO public."user" (id,email,email_verified) VALUES ($1,$2,true)',
            [id, `plan-${id}@example.test`]
          );
      } finally {
        db.release();
      }
    });
    afterAll(async () => {
      const db = await getSystemClient();
      try {
        await db.query('DELETE FROM public."user" WHERE id = ANY($1::uuid[])', [
          [owner, other],
        ]);
      } finally {
        db.release();
        await endPool();
      }
    });
    it('persists activity targets/history for a Better Auth owner without a retired auth row', async () => {
      const created = await plans.createWorkoutPlanTemplate(
        {
          user_id: owner,
          plan_name: 'Synthetic weekly sessions',
          start_date: day,
          is_active: true,
          schedule_type: 'weekly',
          entry_mode: 'prompt',
          assignments: [
            {
              day_of_week: 1,
              activity_type: 'running',
              planned_distance_km: 10,
              planned_time: '07:30',
              session_name: '10 km run',
            },
            {
              day_of_week: 1,
              activity_type: 'strength',
              planned_duration_minutes: 45,
            },
            { day_of_week: 2, activity_type: 'soccer', is_optional: true },
            { day_of_week: 3, activity_type: 'rest' },
          ],
        },
        day
      );
      const id = String(created.id);
      const read = await plans.getWorkoutPlanTemplateById(id, owner);
      expect(read?.assignments?.map((a) => a.activity_type)).toEqual([
        'running',
        'strength',
        'soccer',
        'rest',
      ]);
      expect(read?.assignments?.[0].planned_distance_km).toBe(10);
      const objectives = await readProgressObjectives(owner, day, false);
      expect(objectives.workouts).toHaveLength(2);
      expect(objectives.workouts?.every((a) => a.recorded_at === null)).toBe(
        true
      );
      expect(
        (await readProgressObjectives(other, day, false)).workouts
      ).toHaveLength(0);
      const assignment = read!.assignments![0];
      const exercise = await preparePlannedActivityExercise(
        owner,
        id,
        Number(assignment.id),
        'Laufen'
      );
      expect(
        await preparePlannedActivityExercise(
          owner,
          id,
          Number(assignment.id),
          'Laufen'
        )
      ).toBe(exercise);
      await expect(
        preparePlannedActivityExercise(
          other,
          id,
          Number(assignment.id),
          'Laufen'
        )
      ).rejects.toThrow('not found');
      const db = await getClient(owner);
      try {
        const security = await db.query(
          "SELECT row_security_active('public.workout_plan_template_assignments') AS active"
        );
        expect(security.rows[0].active).toBe(true);
        expect(
          (
            await db.query('SELECT id FROM exercise_entries WHERE user_id=$1', [
              owner,
            ])
          ).rowCount
        ).toBe(0);
        const history = await db.query(
          'SELECT assignments FROM workout_plan_template_versions WHERE user_id=$1',
          [owner]
        );
        expect(history.rows[0].assignments[0].plannedDistanceKm).toBe(10);
      } finally {
        db.release();
      }
      await plans.updateWorkoutPlanTemplate(
        id,
        owner,
        {
          plan_name: 'Revised',
          start_date: day,
          is_active: true,
          assignments: read!.assignments!.map((a) => ({
            ...a,
            day_of_week: 2,
          })),
        },
        day
      );
      expect(
        (await readProgressObjectives(owner, day, false)).workouts
      ).toHaveLength(0);
      expect(
        (await readProgressObjectives(owner, '2026-10-06', false)).workouts
      ).toHaveLength(3);
    });
  }
);
