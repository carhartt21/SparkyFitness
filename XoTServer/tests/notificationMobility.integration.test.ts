import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import {
  instantToDay,
  type MobilityOperation,
  mobilitySessionSchema,
} from '@workspace/shared';
import { getClient, getSystemClient, endPool } from '../db/poolManager.js';
import {
  applyMobilityOperation,
  getMobilitySnapshot,
} from '../services/mobilityService.js';
import {
  patchEngagementSettings,
  getEngagementSettings,
  getEngagementSettingsV2,
  upsertEngagementDevice,
  disableEngagementDevice,
  recordMovementTimerStart,
} from '../services/engagementService.js';
import { planEngagementOccurrences } from '../services/engagementDeliveryService.js';
import { engagementPlanForUser } from '../services/engagementPlanningService.js';
const enabled = process.env.XOT_CORRECTIVE_DB_TEST === '1';
if (
  enabled &&
  (process.env.SPARKY_FITNESS_DB_HOST !== '127.0.0.1' ||
    process.env.SPARKY_FITNESS_DB_PORT !== '55432' ||
    process.env.SPARKY_FITNESS_DB_NAME !== 'sparkyfitness_visual')
)
  throw new Error(
    'Integration tests require the disposable visual-sample database.'
  );
describe.skipIf(!enabled)(
  'isolated notification/mobility persistence and RLS',
  () => {
    let owner: PoolClient;
    const alice = randomUUID(),
      bob = randomUUID(),
      device = randomUUID();
    const today = instantToDay(new Date(), 'Europe/Berlin');
    const routine = {
      id: randomUUID(),
      name: 'Synthetic mobility',
      steps: [
        {
          id: randomUUID(),
          name: 'Reach',
          instructions: '',
          side: 'both' as const,
          kind: 'timed' as const,
          durationSeconds: 30,
          transitionSeconds: 0,
        },
      ],
      cue: 'off' as const,
      reminderTime: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const op = (
      mutation: MobilityOperation['mutation'],
      expectedRevision = 0
    ): MobilityOperation => ({
      operationId: randomUUID(),
      expectedRevision,
      mutation,
    });
    beforeAll(async () => {
      owner = await getSystemClient();
      for (const id of [alice, bob]) {
        await owner.query(
          'INSERT INTO "user"(id,email,name,email_verified) VALUES($1,$2,$3,true)',
          [id, `${id}@example.invalid`, 'Synthetic release check']
        );
        await owner.query(
          'INSERT INTO user_preferences(user_id,timezone) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET timezone=$2',
          [id, 'Europe/Berlin']
        );
      }
    });
    afterAll(async () => {
      if (owner) {
        await owner.query('DELETE FROM "user" WHERE id=ANY($1::uuid[])', [
          [alice, bob],
        ]);
        owner.release();
      }
      await endPool();
    });
    it('persists unchanged local identifiers, replays receipts and rejects stale revisions', async () => {
      const operation = op({ kind: 'routine', data: routine, deleted: false });
      expect(await applyMobilityOperation(alice, operation)).toEqual({
        revision: 1,
      });
      expect(await applyMobilityOperation(alice, operation)).toEqual({
        revision: 1,
      });
      await expect(
        applyMobilityOperation(alice, {
          ...operation,
          mutation: {
            kind: 'routine',
            data: { ...routine, name: 'Different payload' },
            deleted: false,
          },
        })
      ).rejects.toThrow('Operation ID');
      await expect(
        applyMobilityOperation(
          alice,
          op({ kind: 'routine', data: routine, deleted: false })
        )
      ).rejects.toThrow('changed elsewhere');
      expect(
        (await getMobilitySnapshot(alice, today, today)).routines[0].data.id
      ).toBe(routine.id);
    });
    it('keeps owner-only records unavailable in a delegated or unrelated RLS context', async () => {
      const client: PoolClient = await getClient(alice, bob);
      try {
        const rows = await client.query(
          'SELECT * FROM mobility_routines WHERE user_id=$1',
          [alice]
        );
        expect(rows.rowCount).toBe(0);
      } finally {
        client.release();
      }
      expect((await getMobilitySnapshot(bob, today, today)).routines).toEqual(
        []
      );
    });
    it('materializes one recurring plan per date, preserving a snapshot when the routine changes', async () => {
      await applyMobilityOperation(
        alice,
        op({
          kind: 'schedule',
          data: {
            id: randomUUID(),
            routineId: routine.id,
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            time: '18:00',
            startDay: today,
            endDay: today,
            enabled: true,
          },
          deleted: false,
        })
      );
      const first = await getMobilitySnapshot(alice, today, today);
      expect(first.plans).toHaveLength(1);
      expect(
        (await getMobilitySnapshot(alice, today, today)).plans[0].data.id
      ).toBe(first.plans[0].data.id);
      await applyMobilityOperation(
        alice,
        op(
          {
            kind: 'routine',
            data: { ...routine, name: 'New library name' },
            deleted: false,
          },
          1
        )
      );
      expect(
        (await getMobilitySnapshot(alice, today, today)).plans[0].data.routine
          .name
      ).toBe('Synthetic mobility');
    });
    it('does not allow MCP to override an active phone plan, and records an explicit manual result once', async () => {
      const plan = (await getMobilitySnapshot(alice, today, today)).plans[0];
      const session = mobilitySessionSchema.parse({
        id: randomUUID(),
        planId: plan.data.id,
        routine: plan.data.routine,
        state: 'running',
        phase: 'step',
        stepIndex: 0,
        phaseStartedAt: new Date().toISOString(),
        elapsedSeconds: 0,
        outcomes: [],
        startedAt: new Date().toISOString(),
        endedAt: null,
      });
      await applyMobilityOperation(
        alice,
        op({ kind: 'session', data: session, deleted: false })
      );
      await expect(
        applyMobilityOperation(
          alice,
          op(
            {
              kind: 'result',
              planId: plan.data.id,
              data: {
                state: 'completed',
                outcomes: [],
                recordedAt: new Date().toISOString(),
              },
            },
            2
          ),
          'mcp'
        )
      ).rejects.toThrow('active or already resolved');
      await applyMobilityOperation(
        alice,
        op(
          {
            kind: 'session',
            data: {
              ...session,
              state: 'finished',
              endedAt: new Date().toISOString(),
            },
            deleted: false,
          },
          1
        )
      );
      const another = {
        ...plan.data,
        id: randomUUID(),
        scheduleId: null,
        state: 'planned' as const,
        activeSessionId: null,
      };
      await applyMobilityOperation(
        alice,
        op({ kind: 'plan', data: another, deleted: false }),
        'web'
      );
      const result = op(
        {
          kind: 'result',
          planId: another.id,
          data: {
            state: 'completed',
            outcomes: [],
            recordedAt: new Date().toISOString(),
          },
        },
        1
      );
      await applyMobilityOperation(alice, result, 'mcp');
      await applyMobilityOperation(alice, result, 'mcp');
      const snapshot = await getMobilitySnapshot(alice, today, today);
      const recorded = snapshot.sessions.filter(
        (row) => row.data.planId === another.id
      );
      expect(recorded).toHaveLength(1);
      expect(recorded[0].provenance).toBe('mcp');
      expect(recorded[0].data.outcomes).toEqual([]);
    });
    it('updates imported reminder clocks without overwriting separately edited schedules', async () => {
      const imported = { ...routine, id: randomUUID(), reminderTime: '09:00' };
      await applyMobilityOperation(
        alice,
        op({ kind: 'routine', data: imported, deleted: false }),
        'import'
      );
      await applyMobilityOperation(
        alice,
        op(
          {
            kind: 'routine',
            data: { ...imported, reminderTime: '10:00' },
            deleted: false,
          },
          1
        )
      );
      let schedule = (
        await getMobilitySnapshot(alice, today, today)
      ).schedules.find((row) => row.data.id === imported.id)!;
      expect(schedule.data.time).toBe('10:00');
      await applyMobilityOperation(
        alice,
        op(
          {
            kind: 'schedule',
            data: { ...schedule.data, time: '11:00' },
            deleted: false,
          },
          schedule.revision
        ),
        'web'
      );
      await applyMobilityOperation(
        alice,
        op(
          {
            kind: 'routine',
            data: { ...imported, reminderTime: '12:00' },
            deleted: false,
          },
          2
        )
      );
      schedule = (
        await getMobilitySnapshot(alice, today, today)
      ).schedules.find((row) => row.data.id === imported.id)!;
      expect(schedule.data.time).toBe('11:00');
    });
    it('retains imported older history in the default phone snapshot while date filters stay explicit', async () => {
      const session = mobilitySessionSchema.parse({
        id: randomUUID(),
        routine,
        state: 'finished',
        phase: 'step',
        stepIndex: 0,
        phaseStartedAt: null,
        elapsedSeconds: 0,
        outcomes: [],
        startedAt: '2022-08-11T10:00:00Z',
        endedAt: '2022-08-11T10:01:00Z',
      });
      await applyMobilityOperation(
        alice,
        op({ kind: 'session', data: session, deleted: false }),
        'import'
      );
      expect(
        (await getMobilitySnapshot(alice)).sessions.some(
          (row) => row.data.id === session.id
        )
      ).toBe(true);
      expect(
        (await getMobilitySnapshot(alice, today, today)).sessions.some(
          (row) => row.data.id === session.id
        )
      ).toBe(false);
    });
    it('keeps v1 readable and v2 configurable with CAS and validated windows', async () => {
      const old = await getEngagementSettings(alice);
      expect(Object.keys(old)).not.toContain('daily_limit');
      await patchEngagementSettings(alice, {
        expected_revision: old.revision,
        daily_limit: null,
        meal_capture_start: '11:00',
        meal_capture_end: '14:00',
        meal_capture_time: '12:30',
      });
      const value = await getEngagementSettingsV2(alice);
      expect(value.daily_limit).toBeNull();
      expect(value.schedule_initialized).toBe(true);
      await expect(
        patchEngagementSettings(alice, {
          expected_revision: old.revision,
          daily_limit: 5,
        })
      ).rejects.toThrow('changed elsewhere');
      await expect(
        patchEngagementSettings(alice, {
          expected_revision: value.revision,
          meal_capture_time: '15:00',
        })
      ).rejects.toThrow('inside its window');
      expect((await getEngagementSettingsV2(alice)).revision).toBe(
        value.revision
      );
    });
    it('registers protocol capabilities and disables only the requested device', async () => {
      await upsertEngagementDevice(alice, {
        installation_id: device,
        expo_push_token: `ExpoPushToken[${randomUUID()}]`,
        platform: 'ios',
        protocol_version: 2,
        reminder_kinds: ['check_in', 'habit', 'mobility'],
        delivery_owner: 'local',
        language: 'de',
      });
      const second = randomUUID();
      await upsertEngagementDevice(alice, {
        installation_id: second,
        expo_push_token: `ExpoPushToken[${randomUUID()}]`,
        platform: 'ios',
      });
      const current = await getEngagementSettingsV2(alice);
      await patchEngagementSettings(alice, {
        expected_revision: current.revision,
        remote_enabled: true,
      });
      await disableEngagementDevice(alice, device);
      const result = await owner.query(
        'SELECT installation_id,enabled,protocol_version,reminder_kinds FROM engagement_devices WHERE user_id=$1',
        [alice]
      );
      expect(
        result.rows.find(
          (row: { installation_id: string }) => row.installation_id === device
        ).enabled
      ).toBe(false);
      expect(
        result.rows.find(
          (row: { installation_id: string }) => row.installation_id === second
        ).enabled
      ).toBe(true);
      expect((await getEngagementSettingsV2(alice)).remote_enabled).toBe(true);
    });
    it('records an idempotent timer-start hint and reads normalized planner data without fabricated activity', async () => {
      const id = randomUUID(),
        start = new Date().toISOString();
      await recordMovementTimerStart(alice, id, start);
      await recordMovementTimerStart(alice, id, start);
      const count = await owner.query(
        'SELECT count(*) AS n FROM engagement_subject_states WHERE user_id=$1',
        [alice]
      );
      expect(Number(count.rows[0].n)).toBe(1);
      const plan = await engagementPlanForUser(alice);
      expect(
        plan.diagnostics.find((d) => d.kind === 'movement_break')?.reason
      ).not.toBe('scheduled');
    });
    it('reserves stable slots once, applies the nullable cap, and removes resolved prompts', async () => {
      const now = new Date(`${today}T06:00:00Z`);
      const current = await getEngagementSettingsV2(alice);
      await patchEngagementSettings(alice, {
        expected_revision: current.revision,
        remote_enabled: true,
        daily_limit: 1,
        quiet_start: '00:00',
        quiet_end: '00:00',
        hydration_enabled: false,
        meal_capture_enabled: false,
        meal_review_enabled: false,
        movement_break_enabled: false,
        mobility_enabled: true,
      });
      const deviceId = randomUUID();
      await upsertEngagementDevice(alice, {
        installation_id: deviceId,
        expo_push_token: `ExpoPushToken[${randomUUID()}]`,
        platform: 'ios',
        protocol_version: 2,
        reminder_kinds: ['mobility'],
        delivery_owner: 'remote',
        language: 'de',
      });
      const ids = [randomUUID(), randomUUID()];
      for (const [index, id] of ids.entries())
        await applyMobilityOperation(
          alice,
          op({
            kind: 'plan',
            data: {
              id,
              routine,
              scheduleId: null,
              day: today,
              time: index === 0 ? '18:00' : '19:00',
              state: 'planned',
              activeSessionId: null,
            },
            deleted: false,
          }),
          'web'
        );
      await planEngagementOccurrences(now);
      await planEngagementOccurrences(now);
      let pending = await owner.query<{ subject_id: string }>(
        "SELECT subject_id FROM engagement_occurrences WHERE user_id=$1 AND status='pending'",
        [alice]
      );
      expect(pending.rowCount).toBe(1);
      const capped = await getEngagementSettingsV2(alice);
      await patchEngagementSettings(alice, {
        expected_revision: capped.revision,
        daily_limit: null,
      });
      await planEngagementOccurrences(now);
      await planEngagementOccurrences(now);
      pending = await owner.query<{ subject_id: string }>(
        "SELECT subject_id FROM engagement_occurrences WHERE user_id=$1 AND status='pending'",
        [alice]
      );
      expect(new Set(pending.rows.map((row) => row.subject_id)).size).toBe(
        pending.rowCount
      );
      expect(pending.rows.some((row) => row.subject_id === ids[1])).toBe(true);
      await applyMobilityOperation(
        alice,
        op(
          {
            kind: 'result',
            planId: ids[1],
            data: {
              state: 'skipped',
              outcomes: [],
              recordedAt: now.toISOString(),
            },
          },
          1
        ),
        'mcp'
      );
      await planEngagementOccurrences(now);
      pending = await owner.query<{ subject_id: string }>(
        "SELECT subject_id FROM engagement_occurrences WHERE user_id=$1 AND status='pending'",
        [alice]
      );
      expect(pending.rows.some((row) => row.subject_id === ids[1])).toBe(false);
    });
  }
);
