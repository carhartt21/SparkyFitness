import type { PoolClient } from 'pg';
import { getClient } from '../db/poolManager.js';
import {
  PORTION_SCALED_FIELDS,
  type FoodLastServing,
  type ScaledPortionNutrition,
} from '@workspace/shared';

/** The food_variants columns the servings editor reads and writes. */
export interface ServingVariantRow {
  id: string;
  food_id: string;
  serving_size: string | number;
  serving_unit: string;
  serving_label: string | null;
  metric_amount: string | number | null;
  metric_unit: 'g' | 'ml' | null;
  sort_order: number;
  is_default: boolean | null;
  created_at: Date;
  glycemic_index: string | null;
  abv_percent: string | number | null;
  allergens: string[] | null;
  traces: string[] | null;
  custom_nutrients: Record<string, string | number> | null;
  [nutrient: string]: unknown;
}

export interface ServingWrite {
  serving_label: string | null;
  serving_size: number;
  serving_unit: string;
  metric_amount: number | null;
  metric_unit: 'g' | 'ml' | null;
  sort_order: number;
  /** Replacement nutrition; omitted to keep the row's stored values. */
  nutrition?: ScaledPortionNutrition;
}

const NUTRIENT_COLUMNS = [...PORTION_SCALED_FIELDS];

async function lockFoodVariants(
  client: PoolClient,
  foodId: string
): Promise<ServingVariantRow[]> {
  const result = await client.query<ServingVariantRow>(
    `SELECT * FROM food_variants
     WHERE food_id = $1
     ORDER BY sort_order, created_at, id
     FOR UPDATE`,
    [foodId]
  );
  return result.rows;
}

async function countTemplateAssignments(
  client: PoolClient,
  variantIds: string[]
): Promise<number> {
  if (variantIds.length === 0) return 0;
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM meal_plan_template_assignments
     WHERE variant_id = ANY($1::uuid[])`,
    [variantIds]
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function deleteVariants(
  client: PoolClient,
  foodId: string,
  variantIds: string[]
): Promise<void> {
  if (variantIds.length === 0) return;
  await client.query(
    `DELETE FROM food_variants
     WHERE food_id = $1 AND id = ANY($2::uuid[]) AND is_default IS NOT TRUE`,
    [foodId, variantIds]
  );
}

async function setBasisWeight(
  client: PoolClient,
  basisId: string,
  metricAmount: number | null,
  metricUnit: 'g' | 'ml' | null
): Promise<void> {
  await client.query(
    `UPDATE food_variants
     SET metric_amount = $2, metric_unit = $3, updated_at = now()
     WHERE id = $1`,
    [basisId, metricAmount, metricAmount === null ? null : metricUnit]
  );
}

/** Keeps the internal is_default marker on the basis row only. */
async function markBasis(
  client: PoolClient,
  foodId: string,
  basisId: string
): Promise<void> {
  await client.query(
    `UPDATE food_variants
     SET is_default = (id = $2)
     WHERE food_id = $1 AND is_default IS DISTINCT FROM (id = $2)`,
    [foodId, basisId]
  );
}

function nutritionAssignments(
  nutrition: ScaledPortionNutrition | undefined,
  firstParam: number
): { sql: string[]; values: unknown[] } {
  if (!nutrition) return { sql: [], values: [] };
  const sql: string[] = [];
  const values: unknown[] = [];
  NUTRIENT_COLUMNS.forEach((column, index) => {
    sql.push(`${column} = $${firstParam + index}`);
    values.push(nutrition[column]);
  });
  sql.push(`custom_nutrients = $${firstParam + NUTRIENT_COLUMNS.length}`);
  values.push(JSON.stringify(nutrition.custom_nutrients));
  return { sql, values };
}

async function updateServing(
  client: PoolClient,
  variantId: string,
  write: ServingWrite
): Promise<void> {
  const nutrition = nutritionAssignments(write.nutrition, 8);
  await client.query(
    `UPDATE food_variants SET
       serving_label = $2,
       serving_size = $3,
       serving_unit = $4,
       metric_amount = $5,
       metric_unit = $6,
       sort_order = $7,
       ${nutrition.sql.length ? `${nutrition.sql.join(', ')},` : ''}
       updated_at = now()
     WHERE id = $1`,
    [
      variantId,
      write.serving_label,
      write.serving_size,
      write.serving_unit,
      write.metric_amount,
      write.metric_amount === null ? null : write.metric_unit,
      write.sort_order,
      ...nutrition.values,
    ]
  );
}

async function insertServing(
  client: PoolClient,
  foodId: string,
  basis: ServingVariantRow,
  write: ServingWrite & { nutrition: ScaledPortionNutrition }
): Promise<void> {
  const columns = [
    'food_id',
    'serving_label',
    'serving_size',
    'serving_unit',
    'metric_amount',
    'metric_unit',
    'sort_order',
    'is_default',
    'source',
    'glycemic_index',
    'abv_percent',
    'allergens',
    'traces',
    ...NUTRIENT_COLUMNS,
    'custom_nutrients',
  ];
  const values: unknown[] = [
    foodId,
    write.serving_label,
    write.serving_size,
    write.serving_unit,
    write.metric_amount,
    write.metric_amount === null ? null : write.metric_unit,
    write.sort_order,
    false,
    'manual',
    // Concentrations and label facts describe the food, not the amount.
    basis.glycemic_index,
    basis.abv_percent,
    basis.allergens,
    basis.traces,
    ...NUTRIENT_COLUMNS.map((column) => write.nutrition[column]),
    JSON.stringify(write.nutrition.custom_nutrients),
  ];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  await client.query(
    `INSERT INTO food_variants (${columns.join(', ')}, created_at, updated_at)
     VALUES (${placeholders.join(', ')}, now(), now())`,
    values
  );
}

async function getLastServing(
  targetUserId: string,
  actingUserId: string,
  foodId: string
): Promise<FoodLastServing | null> {
  const client = await getClient(targetUserId, actingUserId);
  try {
    const result: { rows: FoodLastServing[] } = await client.query(
      `SELECT food_id, variant_id, quantity, unit, serving_size, serving_label,
              metric_amount, metric_unit, used_at::text AS used_at
       FROM food_last_servings
       WHERE user_id = $1 AND food_id = $2`,
      [targetUserId, foodId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export interface LastServingWrite {
  userId: string;
  foodId: string;
  variantId: string;
  quantity: number;
  unit: string;
  servingSize: number | null;
}

/**
 * Upserts the last-used serving. The portion label and weight are copied
 * from the variant so the suggestion survives renaming or deleting it.
 */
async function upsertLastServing(
  actingUserId: string,
  write: LastServingWrite
): Promise<void> {
  const client = await getClient(write.userId, actingUserId);
  try {
    await client.query(
      `INSERT INTO food_last_servings (
         user_id, food_id, quantity, unit, variant_id, serving_size,
         serving_label, metric_amount, metric_unit, used_at
       )
       SELECT $1, $2, $3, $4, fv.id, $6,
              fv.serving_label, fv.metric_amount, fv.metric_unit, now()
       FROM (SELECT 1) AS one
       LEFT JOIN food_variants fv ON fv.id = $5 AND fv.food_id = $2
       ON CONFLICT (user_id, food_id) DO UPDATE SET
         quantity = EXCLUDED.quantity,
         unit = EXCLUDED.unit,
         variant_id = EXCLUDED.variant_id,
         serving_size = EXCLUDED.serving_size,
         serving_label = EXCLUDED.serving_label,
         metric_amount = EXCLUDED.metric_amount,
         metric_unit = EXCLUDED.metric_unit,
         used_at = EXCLUDED.used_at`,
      [
        write.userId,
        write.foodId,
        write.quantity,
        write.unit,
        write.variantId,
        write.servingSize,
      ]
    );
  } finally {
    client.release();
  }
}

export default {
  lockFoodVariants,
  countTemplateAssignments,
  deleteVariants,
  setBasisWeight,
  markBasis,
  updateServing,
  insertServing,
  getLastServing,
  upsertLastServing,
};
