import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import {
  instantToDay,
  addDays,
  type MobilityOperation,
  mobilitySessionSchema,
} from '@workspace/shared';
import { getClient, getSystemClient, endPool } from '../db/poolManager.js';
import {
  applyMobilityOperation,
  getMobilitySnapshot,
  materializeMobilityPlans,
} from '../services/mobilityService.js';
import { buildMobilityTools } from '../ai/tools/mobilityTools.js';
import { normalizeMcpToolArguments } from '../utils/mcpArguments.js';
import { mobilityOperationSchema } from '@workspace/shared';
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
    process.env.SPARKY_FITNESS_DB_PORT !==
      (process.env.XOT_VISUAL_DB_PORT ?? '55432') ||
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
    it('saves a five-minute assistant routine with nullable fields exactly once on retry', async () => {
      const fiveMinute = {
        ...routine,
        id: randomUUID(),
        name: 'Synthetic assistant five-minute routine',
        steps: [
          {
            ...routine.steps[0],
            id: randomUUID(),
            durationSeconds: 300,
            exerciseId: null,
          },
        ],
      };
      const request = op({ kind: 'routine', data: fiveMinute, deleted: false });
      const parsed = mobilityOperationSchema.parse(
        normalizeMcpToolArguments('xot_update_mobility', request)
      );
      const tool = buildMobilityTools(alice).xot_update_mobility;
      const options = {
        toolCallId: 'synthetic-mobility',
        messages: [],
        context: {},
      };
      expect(await tool.execute!(parsed, options)).toBe('{"revision":1}');
      expect(await tool.execute!(parsed, options)).toBe('{"revision":1}');
      const stored = await owner.query<{
        data: typeof fiveMinute;
        revision: number;
      }>(
        'SELECT data,revision FROM mobility_routines WHERE user_id=$1 AND id=$2',
        [alice, fiveMinute.id]
      );
      expect(stored.rows).toHaveLength(1);
      expect(stored.rows[0].revision).toBe(1);
      expect(stored.rows[0].data.steps).toEqual(fiveMinute.steps);
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

    it('never creates plans on GET, including past ranges; the explicit planner only creates today/future occurrences', async () => {
      const source = { ...routine, id: randomUUID() };
      await applyMobilityOperation(
        bob,
        op({ kind: 'routine', data: source, deleted: false })
      );
      await applyMobilityOperation(
        bob,
        op({
          kind: 'schedule',
          data: {
            id: randomUUID(),
            routineId: source.id,
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            time: '18:00',
            startDay: addDays(today, -30),
            endDay: null,
            enabled: true,
          },
          deleted: false,
        })
      );
      await owner.query('DELETE FROM mobility_plans WHERE user_id=$1', [bob]);
      await getMobilitySnapshot(bob, addDays(today, -30), addDays(today, 30));
      const count = await owner.query(
        'SELECT count(*) AS n FROM mobility_plans WHERE user_id=$1',
        [bob]
      );
      expect(Number(count.rows[0].n)).toBe(0);
      await materializeMobilityPlans(bob);
      const generated = await getMobilitySnapshot(
        bob,
        addDays(today, -30),
        addDays(today, 30)
      );
      expect(generated.plans.length).toBeGreaterThan(0);
      expect(generated.plans.every((row) => row.data.day >= today)).toBe(true);
    });
    it('moves plan dates and relationships in both JSON and indexed columns', async () => {
      const source = { ...routine, id: randomUUID() };
      await applyMobilityOperation(
        bob,
        op({ kind: 'routine', data: source, deleted: false })
      );
      const schedule = {
        id: randomUUID(),
        routineId: source.id,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        time: '18:00',
        startDay: today,
        endDay: null,
        enabled: false,
      };
      await applyMobilityOperation(
        bob,
        op({ kind: 'schedule', data: schedule, deleted: false })
      );
      const other = { ...source, id: randomUUID() };
      await applyMobilityOperation(
        bob,
        op({ kind: 'routine', data: other, deleted: false })
      );
      await applyMobilityOperation(
        bob,
        op(
          {
            kind: 'schedule',
            data: { ...schedule, routineId: other.id },
            deleted: false,
          },
          1
        )
      );
      expect(
        (
          await owner.query(
            'SELECT routine_id FROM mobility_schedules WHERE user_id=$1 AND id=$2',
            [bob, schedule.id]
          )
        ).rows[0].routine_id
      ).toBe(other.id);
      const plan = {
        id: randomUUID(),
        routine: source,
        scheduleId: null,
        day: today,
        time: '18:00',
        state: 'planned' as const,
        activeSessionId: null,
      };
      await applyMobilityOperation(
        bob,
        op({ kind: 'plan', data: plan, deleted: false })
      );
      const moved = {
        ...plan,
        day: addDays(today, 2),
        scheduleId: schedule.id,
      };
      await applyMobilityOperation(
        bob,
        op({ kind: 'plan', data: moved, deleted: false }, 1)
      );
      expect(
        (await getMobilitySnapshot(bob, moved.day, moved.day)).plans.find(
          (row) => row.data.id === plan.id
        )?.data
      ).toEqual(moved);
      expect(
        (await getMobilitySnapshot(bob, today, today)).plans.some(
          (row) => row.data.id === plan.id
        )
      ).toBe(false);
      const indexed = await owner.query(
        'SELECT schedule_id,local_day::text AS day FROM mobility_plans WHERE user_id=$1 AND id=$2',
        [bob, plan.id]
      );
      expect(indexed.rows[0]).toEqual({
        schedule_id: schedule.id,
        day: moved.day,
      });
    });

    it('keeps unrelated pending mobility reminders when a different definition changes', async () => {
      const subject = randomUUID(),
        slot = randomUUID();
      await owner.query(
        "INSERT INTO engagement_occurrences(user_id,kind,subject_id,local_day,scheduled_at,settings_revision,slot_key) VALUES($1,'mobility',$2,$3,now()+interval '1 hour',1,$4)",
        [bob, subject, today, slot]
      );
      await applyMobilityOperation(
        bob,
        op({
          kind: 'routine',
          data: { ...routine, id: randomUUID() },
          deleted: false,
        })
      );
      expect(
        (
          await owner.query(
            'SELECT status FROM engagement_occurrences WHERE user_id=$1 AND slot_key=$2',
            [bob, slot]
          )
        ).rows[0].status
      ).toBe('pending');
    });
    it('replays reordered JSON once and prunes expired receipts without permitting a stale mutation', async () => {
      const source = { ...routine, id: randomUUID() };
      const operation = op({ kind: 'routine', data: source, deleted: false });
      await applyMobilityOperation(bob, operation);
      const reordered = {
        ...operation,
        mutation: {
          deleted: false,
          data: { ...source, name: source.name },
          kind: 'routine' as const,
        },
      };
      expect(await applyMobilityOperation(bob, reordered)).toEqual({
        revision: 1,
      });
      for (const source of ['phone', 'web']) {
        const fingerprint = createHash('sha256')
          .update(JSON.stringify([operation, source]))
          .digest('hex');
        await owner.query(
          'UPDATE mobility_operations SET request_fingerprint=$3 WHERE user_id=$1 AND operation_id=$2',
          [bob, operation.operationId, fingerprint]
        );
        expect(await applyMobilityOperation(bob, operation, 'api')).toEqual({
          revision: 1,
        });
      }
      await owner.query(
        "UPDATE mobility_operations SET created_at=now()-interval '91 days' WHERE user_id=$1 AND operation_id=$2",
        [bob, operation.operationId]
      );
      await applyMobilityOperation(
        bob,
        op(
          {
            kind: 'routine',
            data: { ...source, name: 'Updated' },
            deleted: false,
          },
          1
        )
      );
      expect(
        (
          await owner.query(
            'SELECT 1 FROM mobility_operations WHERE user_id=$1 AND operation_id=$2',
            [bob, operation.operationId]
          )
        ).rowCount
      ).toBe(0);
      await expect(applyMobilityOperation(bob, operation)).rejects.toThrow(
        'changed elsewhere'
      );
    });
    it('preserves v2 capability, language and local ownership on an older-protocol token refresh', async () => {
      const id = randomUUID();
      const registration = {
        installation_id: id,
        expo_push_token: `ExpoPushToken[${randomUUID()}]`,
        platform: 'ios' as const,
      };
      await upsertEngagementDevice(bob, {
        ...registration,
        protocol_version: 2,
        reminder_kinds: ['check_in', 'habit'],
        delivery_owner: 'local',
        language: 'de',
      });
      await upsertEngagementDevice(bob, registration);
      expect(
        (
          await owner.query(
            'SELECT protocol_version,reminder_kinds,delivery_owner,language FROM engagement_devices WHERE user_id=$1 AND installation_id=$2',
            [bob, id]
          )
        ).rows[0]
      ).toEqual({
        protocol_version: 2,
        reminder_kinds: ['check_in', 'habit'],
        delivery_owner: 'local',
        language: 'de',
      });
    });
    it('acknowledges the new plan revision and preserves closed session provenance on deletion', async () => {
      const plan = {
        id: randomUUID(),
        routine,
        scheduleId: null,
        day: today,
        time: '18:00',
        state: 'planned' as const,
        activeSessionId: null,
      };
      await applyMobilityOperation(
        alice,
        op({ kind: 'plan', data: plan, deleted: false })
      );
      const session = mobilitySessionSchema.parse({
        id: randomUUID(),
        planId: plan.id,
        routine,
        state: 'finished',
        phase: 'step',
        stepIndex: 0,
        phaseStartedAt: null,
        elapsedSeconds: 0,
        outcomes: [],
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      });
      await expect(
        applyMobilityOperation(
          alice,
          op({ kind: 'session', data: session, deleted: false }),
          'mcp'
        )
      ).rejects.toThrow('explicit plan result');
      const result = await applyMobilityOperation(
        alice,
        op({ kind: 'session', data: session, deleted: false }),
        'api'
      );
      expect(result.plan).toMatchObject({
        revision: 2,
        data: { state: 'completed', activeSessionId: session.id },
      });
      await applyMobilityOperation(
        alice,
        op({ kind: 'session', data: session, deleted: true }, 1),
        'web'
      );
      const row = (
        await owner.query(
          'SELECT provenance,plan_id,deleted FROM mobility_sessions WHERE user_id=$1 AND id=$2',
          [alice, session.id]
        )
      ).rows[0];
      expect(row).toEqual({
        provenance: 'api',
        plan_id: plan.id,
        deleted: true,
      });
      expect(
        (await getMobilitySnapshot(alice)).plans.find(
          (row) => row.data.id === plan.id
        )?.revision
      ).toBe(2);
    });

    it('upgrades v2 without cancelling pending reminders for any owner or kind', async () => {
      const schema = `xot_review_${randomUUID().replaceAll('-', '')}`;
      await owner.query('BEGIN');
      try {
        await owner.query(
          `CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}",public`
        );
        await owner.query(`CREATE TABLE engagement_settings (user_id uuid);
          CREATE TABLE engagement_devices (user_id uuid);
          CREATE TABLE engagement_occurrences (id uuid, user_id uuid, kind text CHECK (kind IN ('hydration','meal_capture','meal_review','movement_break','mobility')),local_day date,scheduled_at timestamptz,status text,UNIQUE(user_id,kind,local_day,scheduled_at))`);
        await owner.query(
          "INSERT INTO engagement_occurrences VALUES($1,$2,'hydration',$3,now(),'pending'),($4,$5,'mobility',$3,now(),'pending'),($6,$5,'meal_review',$3,now(),'pending')",
          [randomUUID(), alice, today, randomUUID(), bob, randomUUID()]
        );
        await owner.query(
          readFileSync(
            new URL(
              '../db/migrations/20260930101000_engagement_v2.sql',
              import.meta.url
            ),
            'utf8'
          )
        );
        expect(
          (
            await owner.query(
              "SELECT count(*)::int AS n FROM engagement_occurrences WHERE status='pending'"
            )
          ).rows[0].n
        ).toBe(3);
      } finally {
        await owner.query('ROLLBACK');
      }
    });
    it('repairs stale lookup columns without changing stored snapshots or deleting history', async () => {
      const schema = `xot_review_${randomUUID().replaceAll('-', '')}`;
      const id = randomUUID(),
        oldRelation = randomUUID(),
        relation = randomUUID();
      await owner.query('BEGIN');
      try {
        await owner.query(
          `CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}",public`
        );
        await owner.query(`CREATE TABLE mobility_schedules (routine_id uuid,data jsonb);
          CREATE TABLE mobility_plans (schedule_id uuid,local_day date,data jsonb);
          CREATE TABLE mobility_sessions (plan_id uuid,data jsonb)`);
        await owner.query('INSERT INTO mobility_schedules VALUES($1,$2)', [
          oldRelation,
          { id, routineId: relation },
        ]);
        await owner.query('INSERT INTO mobility_plans VALUES($1,$2,$3)', [
          oldRelation,
          today,
          { id, scheduleId: relation, day: addDays(today, 1) },
        ]);
        await owner.query('INSERT INTO mobility_sessions VALUES($1,$2)', [
          oldRelation,
          { id, planId: relation },
        ]);
        await owner.query(
          readFileSync(
            new URL(
              '../db/migrations/20260930121000_mobility_snapshot_indexes.sql',
              import.meta.url
            ),
            'utf8'
          )
        );
        expect(
          (await owner.query('SELECT routine_id FROM mobility_schedules'))
            .rows[0].routine_id
        ).toBe(relation);
        expect(
          (
            await owner.query(
              'SELECT schedule_id,local_day::text AS day FROM mobility_plans'
            )
          ).rows[0]
        ).toEqual({ schedule_id: relation, day: addDays(today, 1) });
        expect(
          (await owner.query('SELECT plan_id,data FROM mobility_sessions'))
            .rows[0]
        ).toEqual({ plan_id: relation, data: { id, planId: relation } });
      } finally {
        await owner.query('ROLLBACK');
      }
    });
  }
);
