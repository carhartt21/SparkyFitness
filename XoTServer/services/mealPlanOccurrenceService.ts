import type { PoolClient } from 'pg';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  addDays,
  dayOfWeek,
  instantToDay,
  coachingMealAssignmentSchema,
  plannedMealsSchema,
  plannedMealReceiptSchema,
  type PlannedMealConfirmation,
  type PlannedMealOccurrence,
} from '@workspace/shared';
import {
  coachingTransaction,
  coachingFingerprint,
  coachingEvent,
  CoachingConflictError,
  CoachingValidationError,
  CoachingNotFoundError,
} from '../models/coachingRepository.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { createFoodEntry } from '../models/foodEntry.js';
import { createFoodEntryMeal } from './foodEntryService.js';
import { coachingReferenceState } from './coachingPlanningService.js';

const definitionSchema = z.object({
  plan_name: z.string(),
  entry_mode: z.enum(['prompt', 'prefill']),
  start_date: z.string(),
  end_date: z.string().nullable(),
  is_active: z.boolean(),
  assignments: z.array(
    z.object({
      id: z.uuid(),
      day_of_week: z.number(),
      meal_type_id: z.uuid(),
      item_type: z.enum(['food', 'meal']),
      meal_id: z.uuid().nullable().optional(),
      food_id: z.uuid().nullable().optional(),
      variant_id: z.uuid().nullable().optional(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      food_name: z.string().nullable().optional(),
      meal_name: z.string().nullable().optional(),
    })
  ),
});
interface VersionRow {
  id: string;
  template_id: string | null;
  effective_from: string;
  definition: unknown;
}
/** Explicit plan materialization creates scheduled rows only, never food entries. */
export async function materializePromptMealPlans(
  client: PoolClient,
  userId: string,
  from: string,
  to: string
): Promise<void> {
  if (to < from || to > addDays(from, 93))
    throw new CoachingValidationError(
      'Meal plan windows are bounded to 93 days.'
    );
  const versions = await client.query<VersionRow>(
    'SELECT id,template_id,effective_from::text,definition FROM meal_plan_template_versions WHERE user_id=$1 AND template_id IS NOT NULL AND effective_from<=$2 ORDER BY effective_from DESC,created_at DESC,id DESC',
    [userId, to]
  );
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const selected = new Map<string, VersionRow>();
    for (const version of versions.rows)
      if (
        version.template_id &&
        version.effective_from <= day &&
        !selected.has(version.template_id)
      )
        selected.set(version.template_id, version);
    for (const version of selected.values()) {
      const parsed = definitionSchema.safeParse(version.definition);
      if (!parsed.success) continue; // A legacy version cannot become a prompt plan.
      const definition = parsed.data;
      if (
        definition.entry_mode !== 'prompt' ||
        !definition.is_active ||
        definition.start_date.slice(0, 10) > day ||
        (definition.end_date && definition.end_date.slice(0, 10) < day)
      )
        continue;
      for (const row of definition.assignments) {
        if (row.day_of_week !== dayOfWeek(day)) continue;
        const common = {
          day_of_week: row.day_of_week,
          meal_type_id: row.meal_type_id,
          quantity: row.quantity ?? 1,
          unit: row.unit ?? 'serving',
        };
        const assignment = coachingMealAssignmentSchema.parse(
          row.item_type === 'food'
            ? {
                ...common,
                item_type: 'food',
                food_id: row.food_id,
                variant_id: row.variant_id ?? null,
              }
            : { ...common, item_type: 'meal', meal_id: row.meal_id }
        );
        const snapshot = {
          assignment,
          name:
            row.item_type === 'food'
              ? (row.food_name ?? '')
              : (row.meal_name ?? ''),
          planName: definition.plan_name,
        };
        await client.query(
          'INSERT INTO meal_plans(user_id,meal_id,food_id,variant_id,quantity,unit,plan_date,meal_type_id,template_version_id,assignment_id,item_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(user_id,template_version_id,assignment_id,plan_date) WHERE template_version_id IS NOT NULL DO NOTHING',
          [
            userId,
            assignment.item_type === 'meal' ? assignment.meal_id : null,
            assignment.item_type === 'food' ? assignment.food_id : null,
            assignment.item_type === 'food' ? assignment.variant_id : null,
            assignment.quantity,
            assignment.unit,
            day,
            assignment.meal_type_id,
            version.id,
            row.id,
            JSON.stringify(snapshot),
          ]
        );
      }
    }
  }
}
export async function getPlannedMeals(
  userId: string,
  from: string,
  to: string
) {
  return coachingTransaction(
    userId,
    async (client) => {
      const result = await client.query<{
        id: string;
        template_version_id: string;
        template_id: string | null;
        assignment_id: string;
        day: string;
        state: string;
        item_snapshot: unknown;
      }>(
        'SELECT p.id,p.template_version_id,v.template_id,p.assignment_id,p.plan_date::text AS day,p.state,p.item_snapshot FROM meal_plans p JOIN meal_plan_template_versions v ON v.id=p.template_version_id AND v.user_id=p.user_id WHERE p.user_id=$1 AND p.plan_date BETWEEN $2 AND $3 ORDER BY p.plan_date,p.id',
        [userId, from, to]
      );
      return plannedMealsSchema.parse(
        result.rows.map((row) => ({
          ...z.record(z.string(), z.unknown()).parse(row.item_snapshot),
          id: row.id,
          templateVersionId: row.template_version_id,
          templateId: row.template_id,
          assignmentId: row.assignment_id,
          day: row.day,
          state: row.state,
        }))
      );
    },
    true
  );
}
export async function preparePlannedMeals(
  userId: string,
  from: string,
  to: string
) {
  const today = instantToDay(new Date(), await loadUserTimezone(userId));
  if (from < today || to > addDays(today, 93))
    throw new CoachingValidationError(
      'Only current and future planned meals can be materialized.'
    );
  await coachingTransaction(userId, (client) =>
    materializePromptMealPlans(client, userId, from, to)
  );
  return getPlannedMeals(userId, from, to);
}
async function planForConfirmation(
  client: PoolClient,
  userId: string,
  planId: string
): Promise<PlannedMealOccurrence> {
  const result = await client.query<{
    id: string;
    template_version_id: string;
    template_id: string | null;
    assignment_id: string;
    day: string;
    state: string;
    item_snapshot: unknown;
  }>(
    'SELECT p.id,p.template_version_id,v.template_id,p.assignment_id,p.plan_date::text AS day,p.state,p.item_snapshot FROM meal_plans p JOIN meal_plan_template_versions v ON v.id=p.template_version_id AND v.user_id=p.user_id WHERE p.user_id=$1 AND p.id=$2 FOR UPDATE OF p',
    [userId, planId]
  );
  const row = result.rows[0];
  if (!row) throw new CoachingNotFoundError('Planned meal not found.');
  return plannedMealsSchema.element.parse({
    ...z.record(z.string(), z.unknown()).parse(row.item_snapshot),
    id: row.id,
    templateVersionId: row.template_version_id,
    templateId: row.template_id,
    assignmentId: row.assignment_id,
    day: row.day,
    state: row.state,
  });
}
export async function confirmPlannedMeal(
  userId: string,
  planId: string,
  input: PlannedMealConfirmation
) {
  const today = instantToDay(new Date(), await loadUserTimezone(userId));
  if (input.consumedDay > today)
    throw new CoachingValidationError(
      'Consumption cannot be recorded for a future date.'
    );
  return coachingTransaction(userId, async (client) => {
    const hash = coachingFingerprint({ planId, ...input });
    const prior = await client.query<{ request_hash: string; result: unknown }>(
      'SELECT request_hash,result FROM meal_plan_log_receipts WHERE user_id=$1 AND (operation_id=$2 OR plan_id=$3)',
      [userId, input.operationId, planId]
    );
    if (prior.rows[0]) {
      if (
        !timingSafeEqual(
          Buffer.from(prior.rows[0].request_hash),
          Buffer.from(hash)
        )
      )
        throw new CoachingConflictError(
          'This planned meal was already confirmed, or the operation ID belongs to another log.'
        );
      return plannedMealReceiptSchema.parse(prior.rows[0].result);
    }
    const plan = await planForConfirmation(client, userId, planId);
    if (plan.state !== 'planned')
      throw new CoachingConflictError(
        'This meal is no longer awaiting confirmation.'
      );
    if (input.unit !== plan.assignment.unit)
      throw new CoachingValidationError(
        'Choose the scheduled serving unit, or edit the meal in the food logger.'
      );
    await coachingReferenceState(
      client,
      userId,
      {
        kind: 'meal_plan',
        templateId: null,
        effectiveDay: today,
        definition: {
          plan_name: plan.planName,
          description: '',
          start_date: today,
          end_date: null,
          is_active: true,
          entry_mode: 'prompt',
          assignments: [{ ...plan.assignment, quantity: input.quantity }],
        },
      },
      true
    );
    let foodEntryIds: string[];
    let mealEntryId: string | null = null;
    if (plan.assignment.item_type === 'food') {
      const variants = await client.query<{ id: string }>(
        'SELECT id FROM food_variants WHERE food_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY is_default DESC NULLS LAST,created_at,id LIMIT 1',
        [plan.assignment.food_id, plan.assignment.variant_id]
      );
      const entry = (await createFoodEntry(
        {
          user_id: userId,
          food_id: plan.assignment.food_id,
          variant_id: variants.rows[0].id,
          meal_type_id: plan.assignment.meal_type_id,
          quantity: input.quantity,
          unit: input.unit,
          entry_date: input.consumedDay,
          entry_time: input.entryTime,
          client_operation_id: input.operationId,
        },
        userId,
        client
      )) as { id: string };
      foodEntryIds = [entry.id];
    } else {
      const entry = (await createFoodEntryMeal(
        userId,
        userId,
        {
          user_id: userId,
          meal_template_id: plan.assignment.meal_id,
          meal_type_id: plan.assignment.meal_type_id,
          quantity: input.quantity,
          unit: input.unit,
          entry_date: input.consumedDay,
          entry_time: input.entryTime,
          _clientMealModelVersion: 2,
        },
        client
      )) as { id: string };
      mealEntryId = entry.id;
      foodEntryIds = (
        await client.query<{ id: string }>(
          'SELECT id FROM food_entries WHERE user_id=$1 AND food_entry_meal_id=$2',
          [userId, entry.id]
        )
      ).rows.map((row) => row.id);
    }
    const receipt = plannedMealReceiptSchema.parse({
      planId,
      foodEntryIds,
      mealEntryId,
      consumedDay: input.consumedDay,
    });
    await client.query(
      'INSERT INTO meal_plan_log_receipts(user_id,operation_id,plan_id,request_hash,result) VALUES($1,$2,$3,$4,$5)',
      [userId, input.operationId, planId, hash, JSON.stringify(receipt)]
    );
    await client.query(
      "UPDATE meal_plans SET state='confirmed',updated_at=now() WHERE user_id=$1 AND id=$2",
      [userId, planId]
    );
    await coachingEvent(client, userId, 'meal_confirmed', {
      planId,
      consumedDay: input.consumedDay,
      templateVersionId: plan.templateVersionId,
    });
    return receipt;
  });
}
export async function skipPlannedMeal(userId: string, planId: string) {
  return coachingTransaction(userId, async (client) => {
    const plan = await planForConfirmation(client, userId, planId);
    if (plan.state === 'skipped') return plan;
    if (plan.state !== 'planned')
      throw new CoachingConflictError('This meal was already resolved.');
    await client.query(
      "UPDATE meal_plans SET state='skipped',updated_at=now() WHERE user_id=$1 AND id=$2",
      [userId, planId]
    );
    await coachingEvent(client, userId, 'meal_skipped', {
      planId,
      templateVersionId: plan.templateVersionId,
    });
    return { ...plan, state: 'skipped' as const };
  });
}
