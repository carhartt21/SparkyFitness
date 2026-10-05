import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as sharedSchemas from '@workspace/shared';
import type { PoolClient } from 'pg';
import {
  addDays,
  instantToDay,
  localDateTimeToUtc,
  type CoachingProposalInput,
  type CoachingAction,
} from '@workspace/shared';
import { getSystemClient, getClient, endPool } from '../db/poolManager.js';
import {
  createCoachingAgent,
  patchCoachingSettings,
  requestCoachingRun,
  claimCoachingRun,
  getCoachingSnapshot,
  submitCoachingProposals,
  reportCoachingRun,
  revokeCoachingAgent,
} from '../services/coachingRunService.js';
import {
  previewCoachingProposal,
  reviewCoachingProposal,
  patchCoachingCommitment,
  deleteCoachingProposalHistory,
} from '../services/coachingReviewService.js';
import {
  getCoachingPlanningContext,
  coachingReferenceState,
} from '../services/coachingPlanningService.js';
import workoutPlanRepository from '../models/workoutPlanTemplateRepository.js';
import { applyReviewedWorkoutPlan } from '../services/workoutPlanTemplateService.js';
import { getActivityPlanning } from '../services/activityPlanningService.js';
import { collectCoachingEvidence } from '../services/coachingEvidenceService.js';
import { createCoachingCredential } from '../services/coachingCredentialService.js';
import { maintainCoachingOwner } from '../services/coachingMaintenanceService.js';
import {
  getEngagementSettingsV2,
  patchEngagementSettings,
  upsertEngagementDevice,
} from '../services/engagementService.js';
import { planEngagementOccurrences } from '../services/engagementDeliveryService.js';
import {
  getPlannedMeals,
  confirmPlannedMeal,
} from '../services/mealPlanOccurrenceService.js';

const enabled = process.env.XOT_COACHING_DB_TEST === '1';
if (
  enabled &&
  (process.env.SPARKY_FITNESS_DB_HOST !== '127.0.0.1' ||
    process.env.SPARKY_FITNESS_DB_PORT !==
      (process.env.XOT_COACHING_TEST_DB_PORT ?? '55432') ||
    process.env.SPARKY_FITNESS_DB_NAME !== 'sparkyfitness_visual')
)
  throw new Error(
    'Coaching tests require the disposable visual-sample database.'
  );
describe.skipIf(!enabled)('owner-only coaching workflow in PostgreSQL', () => {
  const alice = randomUUID(),
    bob = randomUUID(),
    today = instantToDay(new Date(), 'Europe/Berlin');
  let db: PoolClient,
    agentId: string,
    claim: NonNullable<Awaited<ReturnType<typeof claimCoachingRun>>>;
  let foodId: string, variantId: string, mealTypeId: string;
  const proposal = (topic: string): CoachingProposalInput => ({
    topic,
    domain: 'nutrition',
    title: 'Synthetic review',
    rationale: 'Recorded nutrition coverage is limited.',
    impact: 4,
    benefit: 'Record a complete day.',
    effort: 'low',
    confidence: 0.5,
    evidence: [
      {
        rowIds: ['coverage:nutrition'],
        from: claim?.run.from ?? today,
        to: claim?.run.to ?? today,
        coverage: 0,
        freshness: 'unknown',
        unit: null,
        limitation: 'Synthetic sample has no complete diary.',
      },
    ],
    success: {
      metric: 'protein',
      subjectId: null,
      unit: 'g',
      baseline: null,
      target: 80,
      direction: 'minimum',
      minimumCoverage: 0.7,
      reviewDay: addDays(today, 7),
    },
    action: {
      kind: 'task',
      title: 'Review diary',
      description: '',
      dueDay: today,
      reminderTime: '20:00',
    },
    expiresDay: addDays(today, 14),
  });
  const stage = async (input: CoachingProposalInput) =>
    (
      await submitCoachingProposals(alice, agentId, {
        runId: claim.run.id,
        leaseToken: claim.leaseToken,
        operationId: randomUUID(),
        proposals: [input],
      })
    ).proposalIds[0];
  const publish = () =>
    reportCoachingRun(alice, agentId, {
      runId: claim.run.id,
      leaseToken: claim.leaseToken,
      operationId: randomUUID(),
      status: 'succeeded',
    });
  const start = async () => {
    await requestCoachingRun(alice, randomUUID(), []);
    const result = await claimCoachingRun(alice, agentId, randomUUID());
    if (!result) throw new Error('No queued run');
    claim = result;
  };
  beforeAll(async () => {
    process.env.XOT_COACHING_ENABLED = 'true';
    db = await getSystemClient();
    for (const id of [alice, bob]) {
      await db.query(
        'INSERT INTO "user"(id,email,name,email_verified) VALUES($1,$2,$3,true)',
        [id, `${id}@example.invalid`, 'Synthetic coaching']
      );
      await db.query(
        'INSERT INTO user_preferences(user_id,timezone) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET timezone=$2',
        [id, 'Europe/Berlin']
      );
    }
    await patchCoachingSettings(alice, {
      expectedRevision: 0,
      enabled: true,
      domains: ['nutrition'],
    });
    agentId = (
      await createCoachingAgent(alice, {
        name: 'Test runner',
        domains: ['nutrition'],
      })
    ).id;
    foodId = randomUUID();
    variantId = randomUUID();
    mealTypeId = randomUUID();
    await db.query(
      "INSERT INTO foods(id,user_id,name,is_custom,is_quick_food) VALUES($1,$2,'Synthetic oats',true,false)",
      [foodId, alice]
    );
    await db.query(
      "INSERT INTO food_variants(id,food_id,serving_size,serving_unit,calories,protein,carbs,fat,is_default) VALUES($1,$2,100,'g',400,12,60,8,true)",
      [variantId, foodId]
    );
    await db.query(
      "INSERT INTO meal_types(id,user_id,name) VALUES($1,$2,'Synthetic lunch')",
      [mealTypeId, alice]
    );
  });
  afterAll(async () => {
    if (db) {
      await db.query('DELETE FROM "user" WHERE id=ANY($1::uuid[])', [
        [alice, bob],
      ]);
      db.release();
    }
    await endPool();
  });
  it('queries scoped library kinds without unused SQL parameters', async () => {
    const foods = await getCoachingPlanningContext(alice, agentId, {
      kind: 'food',
    });
    expect(foods.items.some((item) => item.id === foodId)).toBe(true);
    const variants = await getCoachingPlanningContext(alice, agentId, {
      kind: 'variant',
    });
    expect(variants.items.some((item) => item.id === variantId)).toBe(true);
    expect(
      (await getCoachingPlanningContext(alice, agentId, { kind: 'exercise' }))
        .items
    ).toEqual([]);
  });
  it('reads all five selected domains and explicit mobility evidence without leaking deselected goals', async () => {
    const sessionId = randomUUID(),
      routineId = randomUUID(),
      stepId = randomUUID(),
      now = new Date().toISOString();
    const routine = {
      id: routineId,
      name: 'Synthetic mobility',
      steps: [
        {
          id: stepId,
          kind: 'timed',
          name: 'Synthetic step',
          instructions: '',
          side: 'both',
          transitionSeconds: 0,
          durationSeconds: 30,
        },
      ],
      cue: 'off',
      reminderTime: null,
      createdAt: now,
      updatedAt: now,
    };
    const session = {
      id: sessionId,
      routine,
      state: 'finished',
      phase: 'step',
      stepIndex: 0,
      phaseStartedAt: null,
      elapsedSeconds: 30,
      outcomes: [{ stepId, result: 'completed', recordedAt: now }],
      startedAt: now,
      endedAt: now,
    };
    await db.query(
      "INSERT INTO mobility_sessions(user_id,id,revision,data,provenance) VALUES($1,$2,1,$3,'web')",
      [alice, sessionId, session]
    );
    const owner = await getClient(alice, alice);
    try {
      const all = await collectCoachingEvidence(
        owner,
        alice,
        ['nutrition', 'activity', 'recovery', 'habits', 'measurements'],
        addDays(today, -7),
        today
      );
      expect(new Set(all.rows.map((row) => row.domain))).toEqual(
        new Set(['nutrition', 'activity', 'recovery', 'habits', 'measurements'])
      );
      expect(
        all.rows.some((row) => row.id === `mobility_session:${sessionId}`)
      ).toBe(true);
      const activity = await collectCoachingEvidence(
        owner,
        alice,
        ['activity'],
        today,
        today
      );
      expect(activity.rows.every((row) => row.domain === 'activity')).toBe(
        true
      );
      const goals = activity.rows.find((row) => row.kind === 'goals');
      expect(goals?.value).toMatchObject({
        stored: { target_exercise_duration_minutes: null },
      });
      expect(JSON.stringify(goals?.value)).not.toContain('protein');
    } finally {
      owner.release();
    }
  });
  it('reserves coaching only for capable v3 devices, shares the cap, and limits digests to one attempted delivery per day', async () => {
    await patchCoachingSettings(bob, { expectedRevision: 0, enabled: true });
    const when = localDateTimeToUtc(`${today}T19:00:00`, 'Europe/Berlin');
    const bobAgent = (
      await createCoachingAgent(bob, {
        name: 'Synthetic notification scope',
        domains: ['nutrition'],
      })
    ).id;
    await db.query(
      "INSERT INTO coaching_proposals(user_id,agent_id,run_id,snapshot_id,topic,domain,status,expires_day,data,evidence) VALUES($1,$2,$3,$4,'digest-test','nutrition','pending',$5,$6,'[]')",
      [
        bob,
        bobAgent,
        randomUUID(),
        randomUUID(),
        addDays(today, 14),
        proposal('digest-test'),
      ]
    );
    const installation = randomUUID(),
      registration = {
        installation_id: installation,
        expo_push_token: `ExpoPushToken[${randomUUID()}]`,
        platform: 'ios' as const,
      };
    await upsertEngagementDevice(bob, {
      ...registration,
      protocol_version: 2,
      reminder_kinds: ['habit'],
      delivery_owner: 'remote',
      language: 'de',
    });
    const current = await getEngagementSettingsV2(bob);
    await patchEngagementSettings(bob, {
      expected_revision: current.revision,
      remote_enabled: true,
      quiet_start: '00:00',
      quiet_end: '00:00',
      daily_limit: 1,
      hydration_enabled: false,
      meal_capture_enabled: false,
      meal_review_enabled: false,
      movement_break_enabled: false,
      mobility_enabled: false,
    });
    await planEngagementOccurrences(when);
    expect(
      (
        await db.query(
          "SELECT * FROM engagement_occurrences WHERE user_id=$1 AND kind='coaching_digest' AND status='pending'",
          [bob]
        )
      ).rows
    ).toHaveLength(0);
    await upsertEngagementDevice(bob, {
      ...registration,
      protocol_version: 3,
      reminder_kinds: ['coaching_digest', 'coaching_action'],
      delivery_owner: 'remote',
      language: 'de',
    });
    await planEngagementOccurrences(when);
    await planEngagementOccurrences(when);
    const reserved = await db.query<{ id: string; scheduled_at: Date }>(
      "SELECT id,scheduled_at FROM engagement_occurrences WHERE user_id=$1 AND kind='coaching_digest' AND status='pending'",
      [bob]
    );
    expect(reserved.rows).toHaveLength(1);
    expect(
      (
        await db.query(
          "SELECT count(*)::integer AS n FROM engagement_occurrences WHERE user_id=$1 AND status='pending'",
          [bob]
        )
      ).rows[0].n
    ).toBe(1);
    expect(instantToDay(reserved.rows[0].scheduled_at, 'Europe/Berlin')).toBe(
      today
    );
    await db.query(
      "UPDATE engagement_occurrences SET attempt_count=1,status='sent' WHERE id=$1",
      [reserved.rows[0].id]
    );
    const capped = await getEngagementSettingsV2(bob);
    await patchEngagementSettings(bob, {
      expected_revision: capped.revision,
      daily_limit: null,
    });
    await planEngagementOccurrences(when);
    expect(
      (
        await db.query(
          "SELECT * FROM engagement_occurrences WHERE user_id=$1 AND kind='coaching_digest' AND status='pending'",
          [bob]
        )
      ).rows
    ).toHaveLength(0);
    await upsertEngagementDevice(bob, registration);
    const legacy = await db.query<{
      protocol_version: number;
      reminder_kinds: string[];
    }>(
      'SELECT protocol_version,reminder_kinds FROM engagement_devices WHERE user_id=$1 AND installation_id=$2',
      [bob, installation]
    );
    expect(legacy.rows[0].protocol_version).toBe(1);
    expect(legacy.rows[0].reminder_kinds).not.toContain('coaching_digest');
    await patchEngagementSettings(bob, {
      expected_revision: capped.revision + 1,
      remote_enabled: false,
    });
  });
  it('claims once, keeps reads pure, stages invisibly, then approves atomically and retries safely', async () => {
    await requestCoachingRun(alice, randomUUID(), []);
    const operationId = randomUUID();
    const result = await claimCoachingRun(alice, agentId, operationId);
    if (!result) throw new Error('Missing claim');
    claim = result;
    expect(await claimCoachingRun(alice, agentId, operationId)).toEqual(claim);
    expect(await claimCoachingRun(alice, agentId, randomUUID())).toBeNull();
    const snapshot = await getCoachingSnapshot(
      alice,
      agentId,
      claim.snapshotId,
      0,
      100
    );
    expect(snapshot.rows.some((row) => row.id === 'coverage:nutrition')).toBe(
      true
    );
    await expect(
      getCoachingSnapshot(bob, agentId, claim.snapshotId, 0, 100)
    ).rejects.toThrow();
    const id = await stage(proposal('review-diary'));
    expect(
      (
        await db.query('SELECT status FROM coaching_proposals WHERE id=$1', [
          id,
        ])
      ).rows[0].status
    ).toBe('staged');
    await expect(
      previewCoachingProposal(alice, id, { expectedRevision: 0 })
    ).rejects.toThrow();
    expect((await publish()).publishedCount).toBe(1);
    await expect(
      previewCoachingProposal(bob, id, { expectedRevision: 0 })
    ).rejects.toThrow();
    const preview = await previewCoachingProposal(alice, id, {
      expectedRevision: 0,
    });
    const input = {
      decision: 'accept' as const,
      operationId: randomUUID(),
      expectedRevision: 0,
      previewToken: preview.previewToken,
      action: preview.action,
    };
    const accepted = await reviewCoachingProposal(alice, id, input);
    expect(await reviewCoachingProposal(alice, id, input)).toEqual(accepted);
    expect(
      (
        await db.query(
          'SELECT count(*)::integer AS n FROM coaching_actions WHERE proposal_id=$1',
          [id]
        )
      ).rows[0].n
    ).toBe(1);
    const owner = await getClient(bob, bob);
    try {
      expect(
        (
          await owner.query('SELECT * FROM coaching_proposals WHERE id=$1', [
            id,
          ])
        ).rows
      ).toEqual([]);
    } finally {
      owner.release();
    }
    await patchCoachingCommitment(alice, accepted.activationId!, {
      operationId: randomUUID(),
      expectedRevision: 0,
      status: 'completed',
    });
    expect(
      (
        await db.query(
          'SELECT count(*)::integer AS n FROM food_entries WHERE user_id=$1',
          [alice]
        )
      ).rows[0].n
    ).toBe(0);
  });
  it('rejects forged evidence and out-of-domain targets, and failures publish nothing', async () => {
    await start();
    const forged = proposal('forged');
    forged.evidence[0].rowIds = ['food:foreign'];
    await expect(stage(forged)).rejects.toThrow();
    const mixed = proposal('mixed');
    mixed.action = {
      kind: 'goals',
      effectiveDay: today,
      changes: [
        {
          field: 'target_exercise_duration_minutes',
          before: null,
          after: 30,
          unit: 'min',
        },
      ],
    };
    await expect(stage(mixed)).rejects.toThrow();
    await stage(proposal('failure'));
    await reportCoachingRun(alice, agentId, {
      runId: claim.run.id,
      leaseToken: claim.leaseToken,
      operationId: randomUUID(),
      status: 'failed',
      failureCode: 'quota',
    });
    expect(
      (
        await db.query('SELECT * FROM coaching_proposals WHERE run_id=$1', [
          claim.run.id,
        ])
      ).rows
    ).toEqual([]);
  });
  it('suppresses declined topics, validates changes before activation, and logs prompt meals only on explicit confirmation', async () => {
    await start();
    const declinedId = await stage(proposal('declined'));
    await publish();
    await reviewCoachingProposal(alice, declinedId, {
      decision: 'decline',
      expectedRevision: 0,
      operationId: randomUUID(),
    });
    await start();
    expect(await stage(proposal('declined'))).toBeUndefined();
    const meal = proposal('prompt-meal');
    meal.action = {
      kind: 'meal_plan',
      templateId: null,
      effectiveDay: today,
      definition: {
        plan_name: 'Synthetic meal plan',
        description: '',
        start_date: today,
        end_date: addDays(today, 2),
        is_active: true,
        entry_mode: 'prompt',
        assignments: [
          {
            item_type: 'food',
            day_of_week: new Date(`${today}T12:00:00Z`).getUTCDay(),
            food_id: foodId,
            variant_id: variantId,
            quantity: 50,
            unit: 'g',
            meal_type_id: mealTypeId,
          },
        ],
      },
    };
    const id = await stage(meal);
    await publish();
    const preview = await previewCoachingProposal(alice, id, {
      expectedRevision: 0,
    });
    await db.query('UPDATE food_variants SET calories=410 WHERE id=$1', [
      variantId,
    ]);
    await expect(
      reviewCoachingProposal(alice, id, {
        decision: 'accept',
        operationId: randomUUID(),
        expectedRevision: 0,
        previewToken: preview.previewToken,
        action: preview.action,
      })
    ).rejects.toThrow('changed');
    const refreshed = await previewCoachingProposal(alice, id, {
      expectedRevision: 0,
    });
    await reviewCoachingProposal(alice, id, {
      decision: 'accept',
      operationId: randomUUID(),
      expectedRevision: 0,
      previewToken: refreshed.previewToken,
      action: refreshed.action,
    });
    expect(
      (await db.query('SELECT * FROM food_entries WHERE user_id=$1', [alice]))
        .rows
    ).toEqual([]);
    const plans = await getPlannedMeals(alice, today, today);
    expect(plans).toHaveLength(1);
    const confirmation = {
      operationId: randomUUID(),
      consumedDay: today,
      quantity: 75,
      unit: 'g',
      entryTime: '12:30',
    };
    const receipt = await confirmPlannedMeal(alice, plans[0].id, confirmation);
    expect(await confirmPlannedMeal(alice, plans[0].id, confirmation)).toEqual(
      receipt
    );
    expect(
      (
        await db.query('SELECT quantity FROM food_entries WHERE user_id=$1', [
          alice,
        ])
      ).rows
    ).toHaveLength(1);
    await expect(
      confirmPlannedMeal(bob, plans[0].id, {
        ...confirmation,
        operationId: randomUUID(),
      })
    ).rejects.toThrow();
  });
  it('issues an expiring credential for a valid long agent display name', async () => {
    const agent = await createCoachingAgent(alice, {
      name: 'A valid owner-selected coaching agent display name',
      domains: ['nutrition'],
    });
    const credential = await createCoachingCredential(alice, agent.id, 86400);
    expect(credential.key).toMatch(/^xotagent_/);
    expect(credential.agent.name).toBe(agent.name);
    expect(credential.agent.expiresAt).not.toBeNull();
    await revokeCoachingAgent(alice, agent.id);
  });

  it('matches new table columns and owner RLS, and retains evidence when raw snapshots expire', async () => {
    const tables = {
      coaching_settings: sharedSchemas.coachingSettingsDatabaseSchema,
      coaching_agents: sharedSchemas.coachingAgentsSchema,
      coaching_runs: sharedSchemas.coachingRunsSchema,
      coaching_snapshots: sharedSchemas.coachingSnapshotsSchema,
      coaching_proposals: sharedSchemas.coachingProposalsSchema,
      coaching_actions: sharedSchemas.coachingActionsSchema,
      coaching_events: sharedSchemas.coachingEventsSchema,
      coaching_operations: sharedSchemas.coachingOperationsSchema,
      coaching_previews: sharedSchemas.coachingPreviewsSchema,
      meal_plan_template_versions: sharedSchemas.mealPlanTemplateVersionsSchema,
      meal_plan_log_receipts: sharedSchemas.mealPlanLogReceiptsSchema,
      meal_plans: sharedSchemas.mealPlansSchema,
      meal_plan_templates: sharedSchemas.mealPlanTemplatesSchema,
    };
    for (const [table, schema] of Object.entries(tables)) {
      const columns = await db.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
        [table]
      );
      expect(columns.rows.map((row) => row.column_name).sort()).toEqual(
        Object.keys(schema.shape).sort()
      );
      const policy = await db.query<{ relrowsecurity: boolean }>(
        "SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||$1)",
        [table]
      );
      expect(policy.rows[0].relrowsecurity).toBe(true);
    }
    const retained = await db.query<{ evidence: unknown }>(
      "SELECT evidence FROM coaching_proposals WHERE user_id=$1 AND status='accepted' ORDER BY id",
      [alice]
    );
    await db.query('DELETE FROM coaching_snapshots WHERE user_id=$1', [alice]);
    expect(
      (
        await db.query(
          "SELECT evidence FROM coaching_proposals WHERE user_id=$1 AND status='accepted' ORDER BY id",
          [alice]
        )
      ).rows
    ).toEqual(retained.rows);
    const owner = await getClient(alice, alice);
    try {
      await expect(
        owner.query(
          'INSERT INTO coaching_settings(user_id,data) VALUES($1,$2)',
          [bob, JSON.stringify(sharedSchemas.defaultCoachingSettings)]
        )
      ).rejects.toThrow(/row.level security/i);
    } finally {
      owner.release();
    }
  });
  it('includes existing workout sets and library names in planning and approval fingerprints', async () => {
    const exerciseId = randomUUID();
    await db.query(
      "INSERT INTO exercises(id,user_id,name,source,is_custom) VALUES($1,$2,'Synthetic squat','custom',true)",
      [exerciseId, alice]
    );
    const definition: Extract<
      CoachingAction,
      { kind: 'workout_plan' }
    >['definition'] = {
      plan_name: 'Synthetic workout review',
      description: '',
      start_date: today,
      end_date: null,
      is_active: true,
      entry_mode: 'prompt',
      schedule_type: 'weekly',
      assignments: [
        {
          day_of_week: 1,
          session_index: null,
          session_name: null,
          workout_preset_id: null,
          exercise_id: exerciseId,
          sort_order: 0,
          sets: [
            {
              set_number: 1,
              set_type: 'working',
              reps: 5,
              weight: 10,
              duration: null,
              rest_time: 30,
              notes: null,
            },
          ],
        },
      ],
    };
    const template = await workoutPlanRepository.createWorkoutPlanTemplate(
      { ...definition, user_id: alice },
      today
    );
    const plans = await getCoachingPlanningContext(alice, null, {
      kind: 'workout_plan',
    });
    const selected = plans.items.find(
      (item) => item.id === String(template.id)
    );
    expect(JSON.stringify(selected?.data)).toContain('"reps":5');
    const owner = await getClient(alice, alice);
    try {
      const action: Extract<CoachingAction, { kind: 'workout_plan' }> = {
        kind: 'workout_plan',
        templateId: Number(template.id),
        effectiveDay: today,
        definition: {
          ...definition,
          assignments: [
            {
              ...definition.assignments[0],
              sets: [{ ...definition.assignments[0].sets[0], reps: 8 }],
            },
          ],
        },
      };
      const state = await coachingReferenceState(owner, alice, action);
      const current = state.find(
        (row) => row.table === 'workout_plan_templates'
      );
      expect(JSON.stringify(current)).toContain('"reps":5');
      expect(
        state.some(
          (row) => row.table === 'exercises' && row.name === 'Synthetic squat'
        )
      ).toBe(true);
      await db.query(
        'UPDATE workout_plan_assignment_sets s SET reps=6 FROM workout_plan_template_assignments a WHERE s.assignment_id=a.id AND a.template_id=$1',
        [template.id]
      );
      expect(await coachingReferenceState(owner, alice, action)).not.toEqual(
        state
      );
    } finally {
      owner.release();
    }
  });
  it('accepts prompt-only whole activities and retains their prescription metadata', async () => {
    const action = sharedSchemas.coachingActionSchema.parse({
      kind: 'workout_plan',
      templateId: null,
      effectiveDay: today,
      definition: {
        plan_name: 'Synthetic whole activities',
        description: '',
        start_date: today,
        end_date: null,
        is_active: true,
        schedule_type: 'weekly',
        entry_mode: 'prompt',
        assignments: [
          {
            day_of_week: sharedSchemas.dayOfWeek(today),
            session_index: null,
            session_name: 'Synthetic walk',
            exercise_id: null,
            workout_preset_id: null,
            activity_type: 'walking',
            planned_duration_minutes: 30,
            planned_distance_km: 2,
            planned_time: '17:30',
            is_optional: true,
            sort_order: 0,
            sets: [],
          },
        ],
      },
    });
    if (action.kind !== 'workout_plan')
      throw new Error('Invalid synthetic action');
    const owner = await getClient(alice, alice);
    let templateId: number;
    try {
      await owner.query('BEGIN');
      templateId = Number(
        (await applyReviewedWorkoutPlan(owner, alice, action)).id
      );
      await owner.query('COMMIT');
    } catch (error) {
      await owner.query('ROLLBACK');
      throw error;
    } finally {
      owner.release();
    }
    const projection = await getActivityPlanning(alice, today, today);
    expect(
      projection.workout_plans.find((plan) => plan.id === templateId)
        ?.assignments[0]
    ).toMatchObject({
      activityType: 'walking',
      plannedDurationMinutes: 30,
      plannedDistanceKm: 2,
      plannedTime: '17:30:00',
      isOptional: true,
    });
    expect(
      projection.occurrences.find((row) => row.source_id === String(templateId))
    ).toMatchObject({
      state: 'pending',
      optional: true,
      activity_type: 'walking',
    });
    expect(
      (
        await db.query<{ count: string }>(
          'SELECT COUNT(*) FROM exercise_entries WHERE user_id=$1 AND workout_plan_origin_assignment_id IN (SELECT id FROM workout_plan_template_assignments WHERE template_id=$2)',
          [alice, templateId]
        )
      ).rows[0].count
    ).toBe('0');
  });
  it('owner history deletion removes cited evidence, decisions and payload-bearing retry receipts', async () => {
    await start();
    const id = await stage(proposal('delete-retained-history'));
    await publish();
    const preview = await previewCoachingProposal(alice, id, {
      expectedRevision: 0,
    });
    const operationId = randomUUID();
    const accepted = await reviewCoachingProposal(alice, id, {
      operationId,
      expectedRevision: 0,
      decision: 'accept',
      action: preview.action,
      previewToken: preview.previewToken,
    });
    await expect(deleteCoachingProposalHistory(alice, id)).rejects.toThrow(
      /Stop/
    );
    await expect(deleteCoachingProposalHistory(bob, id)).resolves.toEqual({
      deleted: true,
    });
    expect(
      (
        await db.query(
          'SELECT id FROM coaching_proposals WHERE user_id=$1 AND id=$2',
          [alice, id]
        )
      ).rows
    ).toHaveLength(1);
    await patchCoachingCommitment(alice, accepted.activationId!, {
      operationId: randomUUID(),
      expectedRevision: 0,
      status: 'stopped',
    });
    expect(
      (
        await db.query(
          'SELECT result FROM coaching_operations WHERE user_id=$1 AND operation_id=$2',
          [alice, operationId]
        )
      ).rows
    ).toHaveLength(1);
    await deleteCoachingProposalHistory(alice, id);
    for (const table of [
      'coaching_proposals',
      'coaching_actions',
      'coaching_events',
      'coaching_previews',
    ]) {
      const column = table === 'coaching_proposals' ? 'id' : 'proposal_id';
      expect(
        (
          await db.query(
            `SELECT 1 FROM ${table} WHERE user_id=$1 AND ${column}=$2`,
            [alice, id]
          )
        ).rows
      ).toHaveLength(0);
    }
    expect(
      (
        await db.query(
          "SELECT 1 FROM coaching_operations WHERE user_id=$1 AND (result->>'id'=ANY($2::text[]) OR result->'proposalIds' ? $3)",
          [alice, [id, accepted.activationId], id]
        )
      ).rows
    ).toHaveLength(0);
    await expect(
      reviewCoachingProposal(alice, id, {
        operationId,
        expectedRevision: 0,
        decision: 'accept',
        action: preview.action,
        previewToken: preview.previewToken,
      })
    ).rejects.toThrow(/not found/i);
  });
  it('enforces snapshot/run retention when processing is disabled without changing accepted actions', async () => {
    const runId = randomUUID(),
      snapshotId = randomUUID(),
      operationId = randomUUID();
    await db.query(
      "INSERT INTO coaching_runs(id,user_id,agent_id,kind,slot_key,from_day,to_day,status,created_at) VALUES($1,$2,$3,'manual',$1::uuid::text,$4,$4,'succeeded',now()-interval '100 days')",
      [runId, alice, agentId, today]
    );
    await db.query(
      "INSERT INTO coaching_snapshots(id,user_id,run_id,from_day,to_day,rows,warnings,created_at) VALUES($1,$2,$3,$4,$4,'[]','{}',now()-interval '8 days')",
      [snapshotId, alice, runId, today]
    );
    await db.query(
      "INSERT INTO coaching_operations(user_id,operation_id,agent_id,request_hash,result,created_at) VALUES($1,$2,$3,$4,'{}',now()-interval '100 days')",
      [alice, operationId, agentId, '0'.repeat(64)]
    );
    const actions = await db.query(
      'SELECT id,status,outcome,revision FROM coaching_actions WHERE user_id=$1 ORDER BY id',
      [alice]
    );
    await maintainCoachingOwner(alice, new Date(), false);
    expect(
      (
        await db.query('SELECT id FROM coaching_snapshots WHERE id=$1', [
          snapshotId,
        ])
      ).rows
    ).toHaveLength(0);
    expect(
      (await db.query('SELECT id FROM coaching_runs WHERE id=$1', [runId])).rows
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          'SELECT operation_id FROM coaching_operations WHERE user_id=$1 AND operation_id=$2',
          [alice, operationId]
        )
      ).rows
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          'SELECT id,status,outcome,revision FROM coaching_actions WHERE user_id=$1 ORDER BY id',
          [alice]
        )
      ).rows
    ).toEqual(actions.rows);
  });
  it('revocation blocks new claims immediately', async () => {
    await revokeCoachingAgent(alice, agentId);
    await expect(
      claimCoachingRun(alice, agentId, randomUUID())
    ).rejects.toThrow();
  });
});
