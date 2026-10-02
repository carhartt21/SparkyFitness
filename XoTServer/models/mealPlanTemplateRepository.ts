import type { PoolClient } from 'pg';
import type {
  MealPlanTemplateData,
  MealPlanAssignmentData,
} from '../services/mealPlanTemplateService.js';
import { localDateToDay } from '@workspace/shared';

export interface MealTemplateWrite extends MealPlanTemplateData {
  user_id: string;
}
interface MealTemplateRow extends MealTemplateWrite {
  id: string;
  entry_mode: 'prefill' | 'prompt';
  assignments: MealPlanAssignmentData[];
}

async function writeMealAssignments(
  client: PoolClient,
  userId: string,
  templateId: string,
  assignments: readonly MealPlanAssignmentData[]
): Promise<void> {
  const types = await client.query<{ id: string; name: string }>(
    'SELECT id,name FROM meal_types WHERE user_id=$1 OR user_id IS NULL',
    [userId]
  );
  for (const assignment of assignments) {
    const typeId =
      assignment.meal_type_id ??
      types.rows.find(
        (type) =>
          type.name.toLowerCase() === assignment.meal_type?.toLowerCase()
      )?.id;
    if (!typeId || !types.rows.some((type) => type.id === typeId))
      throw new Error('Invalid meal type.');
    await client.query(
      'INSERT INTO meal_plan_template_assignments(template_id,day_of_week,meal_type_id,item_type,meal_id,food_id,variant_id,quantity,unit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        templateId,
        assignment.day_of_week,
        typeId,
        assignment.item_type,
        assignment.item_type === 'meal' ? assignment.meal_id : null,
        assignment.item_type === 'food' ? assignment.food_id : null,
        assignment.item_type === 'food' ? assignment.variant_id : null,
        assignment.quantity ?? (assignment.item_type === 'meal' ? 1 : null),
        assignment.unit ?? (assignment.item_type === 'meal' ? 'serving' : null),
      ]
    );
  }
}
async function readWrittenMealTemplate(
  client: PoolClient,
  userId: string,
  templateId: string
): Promise<MealTemplateRow> {
  const result = await client.query<MealTemplateRow>(
    "SELECT t.*,COALESCE((SELECT jsonb_agg(to_jsonb(a) || jsonb_build_object('meal_type',mt.name,'food_name',f.name,'meal_name',m.name) ORDER BY mt.sort_order,a.id) FROM meal_plan_template_assignments a JOIN meal_types mt ON mt.id=a.meal_type_id LEFT JOIN foods f ON f.id=a.food_id LEFT JOIN meals m ON m.id=a.meal_id WHERE a.template_id=t.id),'[]'::jsonb) AS assignments FROM meal_plan_templates t WHERE t.id=$1 AND t.user_id=$2",
    [templateId, userId]
  );
  if (!result.rows[0]) throw new Error('Meal plan template not found.');
  return result.rows[0];
}
export async function captureMealPlanVersion(
  client: PoolClient,
  userId: string,
  templateId: string,
  effectiveDay: string
): Promise<string> {
  const row = await readWrittenMealTemplate(client, userId, templateId);
  const definition = {
    ...row,
    start_date:
      row.start_date instanceof Date
        ? localDateToDay(row.start_date)
        : row.start_date,
    end_date:
      row.end_date instanceof Date
        ? localDateToDay(row.end_date)
        : (row.end_date ?? null),
  };
  const result = await client.query<{ id: string }>(
    'INSERT INTO meal_plan_template_versions(user_id,template_id,effective_from,definition) VALUES($1,$2,$3,$4) RETURNING id',
    [userId, templateId, effectiveDay, JSON.stringify(definition)]
  );
  return result.rows[0].id;
}
import { getClient } from '../db/poolManager.js';
import { log } from '../config/logging.js';
async function createMealPlanTemplate(
  planData: MealTemplateWrite,
  transactionClient?: PoolClient,
  effectiveDay?: string
): Promise<MealTemplateRow> {
  const client: PoolClient =
    transactionClient ?? (await getClient(planData.user_id));
  try {
    if (!transactionClient) await client.query('BEGIN');
    const result = await client.query<{ id: string }>(
      'INSERT INTO meal_plan_templates(user_id,plan_name,description,start_date,end_date,is_active,entry_mode) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [
        planData.user_id,
        planData.plan_name,
        planData.description ?? '',
        planData.start_date ?? new Date(),
        planData.end_date,
        planData.is_active ?? false,
        planData.entry_mode ?? 'prefill',
      ]
    );
    const templateId = result.rows[0].id;
    await writeMealAssignments(
      client,
      planData.user_id,
      templateId,
      planData.assignments ?? planData.day_presets ?? []
    );
    const row = await readWrittenMealTemplate(
      client,
      planData.user_id,
      templateId
    );
    const startDay =
      typeof row.start_date === 'string'
        ? row.start_date.slice(0, 10)
        : localDateToDay(row.start_date ?? new Date());
    await captureMealPlanVersion(
      client,
      planData.user_id,
      templateId,
      effectiveDay ?? startDay
    );
    if (!transactionClient) await client.query('COMMIT');
    return row;
  } catch (error) {
    if (!transactionClient) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (!transactionClient) client.release();
  }
}
async function getMealPlanTemplateById(
  templateId: string,
  userId: string
): Promise<MealTemplateRow | null> {
  const client = await getClient(userId);
  try {
    const found = await client.query(
      'SELECT 1 FROM meal_plan_templates WHERE id=$1 AND user_id=$2',
      [templateId, userId]
    );
    return found.rows.length
      ? await readWrittenMealTemplate(client, userId, templateId)
      : null;
  } finally {
    client.release();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMealPlanTemplatesByUserId(userId: any) {
  const client = await getClient(userId); // User-specific operation
  try {
    const query = `
            SELECT
                t.*
            FROM meal_plan_templates t
            WHERE t.user_id = $1
            ORDER BY t.start_date DESC
        `;
    const result = await client.query(query, [userId]);
    return result.rows;
  } finally {
    client.release();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMealPlanTemplateAssignments(templateId: any, userId: any) {
  const client = await getClient(userId); // User-specific operation
  try {
    const query = `
            SELECT
                a.id,
                a.day_of_week,
                mt.name as meal_type,
                a.meal_type_id,
                a.item_type,
                a.meal_id,
                m.name as meal_name,
                a.food_id,
                f.name as food_name,
                a.variant_id,
                a.quantity,
                a.unit
            FROM meal_plan_template_assignments a
            LEFT JOIN meal_types mt ON a.meal_type_id = mt.id
            LEFT JOIN meals m ON a.meal_id = m.id
            LEFT JOIN foods f ON a.food_id = f.id
            WHERE a.template_id = $1
            ORDER BY a.day_of_week, mt.sort_order
        `;
    const result = await client.query(query, [templateId]);
    return result.rows;
  } finally {
    client.release();
  }
}
async function updateMealPlanTemplate(
  planId: string,
  planData: MealTemplateWrite,
  transactionClient?: PoolClient,
  effectiveDay?: string
): Promise<MealTemplateRow> {
  const client: PoolClient =
    transactionClient ?? (await getClient(planData.user_id));
  try {
    if (!transactionClient) await client.query('BEGIN');
    const current = await readWrittenMealTemplate(
      client,
      planData.user_id,
      planId
    );
    const startDay =
      typeof current.start_date === 'string'
        ? current.start_date.slice(0, 10)
        : localDateToDay(current.start_date ?? new Date());
    const versions = await client.query(
      'SELECT 1 FROM meal_plan_template_versions WHERE user_id=$1 AND template_id=$2 LIMIT 1',
      [planData.user_id, planId]
    );
    if (!versions.rows[0])
      await captureMealPlanVersion(client, planData.user_id, planId, startDay);
    await client.query(
      'UPDATE meal_plan_templates SET plan_name=$1,description=$2,start_date=$3,end_date=$4,is_active=$5,entry_mode=$6,updated_at=now() WHERE id=$7 AND user_id=$8',
      [
        planData.plan_name,
        planData.description ?? '',
        planData.start_date ?? current.start_date,
        planData.end_date,
        planData.is_active ?? false,
        planData.entry_mode ?? current.entry_mode,
        planId,
        planData.user_id,
      ]
    );
    await client.query(
      'DELETE FROM meal_plan_template_assignments WHERE template_id=$1',
      [planId]
    );
    await writeMealAssignments(
      client,
      planData.user_id,
      planId,
      planData.assignments ?? []
    );
    await captureMealPlanVersion(
      client,
      planData.user_id,
      planId,
      effectiveDay ?? startDay
    );
    const row = await readWrittenMealTemplate(client, planData.user_id, planId);
    if (!transactionClient) await client.query('COMMIT');
    return row;
  } catch (error) {
    if (!transactionClient) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (!transactionClient) client.release();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteMealPlanTemplate(planId: any, userId: any) {
  const client = await getClient(userId); // User-specific operation
  try {
    // The assignments table will be cascade deleted due to the foreign key constraint
    const result = await client.query(
      'DELETE FROM meal_plan_templates WHERE id = $1 RETURNING *',
      [planId]
    );
    return result.rows[0];
  } catch (error) {
    log(
      'error',
      // @ts-expect-error TS(2571): Object is of type 'unknown'.
      `Error deleting meal plan template ${planId}: ${error.message}`,
      error
    );
    throw error;
  } finally {
    client.release();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deactivateAllMealPlanTemplates(userId: any) {
  const client = await getClient(userId); // User-specific operation
  try {
    await client.query('UPDATE meal_plan_templates SET is_active = FALSE', []);
    return true;
  } finally {
    client.release();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMealPlanTemplateOwnerId(templateId: any) {
  const client = await getClient(templateId); // User-specific operation (RLS will handle access)
  try {
    const result = await client.query(
      'SELECT user_id FROM meal_plan_templates WHERE id = $1',
      [templateId]
    );
    return result.rows[0]?.user_id;
  } finally {
    client.release();
  }
}
async function getActiveMealPlansForDate(userId: string, date: Date | string) {
  const client = await getClient(userId); // User-specific operation
  try {
    const query = `
      SELECT (jsonb_populate_record(NULL::meal_plan_templates,to_jsonb(t)||COALESCE(v.definition,'{}'::jsonb))).*,
        COALESCE(v.definition->'assignments',
          (SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('meal_type',mt.name,'food_name',f.name,'meal_name',m.name) ORDER BY a.day_of_week,mt.sort_order,a.id)
           FROM meal_plan_template_assignments a JOIN meal_types mt ON mt.id=a.meal_type_id LEFT JOIN foods f ON f.id=a.food_id LEFT JOIN meals m ON m.id=a.meal_id WHERE a.template_id=t.id),'[]'::jsonb) AS assignments
      FROM meal_plan_templates t
      LEFT JOIN LATERAL (SELECT definition FROM meal_plan_template_versions v WHERE v.template_id=t.id AND v.user_id=t.user_id AND v.effective_from<=$2::date ORDER BY effective_from DESC,created_at DESC,id DESC LIMIT 1) v ON true
      WHERE t.user_id=$1 AND COALESCE((v.definition->>'is_active')::boolean,t.is_active)
        AND COALESCE((v.definition->>'start_date')::date,t.start_date)<=$2::date
        AND (COALESCE((v.definition->>'end_date')::date,t.end_date) IS NULL OR COALESCE((v.definition->>'end_date')::date,t.end_date)>=$2::date)
      ORDER BY COALESCE((v.definition->>'start_date')::date,t.start_date) DESC,t.id
    `;
    const result = await client.query(query, [userId, date]);
    return result.rows;
  } finally {
    client.release();
  }
}

async function getActiveMealPlanForDate(userId: string, date: Date | string) {
  const plans = await getActiveMealPlansForDate(userId, date);
  return plans[0] || null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMealPlanTemplatesByMealId(mealId: any) {
  const client = await getClient(mealId); // User-specific operation (RLS will handle access)
  try {
    const query = `
            SELECT
                t.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', a.id,
                                'day_of_week', a.day_of_week,
                                'meal_type', mt.name,
                                'meal_type_id', a.meal_type_id,
                                'item_type', a.item_type,
                                'meal_id', a.meal_id,
                                'meal_name', m.name,
                                'food_id', a.food_id,
                                'food_name', f.name,
                                'variant_id', a.variant_id,
                                'quantity', a.quantity,
                                'unit', a.unit
                            )
                        )
                        FROM meal_plan_template_assignments a
                        LEFT JOIN meal_types mt ON a.meal_type_id = mt.id
                        LEFT JOIN meals m ON a.meal_id = m.id
                        LEFT JOIN foods f ON a.food_id = f.id
                        WHERE a.template_id = t.id
                    ),
                    '[]'::json
                ) as assignments
            FROM meal_plan_templates t
            JOIN meal_plan_template_assignments mpta ON t.id = mpta.template_id
            WHERE mpta.meal_id = $1
            GROUP BY t.id
        `;
    const result = await client.query(query, [mealId]);
    return result.rows;
  } finally {
    client.release();
  }
}
export { createMealPlanTemplate };
export { getMealPlanTemplatesByUserId, getMealPlanTemplateById };
export { updateMealPlanTemplate };
export { deleteMealPlanTemplate };
export { deactivateAllMealPlanTemplates };
export { getMealPlanTemplateOwnerId };
export { getActiveMealPlanForDate };
export { getActiveMealPlansForDate };
export { getMealPlanTemplatesByMealId };
export { getMealPlanTemplateAssignments };
export default {
  createMealPlanTemplate,
  getMealPlanTemplatesByUserId,
  getMealPlanTemplateById,
  updateMealPlanTemplate,
  deleteMealPlanTemplate,
  deactivateAllMealPlanTemplates,
  getMealPlanTemplateOwnerId,
  getActiveMealPlanForDate,
  getActiveMealPlansForDate,
  getMealPlanTemplatesByMealId,
  getMealPlanTemplateAssignments,
};
