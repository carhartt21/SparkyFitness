import { randomUUID } from 'node:crypto';
import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
} from 'vitest';
import type { PoolClient } from 'pg';
import {
  coachingSettingsResponseSchema,
  coachingContextSchema,
  type CoachingRunReportV2,
} from '@workspace/shared';
import { getSystemClient, getClient, endPool } from '../db/poolManager.js';
import {
  createCoachingAgent,
  getCoachingSettings,
  getCoachingSettingsV2,
  patchCoachingSettingsV2,
  patchCoachingSettings,
  claimCoachingRun,
  reportCoachingRun,
  getCoachingContext,
  getCoachingSnapshot,
  requestCoachingRun,
  submitCoachingProposals,
} from '../services/coachingRunService.js';
import { collectReviewEvidence } from '../services/coachingCalendarEvidence.js';
import {
  listCoachingRecaps,
  getCoachingRecap,
  markCoachingRecapRead,
  deleteCoachingRecap,
} from '../services/coachingRecapService.js';
const enabled = process.env.XOT_COACHING_DB_TEST === '1';
if (
  enabled &&
  (process.env.SPARKY_FITNESS_DB_HOST !== '127.0.0.1' ||
    process.env.SPARKY_FITNESS_DB_PORT !==
      (process.env.XOT_COACHING_TEST_DB_PORT ?? '55432') ||
    process.env.SPARKY_FITNESS_DB_NAME !== 'sparkyfitness_visual')
)
  throw new Error(
    'Review tests require the disposable visual-sample database.'
  );
describe.skipIf(!enabled)(
  'durable bidirectional review loop in PostgreSQL',
  () => {
    let db: PoolClient, owner: string, other: string, agentId: string;
    beforeAll(async () => {
      process.env.XOT_COACHING_ENABLED = 'true';
      db = await getSystemClient();
    });
    beforeEach(async () => {
      owner = randomUUID();
      other = randomUUID();
      for (const id of [owner, other]) {
        await db.query(
          'INSERT INTO "user"(id,email,name,email_verified) VALUES($1,$2,$3,true)',
          [id, `${id}@example.invalid`, 'Synthetic review loop']
        );
        await db.query(
          'INSERT INTO user_preferences(user_id,timezone) VALUES($1,$2)',
          [id, 'Europe/Berlin']
        );
      }
      await patchCoachingSettingsV2(owner, {
        expectedRevision: 0,
        enabled: true,
        reviewTime: '00:00',
        cadences: ['daily', 'weekly', 'monthly', 'yearly'],
      });
      agentId = (
        await createCoachingAgent(owner, {
          name: 'Synthetic v2',
          domains: [
            'nutrition',
            'habits',
            'measurements',
            'activity',
            'recovery',
          ],
          protocolVersion: 2,
          contextPermissions: [],
        })
      ).id;
    });
    afterEach(async () => {
      await db.query('DELETE FROM "user" WHERE id=ANY($1::uuid[])', [
        [owner, other],
      ]);
    });
    afterAll(async () => {
      db.release();
      await endPool();
    });
    const claim = async () => {
      const value = await claimCoachingRun(owner, agentId, randomUUID(), 2);
      if (!value || !('feedbackThrough' in value))
        throw new Error('Missing v2 claim');
      return value;
    };
    const report = (
      value: Awaited<ReturnType<typeof claim>>,
      overrides: Partial<CoachingRunReportV2> = {}
    ) =>
      reportCoachingRun(
        owner,
        agentId,
        {
          runId: value.run.id,
          leaseToken: value.leaseToken,
          operationId: randomUUID(),
          status: 'succeeded',
          processedEventCursor: value.feedbackThrough,
          recap: {
            title: 'Synthetischer Rückblick',
            summary: 'Es sind keine Änderungen erforderlich.',
            observations: [],
            limitations: ['Fehlende Einträge bleiben unbekannt.'],
          },
          ...overrides,
        },
        2
      );
    it('keeps legacy projections strict and legacy edits preserve new configuration', async () => {
      expect(
        coachingSettingsResponseSchema.safeParse(
          await getCoachingSettings(owner)
        ).success
      ).toBe(true);
      expect(
        coachingContextSchema.safeParse(await getCoachingContext(owner, null))
          .success
      ).toBe(true);
      await patchCoachingSettings(owner, {
        expectedRevision: 1,
        digestTime: '18:00',
      });
      expect((await getCoachingSettingsV2(owner)).settings).toMatchObject({
        reviewTime: '00:00',
        cadences: ['daily', 'weekly', 'monthly', 'yearly'],
        digestTime: '18:00',
      });
      const legacy = (
        await createCoachingAgent(owner, {
          name: 'Synthetic old',
          domains: ['nutrition'],
        })
      ).id;
      expect(await claimCoachingRun(owner, legacy, randomUUID())).toBeNull();
    });
    it('completes each cadence independently, keeps receipts and survives retention and recap deletion', async () => {
      const kinds: string[] = [];
      for (let index = 0; index < 4; index++) {
        const value = await claim();
        kinds.push(value.run.kind);
        const op = randomUUID(),
          result = await report(value, { operationId: op });
        expect(await report(value, { operationId: op })).toEqual(result);
      }
      expect(kinds).toEqual(['yearly', 'monthly', 'weekly', 'daily']);
      expect(
        await claimCoachingRun(owner, agentId, randomUUID(), 2)
      ).toBeNull();
      const list = await listCoachingRecaps(owner);
      expect(list.unreadCount).toBe(4);
      await db.query('DELETE FROM coaching_runs WHERE user_id=$1', [owner]);
      expect((await listCoachingRecaps(owner)).recaps).toHaveLength(4);
      await deleteCoachingRecap(owner, list.recaps[0]!.id);
      expect(
        await claimCoachingRun(owner, agentId, randomUUID(), 2)
      ).toBeNull();
    });
    it('does not publish or acknowledge feedback after failure or invalid recap', async () => {
      const value = await claim();
      await expect(
        report(value, {
          recap: {
            title: 'Invalid',
            summary: 'Invalid',
            observations: [{ text: 'Invented', rowIds: ['made-up'] }],
            limitations: [],
          },
        })
      ).rejects.toThrow('accessible frozen evidence');
      expect((await listCoachingRecaps(owner)).recaps).toEqual([]);
      await expect(
        report(value, { processedEventCursor: value.feedbackThrough + 1 })
      ).rejects.toThrow('frozen feedback boundary');
      await reportCoachingRun(
        owner,
        agentId,
        {
          runId: value.run.id,
          leaseToken: value.leaseToken,
          operationId: randomUUID(),
          status: 'failed',
          failureCode: 'invalid_output',
        },
        2
      );
      expect(
        (await getCoachingSettingsV2(owner)).agents[0]?.processedEventCursor
      ).toBe(0);
      expect((await listCoachingRecaps(owner)).recaps).toEqual([]);
    });
    it('freezes feedback boundaries, leaves later decisions for the next run and publishes no-change recaps', async () => {
      const value = await claim();
      await db.query(
        "INSERT INTO coaching_events(user_id,kind,data) VALUES($1,'owner_feedback',$2)",
        [owner, { reason: 'Synthetic later feedback' }]
      );
      const context = await getCoachingContext(owner, agentId, { version: 2 });
      expect(
        context.events.every((event) => event.sequence <= value.feedbackThrough)
      ).toBe(true);
      await report(value);
      const next = await getCoachingContext(owner, agentId, { version: 2 });
      expect(next.events.some((event) => event.kind === 'owner_feedback')).toBe(
        true
      );
      expect((await listCoachingRecaps(owner)).recaps[0]?.proposalIds).toEqual(
        []
      );
    });
    it('enforces owner RLS and keeps read/delete independent from health records', async () => {
      const result = await report(await claim());
      if (!('recapId' in result) || !result.recapId)
        throw new Error('No recap');
      await expect(getCoachingRecap(other, result.recapId)).rejects.toThrow(
        'not found'
      );
      const delegated = await getClient(owner, other);
      try {
        expect(
          (
            await delegated.query(
              'SELECT id FROM coaching_recaps WHERE user_id=$1',
              [owner]
            )
          ).rows
        ).toEqual([]);
      } finally {
        delegated.release();
      }
      await markCoachingRecapRead(owner, result.recapId);
      expect((await listCoachingRecaps(owner)).unreadCount).toBe(0);
      await deleteCoachingRecap(owner, result.recapId);
      expect((await listCoachingRecaps(owner)).recaps).toEqual([]);
    });
    it('requires both supplement consents and never includes medication entries', async () => {
      const supplement = randomUUID(),
        medication = randomUUID();
      await db.query(
        'INSERT INTO medications(id,user_id,name,is_supplement) VALUES($1,$2,$3,true),($4,$2,$5,false)',
        [
          supplement,
          owner,
          'Synthetic supplement',
          medication,
          'Private medication',
        ]
      );
      await db.query(
        "INSERT INTO medication_entries(user_id,medication_id,status,entry_date,med_name_snapshot) VALUES($1,$2,'taken','2025-06-01',$3),($1,$4,'taken','2025-06-01',$5)",
        [
          owner,
          supplement,
          'Synthetic supplement',
          medication,
          'Private medication',
        ]
      );
      const client = await getClient(owner, owner);
      try {
        const none = await collectReviewEvidence(
          client,
          owner,
          ['nutrition'],
          [],
          '2025-01-01',
          '2025-12-31',
          true
        );
        expect(JSON.stringify(none)).not.toContain('Synthetic supplement');
        const opted = await collectReviewEvidence(
          client,
          owner,
          ['nutrition'],
          ['supplement_adherence'],
          '2025-01-01',
          '2025-12-31',
          true
        );
        expect(JSON.stringify(opted)).toContain('Synthetic supplement');
        expect(JSON.stringify(opted)).not.toContain('Private medication');
      } finally {
        client.release();
      }
      const settings = (await getCoachingSettingsV2(owner)).settings;
      await patchCoachingSettingsV2(owner, {
        expectedRevision: settings.revision,
        contextPermissions: ['supplement_adherence'],
      });
      await requestCoachingRun(owner, randomUUID());
      const value = await claim();
      const page = await getCoachingSnapshot(owner, agentId, value.snapshotId);
      expect(page.rows.some((row) => row.kind === 'supplement_adherence')).toBe(
        false
      ); // connection did not opt in
    });
    it('retrieves bounded monthly metrics and notification history without fabricating receipt or unseen data', async () => {
      await db.query(
        "INSERT INTO check_in_measurements(user_id,entry_date,weight) VALUES($1,'2025-06-01',80),($1,'2025-06-15',NULL)",
        [owner]
      );
      const client = await getClient(owner, owner);
      try {
        const evidence = await collectReviewEvidence(
          client,
          owner,
          ['measurements', 'habits'],
          ['notification_history'],
          '2025-01-01',
          '2025-12-31',
          true
        );
        expect(
          evidence.rows.every(
            (row) => !['measurement', 'food', 'sleep'].includes(row.kind)
          )
        ).toBe(true);
        const metric = evidence.rows.find(
          (row) => row.source === 'measurement'
        );
        expect(metric?.value).toMatchObject({
          recordedEntries: 2,
          metrics: { meanWeightKg: 80, knownWeightEntries: 1 },
        });
        expect(
          evidence.rows.filter(
            (row) =>
              row.kind === 'notification_history' && row.source === 'server'
          )
        ).toHaveLength(0);
        expect(
          evidence.rows.find((row) => row.source === 'settings')?.value
        ).toMatchObject({ settings: { schema_version: 2 } });
      } finally {
        client.release();
      }
    });
    it('does not disclose optional evidence through another connection’s published proposals or decision feedback', async () => {
      const value = await claim();
      const settings = (await getCoachingSettingsV2(owner)).settings;
      // Enabling an optional context cancels frozen work; obtain a fresh claim under explicit consent.
      await patchCoachingSettingsV2(owner, {
        expectedRevision: settings.revision,
        contextPermissions: ['notification_history'],
      });
      const permitted = (
        await createCoachingAgent(owner, {
          name: 'Opted review',
          domains: ['habits'],
          protocolVersion: 2,
          contextPermissions: ['notification_history'],
        })
      ).id;
      await requestCoachingRun(owner, randomUUID(), []);
      const fresh = await claimCoachingRun(owner, permitted, randomUUID(), 2);
      if (!fresh || !('feedbackThrough' in fresh))
        throw new Error('Missing claim');
      const snapshot = await getCoachingSnapshot(
        owner,
        permitted,
        fresh.snapshotId
      );
      const fact = snapshot.rows.find(
        (row) => row.kind === 'notification_history'
      );
      if (!fact) throw new Error('Missing notification settings fact');
      const today = (await getCoachingContext(owner, null, { version: 2 }))
        .today;
      const staged = await submitCoachingProposals(owner, permitted, {
        runId: fresh.run.id,
        leaseToken: fresh.leaseToken,
        operationId: randomUUID(),
        proposals: [
          {
            topic: 'private-context',
            domain: 'habits',
            title: 'Private reminder review',
            rationale: 'Based on optional settings.',
            benefit: 'Review reminder preferences.',
            impact: 1,
            effort: 'low',
            confidence: 0.1,
            evidence: [
              {
                rowIds: [fact.id],
                from: fresh.run.from,
                to: fresh.run.to,
                coverage: 0,
                freshness: 'unknown',
                unit: null,
                limitation: 'Settings are not delivery.',
              },
            ],
            success: {
              metric: 'habit_completion',
              subjectId: null,
              unit: 'ratio',
              baseline: null,
              target: 1,
              direction: 'minimum',
              minimumCoverage: 0,
              reviewDay: today,
            },
            action: {
              kind: 'task',
              title: 'Review reminders',
              description: '',
              dueDay: today,
              reminderTime: null,
            },
            expiresDay: today,
          },
        ],
      });
      await reportCoachingRun(
        owner,
        permitted,
        {
          runId: fresh.run.id,
          leaseToken: fresh.leaseToken,
          operationId: randomUUID(),
          status: 'succeeded',
          processedEventCursor: fresh.feedbackThrough,
          recap: {
            title: 'Review',
            summary: 'No direct changes.',
            observations: [],
            limitations: [],
          },
        },
        2
      );
      const allowed = await getCoachingContext(owner, permitted, {
        version: 2,
      });
      expect(allowed.proposals.map((item) => item.id)).toContain(
        staged.proposalIds[0]
      );
      const denied = await getCoachingContext(owner, agentId, { version: 2 });
      expect(denied.proposals).toEqual([]);
      expect(
        denied.events.some(
          (event) => event.proposalId === staged.proposalIds[0]
        )
      ).toBe(false);
      // Revoked work cannot finish or publish under the changed permission snapshot.
      await expect(report(value)).rejects.toThrow();
    });
    it('rejects binding another account or an unknown OAuth client', async () => {
      await expect(
        createCoachingAgent(owner, {
          name: 'Unauthorized',
          domains: ['nutrition'],
          protocolVersion: 2,
          contextPermissions: [],
          oauthClientId: 'not-authorized',
        })
      ).rejects.toThrow('authorized assistant');
    });
  }
);
