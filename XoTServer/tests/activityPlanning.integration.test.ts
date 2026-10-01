import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { dayOfWeek, todayInZone } from '@workspace/shared';
import { getSystemClient, getClient, endPool } from '../db/poolManager.js';
import {
  getActivityPlanning,
  resolveActivityPlanning,
} from '../services/activityPlanningService.js';
const enabled =
  process.env.XOT_ACTIVITY_TEST_DB === 'isolated' &&
  process.env.SPARKY_FITNESS_DB_NAME === 'sparkyfitness_visual' &&
  process.env.SPARKY_FITNESS_DB_HOST === '127.0.0.1';
describe.skipIf(!enabled)(
  'activity planning isolated PostgreSQL / RLS / races',
  () => {
    const owner = randomUUID();
    const stranger = randomUUID();
    const exercise = randomUUID();
    const entry = randomUUID();
    const day = todayInZone('UTC');
    let template = 0;
    let assignment = 0;
    let system: PoolClient;
    beforeAll(async () => {
      system = await getSystemClient();
      await system.query(
        'INSERT INTO public."user"(id,name,email,email_verified,created_at,updated_at) VALUES($1,$3,$4,true,NOW(),NOW()),($2,$3,$5,true,NOW(),NOW())',
        [
          owner,
          stranger,
          'Synthetic activity test',
          `${owner}@example.test`,
          `${stranger}@example.test`,
        ]
      );
      await system.query(
        "INSERT INTO exercises(id,user_id,name,source,modality) VALUES($1,$2,'Running','manual','duration')",
        [exercise, owner]
      );
      template = (
        await system.query<{ id: number }>(
          "INSERT INTO workout_plan_templates(user_id,plan_name,start_date,is_active,schedule_type) VALUES($1,'Synthetic week',$2,true,'weekly') RETURNING id",
          [owner, day]
        )
      ).rows[0].id;
      assignment = (
        await system.query<{ id: number }>(
          'INSERT INTO workout_plan_template_assignments(template_id,day_of_week,exercise_id,sort_order) VALUES($1,$2,$3,0) RETURNING id',
          [template, dayOfWeek(day), exercise]
        )
      ).rows[0].id;
      await system.query(
        "INSERT INTO workout_plan_assignment_sets(assignment_id,set_number,set_type,duration) VALUES($1,1,'duration',600)",
        [assignment]
      );
      await system.query(
        'INSERT INTO workout_plan_template_versions(user_id,template_id,effective_from,plan_name,start_date,is_active,assignments) SELECT user_id,id,$2,plan_name,start_date,is_active,workout_plan_assignments_snapshot(id) FROM workout_plan_templates WHERE id=$1',
        [template, day]
      );
      await system.query(
        "INSERT INTO exercise_entries(id,user_id,exercise_id,exercise_name,entry_date,duration_minutes,calories_burned,source) VALUES($1,$2,$3,'Running',$4,10,75,'manual')",
        [entry, owner, exercise, day]
      );
    });
    afterAll(async () => {
      if (system) {
        await system.query(
          'DELETE FROM public."user" WHERE id=ANY($1::uuid[])',
          [[owner, stranger]]
        );
        system.release();
      }
      await endPool();
    });
    it('reads actual snapshots without writing or guessing completion', async () => {
      const snapshot = await getActivityPlanning(owner, day, day);
      expect(snapshot.occurrences[0].state).toBe('pending');
      expect(
        snapshot.workout_plans[0].assignments[0].exercises?.[0]
      ).toMatchObject({ name: 'Running', expectedSets: 1 });
      expect(
        (
          await system.query<{ count: string }>(
            'SELECT COUNT(*) FROM activity_plan_resolutions WHERE user_id=$1',
            [owner]
          )
        ).rows[0].count
      ).toBe('0');
    });
    it('serializes conflicting writes, repeats safely, undoes and invalidates deleted evidence', async () => {
      const id = `workout:${template}:${assignment}:${day}`;
      const results = await Promise.allSettled([
        resolveActivityPlanning(owner, {
          occurrence_id: id,
          expected_revision: 0,
          action: 'skip',
        }),
        resolveActivityPlanning(owner, {
          occurrence_id: id,
          expected_revision: 0,
          action: 'link',
          record_id: entry,
        }),
      ]);
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1
      );
      expect(results.filter((row) => row.status === 'rejected')).toHaveLength(
        1
      );
      const current = (await getActivityPlanning(owner, day, day))
        .occurrences[0];
      expect(current.revision).toBe(1);
      await resolveActivityPlanning(owner, {
        occurrence_id: id,
        expected_revision: 1,
        action: 'undo',
      });
      await resolveActivityPlanning(owner, {
        occurrence_id: id,
        expected_revision: 2,
        action: 'link',
        record_id: entry,
      });
      expect(
        (
          await resolveActivityPlanning(owner, {
            occurrence_id: id,
            expected_revision: 2,
            action: 'link',
            record_id: entry,
          })
        ).occurrences[0]
      ).toMatchObject({ revision: 3, state: 'complete' });
      expect(
        (
          await system.query<{
            calories_burned: number;
            duration_minutes: number;
          }>(
            'SELECT calories_burned,duration_minutes FROM exercise_entries WHERE id=$1',
            [entry]
          )
        ).rows[0]
      ).toEqual({ calories_burned: 75, duration_minutes: 10 });
      await system.query('DELETE FROM exercise_entries WHERE id=$1', [entry]);
      expect(
        (await getActivityPlanning(owner, day, day)).occurrences[0]
      ).toMatchObject({ state: 'pending', reason: 'linked_record_missing' });
    });
    it('denies cross-owner rows including a delegated database context', async () => {
      expect(
        (await getActivityPlanning(stranger, day, day)).occurrences
      ).toEqual([]);
      const actor: PoolClient = await getClient(owner, stranger);
      try {
        expect(
          (
            await actor.query(
              'SELECT * FROM activity_plan_resolutions WHERE user_id=$1',
              [owner]
            )
          ).rows
        ).toEqual([]);
        await expect(
          actor.query(
            "INSERT INTO activity_plan_resolutions(user_id,occurrence_id,local_day,revision,action) VALUES($1,'forbidden',$2,1,'skip')",
            [owner, day]
          )
        ).rejects.toThrow();
      } finally {
        actor.release();
      }
    });
  }
);
