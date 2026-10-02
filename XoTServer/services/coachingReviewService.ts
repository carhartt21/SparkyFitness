import { randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import {
  instantToDay,
  coachingActionSchema,
  coachingPreviewSchema,
  coachingProposalSchema,
  coachingCommitmentSchema,
  coachingEvidenceRowSchema,
  type CoachingAction,
  type CoachingProposalRow,
  type CoachingActionRow,
  type CoachingPreview,
  type CoachingReview,
  type CoachingCommitmentPatch,
} from '@workspace/shared';
import {
  coachingTransaction,
  coachingFingerprint,
  coachingOperation,
  coachingEvent,
  CoachingConflictError,
  CoachingValidationError,
  CoachingNotFoundError,
} from '../models/coachingRepository.js';
import { readStoredGoal, upsertGoal } from '../models/goalRepository.js';
import {
  createHabit,
  updateHabit,
  upsertMeasurementReminder,
} from '../models/dailyTrackingRepository.js';
import { patchEngagementSettings } from './engagementService.js';
import { applyMobilityOperation } from './mobilityService.js';
import { applyReviewedMealPlan } from './mealPlanTemplateService.js';
import { applyReviewedWorkoutPlan } from './workoutPlanTemplateService.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { coachingReferenceState } from './coachingPlanningService.js';
import { materializePromptMealPlans } from './mealPlanOccurrenceService.js';
import { addDays } from '@workspace/shared';
import {
  mapCoachingProposal,
  mapCoachingAction,
  requireCoachingEnabled,
} from './coachingRunService.js';

const asJson = (value: unknown) =>
  z.json().parse(JSON.parse(JSON.stringify(value)) as unknown);
const presentReferences = (
  value: unknown,
  refs: Array<Record<string, unknown>>
): unknown => {
  const tables: Record<string, string> = {
    food_id: 'foods',
    variant_id: 'food_variants',
    meal_id: 'meals',
    meal_type_id: 'meal_types',
    exercise_id: 'exercises',
    exerciseId: 'exercises',
    workout_preset_id: 'workout_presets',
    habitId: 'custom_categories',
    routineId: 'mobility_routines',
    scheduleId: 'mobility_schedules',
  };
  if (Array.isArray(value))
    return value.map((item) => presentReferences(item, refs));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        const ref =
          tables[key] &&
          refs.find(
            (row) =>
              row.table === tables[key] && String(row.id) === String(item)
          );
        return [
          key,
          ref
            ? (ref.name ??
              ref.plan_name ??
              (ref.table === 'food_variants'
                ? `${String(ref.serving_size)} ${String(ref.serving_unit)}`
                : item))
            : presentReferences(item, refs),
        ];
      })
    );
  return value;
};
const goalUnits: Record<string, string> = {
  calories: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  dietary_fiber: 'g',
  saturated_fat: 'g',
  sugars: 'g',
  sodium: 'mg',
  water_goal_ml: 'ml',
  target_exercise_duration_minutes: 'min',
  target_exercise_calories_burned: 'kcal',
  caffeine_mg: 'mg',
  alcohol_g: 'g',
};
async function proposalForReview(
  client: PoolClient,
  userId: string,
  id: string,
  revision: number,
  today: string
): Promise<CoachingProposalRow> {
  const result = await client.query<CoachingProposalRow>(
    'SELECT * FROM coaching_proposals WHERE user_id=$1 AND id=$2 FOR UPDATE',
    [userId, id]
  );
  const proposal = result.rows[0];
  if (!proposal) throw new CoachingNotFoundError('Recommendation not found.');
  if (proposal.status !== 'pending' || proposal.revision !== revision)
    throw new CoachingConflictError(
      'This recommendation was already reviewed or changed.'
    );
  if (proposal.data.expiresDay < today)
    throw new CoachingConflictError(
      'This recommendation expired. Request a fresh review.'
    );
  return proposal;
}

async function activationPreview(
  client: PoolClient,
  userId: string,
  action: CoachingAction,
  today: string,
  lock = false
): Promise<{
  state: unknown;
  effects: CoachingPreview['effects'];
  warnings: string[];
}> {
  const refs = await coachingReferenceState(client, userId, action, lock);
  const effects: CoachingPreview['effects'] = [];
  const warnings: string[] = [];
  let current: unknown = null;
  if ('effectiveDay' in action && action.effectiveDay < today)
    throw new CoachingValidationError(
      'Changes can only take effect today or in the future.'
    );
  if (action.kind === 'task' || action.kind === 'objective') {
    if (action.dueDay < today)
      throw new CoachingValidationError(
        'Choose a due date today or in the future.'
      );
    effects.push({
      label: action.kind,
      before: null,
      after: asJson(action),
      unit: null,
    });
  } else if (action.kind === 'goals') {
    current = await readStoredGoal(client, userId, action.effectiveDay, lock);
    const stored =
      current && typeof current === 'object'
        ? (current as Record<string, unknown>)
        : {};
    for (const change of action.changes) {
      const before =
        stored[change.field] === null || stored[change.field] === undefined
          ? null
          : Number(stored[change.field]);
      if (before !== change.before)
        throw new CoachingConflictError(
          'The stored target changed. Refresh the recommendation before accepting.'
        );
      if (change.unit !== goalUnits[change.field])
        throw new CoachingValidationError(
          'Target units must match the stored metric unit.'
        );
      effects.push({
        label: `goals.${change.field}`,
        before,
        after: change.after,
        unit: change.unit,
      });
    }
    warnings.push(
      'Stored targets change; calculated goal modes and nutrient goal directions remain in effect.'
    );
  } else if (action.kind === 'notification_settings') {
    const result = await client.query<{ data: unknown }>(
      'SELECT to_jsonb(s) AS data FROM engagement_settings s WHERE user_id=$1 ' +
        (lock ? 'FOR UPDATE' : ''),
      [userId]
    );
    current = result.rows[0]?.data ?? null;
    effects.push({
      label: 'notification_settings',
      before: asJson(current),
      after: asJson(action.changes),
      unit: null,
    });
  } else if (action.kind === 'measurement_reminder') {
    const result = await client.query<{ data: unknown }>(
      'SELECT to_jsonb(m) AS data FROM measurement_reminders m WHERE user_id=$1 AND measurement_key=$2 ' +
        (lock ? 'FOR UPDATE' : ''),
      [userId, action.definition.measurement_key]
    );
    current = result.rows[0]?.data ?? null;
    effects.push({
      label: 'measurement_reminder',
      before: asJson(current),
      after: asJson(action.definition),
      unit: null,
    });
  } else if (action.kind === 'habit') {
    current = refs.find((ref) => ref.table === 'custom_categories') ?? null;
    effects.push({
      label: 'habit',
      before: asJson(current),
      after: asJson(action.definition),
      unit: null,
    });
  } else if (action.kind === 'meal_plan' || action.kind === 'workout_plan') {
    if (action.definition.start_date < action.effectiveDay)
      throw new CoachingValidationError(
        'The plan schedule must start on or after its effective date.'
      );
    current =
      refs.find(
        (ref) =>
          ref.table ===
          (action.kind === 'meal_plan'
            ? 'meal_plan_templates'
            : 'workout_plan_templates')
      ) ?? null;
    effects.push({
      label: action.kind,
      before: asJson(current),
      after: asJson(action.definition),
      unit: null,
    });
    warnings.push(
      action.kind === 'meal_plan'
        ? 'Meals are scheduled only. Confirm consumption to add food diary entries.'
        : 'Workouts are scheduled only. Start and complete exercise sets in the app to record activity.'
    );
    const otherPlans = await client.query<{
      plan_name: string;
      updated_at: Date;
    }>(
      action.kind === 'meal_plan'
        ? "SELECT plan_name,updated_at FROM meal_plan_templates WHERE user_id=$1 AND is_active AND ($2::uuid IS NULL OR id<>$2) AND start_date<=COALESCE($4::date,'infinity'::date) AND (end_date IS NULL OR end_date>=$3::date) ORDER BY plan_name"
        : "SELECT plan_name,updated_at FROM workout_plan_templates WHERE user_id=$1 AND is_active AND ($2::integer IS NULL OR id<>$2) AND start_date<=COALESCE($4::date,'infinity'::date) AND (end_date IS NULL OR end_date>=$3::date) ORDER BY plan_name",
      [
        userId,
        action.templateId,
        action.definition.start_date,
        action.definition.end_date,
      ]
    );
    if (otherPlans.rows.length)
      warnings.push(
        `Other active plans share this date range: ${otherPlans.rows.map((plan) => plan.plan_name).join(', ')}. Check the scheduled days before activating.`
      );
    {
      const overlap = await client.query<{ count: number }>(
        action.kind === 'meal_plan'
          ? 'SELECT count(*)::integer AS count FROM food_entries WHERE user_id=$1 AND entry_date>=$2 AND ($3::date IS NULL OR entry_date<=$3)'
          : 'SELECT count(*)::integer AS count FROM exercise_entries WHERE user_id=$1 AND entry_date>=$2 AND ($3::date IS NULL OR entry_date<=$3)',
        [userId, action.definition.start_date, action.definition.end_date]
      );
      if (overlap.rows[0].count)
        warnings.push(
          `${overlap.rows[0].count} existing diary entries overlap the new schedule. They are preserved; avoid logging the same intake or activity twice.`
        );
    }
  } else if (action.kind === 'mobility') {
    current = refs.find((ref) => ref.table === 'mobility_routines') ?? null;
    if (
      action.definition.schedule &&
      action.definition.schedule.startDay < today
    )
      throw new CoachingValidationError(
        'Mobility scheduling must start today or later.'
      );
    effects.push({
      label: 'mobility',
      before: asJson(current),
      after: asJson(action.definition),
      unit: null,
    });
  }
  return { state: { current, refs, warnings }, effects, warnings };
}

export async function previewCoachingProposal(
  userId: string,
  proposalId: string,
  input: { expectedRevision: number; action?: CoachingAction }
) {
  requireCoachingEnabled();
  const today = instantToDay(new Date(), await loadUserTimezone(userId));
  return coachingTransaction(userId, async (client) => {
    const proposal = await proposalForReview(
      client,
      userId,
      proposalId,
      input.expectedRevision,
      today
    );
    const action = coachingActionSchema.parse(
      input.action ?? proposal.data.action
    );
    if (action.kind !== proposal.data.action.kind)
      throw new CoachingValidationError(
        'Keep the recommendation action type when editing.'
      );
    const preview = await activationPreview(client, userId, action, today);
    const previewToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await client.query(
      'INSERT INTO coaching_previews(user_id,token,proposal_id,revision,action,state_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        userId,
        previewToken,
        proposalId,
        proposal.revision,
        JSON.stringify(action),
        coachingFingerprint(preview.state),
        expiresAt,
      ]
    );
    return coachingPreviewSchema.parse({
      proposalId,
      revision: proposal.revision,
      action,
      previewToken,
      expiresAt,
      effects: preview.effects.map((effect) => ({
        ...effect,
        before: asJson(
          presentReferences(
            effect.before,
            (preview.state as { refs: Array<Record<string, unknown>> }).refs
          )
        ),
        after: asJson(
          presentReferences(
            effect.after,
            (preview.state as { refs: Array<Record<string, unknown>> }).refs
          )
        ),
      })),
      warnings: preview.warnings,
    });
  });
}
async function activate(
  client: PoolClient,
  userId: string,
  proposalId: string,
  action: CoachingAction
): Promise<Array<{ domain: string; id: string }>> {
  if (action.kind === 'habit') {
    const { habit_type: _type, ...patch } = action.definition;
    const habit = action.habitId
      ? await updateHabit(userId, userId, action.habitId, patch, client)
      : await createHabit(userId, userId, action.definition, client);
    return [{ domain: 'habit', id: habit.id }];
  }
  if (action.kind === 'measurement_reminder') {
    const reminder = await upsertMeasurementReminder(
      userId,
      action.definition,
      client
    );
    return [{ domain: 'measurement_reminder', id: reminder.id }];
  }
  if (action.kind === 'notification_settings') {
    const current = await client.query<{ revision: number }>(
      'SELECT revision FROM engagement_settings WHERE user_id=$1',
      [userId]
    );
    await patchEngagementSettings(
      userId,
      { ...action.changes, expected_revision: current.rows[0]?.revision ?? 0 },
      client
    );
    return [{ domain: 'notification_settings', id: userId }];
  }
  if (action.kind === 'goals') {
    const stored = await readStoredGoal(client, userId, action.effectiveDay);
    const changes = Object.fromEntries(
      action.changes.map((change) => [change.field, change.after])
    );
    const result = (await upsertGoal(
      {
        ...stored,
        ...changes,
        user_id: userId,
        goal_date: action.effectiveDay,
      },
      client
    )) as { id: string };
    return [{ domain: 'goals', id: result.id }];
  }
  if (action.kind === 'meal_plan') {
    const plan = await applyReviewedMealPlan(client, userId, action);
    await materializePromptMealPlans(
      client,
      userId,
      action.effectiveDay,
      addDays(action.effectiveDay, 30)
    );
    return [{ domain: 'meal_plan', id: plan.id }];
  }
  if (action.kind === 'workout_plan') {
    const plan = await applyReviewedWorkoutPlan(client, userId, action);
    return [{ domain: 'workout_plan', id: String(plan.id) }];
  }
  if (action.kind === 'mobility') {
    const now = new Date().toISOString(),
      routineId = action.routineId ?? randomUUID();
    const existing = await client.query<{
      revision: number;
      data: { createdAt: string };
    }>(
      'SELECT revision,data FROM mobility_routines WHERE user_id=$1 AND id=$2',
      [userId, routineId]
    );
    const { schedule, ...definition } = action.definition;
    await applyMobilityOperation(
      userId,
      {
        operationId: randomUUID(),
        expectedRevision: existing.rows[0]?.revision ?? 0,
        mutation: {
          kind: 'routine',
          data: {
            ...definition,
            id: routineId,
            reminderTime: null,
            createdAt: existing.rows[0]?.data.createdAt ?? now,
            updatedAt: now,
          },
          deleted: false,
        },
      },
      'api',
      client
    );
    const refs = [{ domain: 'mobility_routine', id: routineId }];
    if (schedule) {
      const scheduleId = action.scheduleId ?? randomUUID();
      const existingSchedule = await client.query<{ revision: number }>(
        'SELECT revision FROM mobility_schedules WHERE user_id=$1 AND id=$2',
        [userId, scheduleId]
      );
      await applyMobilityOperation(
        userId,
        {
          operationId: randomUUID(),
          expectedRevision: existingSchedule.rows[0]?.revision ?? 0,
          mutation: {
            kind: 'schedule',
            data: { ...schedule, id: scheduleId, routineId },
            deleted: false,
          },
        },
        'api',
        client
      );
      refs.push({ domain: 'mobility_schedule', id: scheduleId });
    }
    return refs;
  }
  return [{ domain: action.kind, id: proposalId }];
}
export async function reviewCoachingProposal(
  userId: string,
  proposalId: string,
  input: CoachingReview
) {
  requireCoachingEnabled();
  const today = instantToDay(new Date(), await loadUserTimezone(userId));
  return coachingTransaction(userId, async (client) =>
    coachingOperation(
      client,
      userId,
      input.operationId,
      { proposalId, ...input },
      coachingProposalSchema,
      async () => {
        const proposal = await proposalForReview(
          client,
          userId,
          proposalId,
          input.expectedRevision,
          today
        );
        if (input.decision === 'decline') {
          const result = await client.query<CoachingProposalRow>(
            "UPDATE coaching_proposals SET status='declined',revision=revision+1,reviewed_at=now(),review_reason=$3 WHERE user_id=$1 AND id=$2 RETURNING *",
            [userId, proposalId, input.reason ?? null]
          );
          await coachingEvent(
            client,
            userId,
            'declined',
            { reason: input.reason ?? null, topic: proposal.topic },
            proposalId
          );
          return mapCoachingProposal(result.rows[0]);
        }
        const previews = await client.query<{
          revision: number;
          action: unknown;
          state_hash: string;
          expires_at: Date;
        }>(
          'SELECT * FROM coaching_previews WHERE user_id=$1 AND proposal_id=$2 AND token=$3',
          [userId, proposalId, input.previewToken]
        );
        const preview = previews.rows[0];
        if (
          !preview ||
          preview.expires_at <= new Date() ||
          preview.revision !== proposal.revision ||
          coachingFingerprint(preview.action) !==
            coachingFingerprint(input.action)
        )
          throw new CoachingConflictError(
            'Preview expired or the edited action changed. Preview it again.'
          );
        const current = await activationPreview(
          client,
          userId,
          input.action,
          today,
          true
        );
        if (coachingFingerprint(current.state) !== preview.state_hash)
          throw new CoachingConflictError(
            'The target or a referenced item changed. Preview the action again.'
          );
        const refs = await activate(client, userId, proposalId, input.action);
        const actionId = randomUUID();
        const success =
          input.action.kind === 'objective'
            ? input.action.success
            : { ...proposal.data.success };
        const subjectDomain =
          success.metric === 'habit_completion'
            ? 'habit'
            : success.metric === 'meal_confirmation'
              ? 'meal_plan'
              : success.metric === 'mobility_completion'
                ? 'mobility_routine'
                : success.metric === 'workout_completion'
                  ? 'workout_plan'
                  : null;
        if (!success.subjectId && subjectDomain)
          success.subjectId =
            refs.find((ref) => ref.domain === subjectDomain)?.id ?? null;
        await client.query(
          'INSERT INTO coaching_actions(id,user_id,proposal_id,data,success,activation_refs) VALUES($1,$2,$3,$4,$5,$6)',
          [
            actionId,
            userId,
            proposalId,
            JSON.stringify(input.action),
            JSON.stringify(success),
            JSON.stringify(refs),
          ]
        );
        const result = await client.query<CoachingProposalRow>(
          "UPDATE coaching_proposals SET status='accepted',revision=revision+1,reviewed_at=now(),review_reason=$3,activation_id=$4,accepted_action=$5 WHERE user_id=$1 AND id=$2 RETURNING *",
          [
            userId,
            proposalId,
            input.reason ?? null,
            actionId,
            JSON.stringify(input.action),
          ]
        );
        await coachingEvent(
          client,
          userId,
          coachingFingerprint(input.action) ===
            coachingFingerprint(proposal.data.action)
            ? 'accepted'
            : 'edited_and_accepted',
          { action: input.action, refs, reason: input.reason ?? null },
          proposalId,
          actionId
        );
        await client.query(
          "INSERT INTO engagement_change_events(user_id,domain,subject_id) VALUES($1,'coaching_action',$2)",
          [userId, actionId]
        );
        await client.query(
          'DELETE FROM coaching_previews WHERE user_id=$1 AND proposal_id=$2',
          [userId, proposalId]
        );
        return mapCoachingProposal(result.rows[0]);
      }
    )
  );
}
export async function patchCoachingCommitment(
  userId: string,
  actionId: string,
  input: CoachingCommitmentPatch
) {
  requireCoachingEnabled();
  return coachingTransaction(userId, async (client) =>
    coachingOperation(
      client,
      userId,
      input.operationId,
      { actionId, ...input },
      coachingCommitmentSchema,
      async () => {
        const result = await client.query<CoachingActionRow>(
          'SELECT * FROM coaching_actions WHERE user_id=$1 AND id=$2 FOR UPDATE',
          [userId, actionId]
        );
        const action = result.rows[0];
        if (!action) throw new CoachingNotFoundError('Action not found.');
        if (
          action.revision !== input.expectedRevision ||
          action.status !== 'active'
        )
          throw new CoachingConflictError('Action changed elsewhere.');
        if (input.status === 'completed' && action.data.kind !== 'task')
          throw new CoachingValidationError(
            'Only one-off tasks can be completed manually. Plan adherence and objective progress use confirmed app evidence.'
          );
        const updated = await client.query<CoachingActionRow>(
          'UPDATE coaching_actions SET status=$3,revision=revision+1,updated_at=now() WHERE user_id=$1 AND id=$2 RETURNING *',
          [userId, actionId, input.status]
        );
        await coachingEvent(
          client,
          userId,
          input.status,
          {
            reason: input.reason ?? null,
            effort: input.effort ?? null,
            feasibility: input.feasibility ?? null,
          },
          action.proposal_id,
          actionId
        );
        await client.query(
          "UPDATE engagement_occurrences SET status='cancelled' WHERE user_id=$1 AND kind='coaching_action' AND subject_id=$2 AND status='pending'",
          [userId, actionId]
        );
        return mapCoachingAction(updated.rows[0]);
      }
    )
  );
}
export async function getCoachingProposalEvidence(
  userId: string,
  proposalId: string
) {
  return coachingTransaction(
    userId,
    async (client) => {
      const result = await client.query<{ evidence: unknown }>(
        "SELECT evidence FROM coaching_proposals WHERE user_id=$1 AND id=$2 AND status<>'staged'",
        [userId, proposalId]
      );
      if (!result.rows[0])
        throw new CoachingNotFoundError('Recommendation not found.');
      return z.array(coachingEvidenceRowSchema).parse(result.rows[0].evidence);
    },
    true
  );
}

/** Delete retained review content, including the payloads in retry receipts. */
export async function deleteCoachingProposalHistory(
  userId: string,
  proposalId: string
): Promise<{ deleted: true }> {
  return coachingTransaction(userId, async (client) => {
    const actions = await client.query<{ id: string; status: string }>(
      'SELECT id,status FROM coaching_actions WHERE user_id=$1 AND proposal_id=$2 FOR UPDATE',
      [userId, proposalId]
    );
    if (actions.rows.some((action) => action.status === 'active'))
      throw new CoachingConflictError(
        'Stop the accepted action before deleting its review history.'
      );
    const ids = [proposalId, ...actions.rows.map((action) => action.id)];
    await client.query(
      `DELETE FROM coaching_operations WHERE user_id=$1
       AND (result->>'id'=ANY($2::text[]) OR result->'proposalIds' ? $3)`,
      [userId, ids, proposalId]
    );
    await client.query(
      "DELETE FROM engagement_occurrences WHERE user_id=$1 AND kind='coaching_action' AND subject_id=ANY($2::text[])",
      [userId, ids]
    );
    await client.query(
      "DELETE FROM coaching_proposals WHERE user_id=$1 AND id=$2 AND status<>'staged'",
      [userId, proposalId]
    );
    return { deleted: true };
  });
}
