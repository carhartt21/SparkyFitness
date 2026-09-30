import { getClient } from '../db/poolManager.js';

export type FoodEntryBulkAction = 'move' | 'copy' | 'delete';

export interface FoodEntryBulkInput {
  ids: string[];
  action: FoodEntryBulkAction;
  sourceDate: string;
  targetDate?: string;
  targetMealTypeId?: string;
  actorId: string;
}

/** Apply one reviewed selection atomically. A composite meal is edited as a meal, not as rows. */
export async function applyFoodEntryBulkAction(
  userId: string,
  input: FoodEntryBulkInput
): Promise<{ count: number }> {
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    const selected = await client.query(
      `SELECT id, food_entry_meal_id, meal_plan_template_id, source, nutrition_capture_id
         FROM food_entries
        WHERE user_id = $1 AND entry_date = $2::date AND id = ANY($3::uuid[])
        FOR UPDATE`,
      [userId, input.sourceDate, input.ids]
    );
    if (selected.rows.length !== input.ids.length) {
      throw Object.assign(
        new Error('Selected food entries changed. Refresh the diary.'),
        {
          statusCode: 409,
        }
      );
    }
    if (
      selected.rows.some(
        (row: {
          food_entry_meal_id: string | null;
          meal_plan_template_id: string | null;
          source: string | null;
          nutrition_capture_id: string | null;
        }) =>
          row.food_entry_meal_id ||
          row.meal_plan_template_id ||
          (row.source && row.source !== 'manual') ||
          row.nutrition_capture_id
      )
    ) {
      throw Object.assign(
        new Error(
          'Edit imported, captured, meal, and plan entries individually.'
        ),
        {
          statusCode: 409,
        }
      );
    }

    if (input.action !== 'delete') {
      const destination = await client.query(
        `SELECT id FROM meal_types
          WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
        [input.targetMealTypeId, userId]
      );
      if (destination.rows.length !== 1) {
        throw Object.assign(new Error('Destination meal is unavailable.'), {
          statusCode: 400,
        });
      }
    }

    let result;
    if (input.action === 'delete') {
      result = await client.query(
        'DELETE FROM food_entries WHERE user_id = $1 AND id = ANY($2::uuid[]) RETURNING id',
        [userId, input.ids]
      );
    } else if (input.action === 'move') {
      result = await client.query(
        `UPDATE food_entries
            SET meal_type_id = $2,
                entry_date = $3::date,
                updated_by_user_id = $4
          WHERE user_id = $1 AND id = ANY($5::uuid[])
          RETURNING id`,
        [
          userId,
          input.targetMealTypeId,
          input.targetDate,
          input.actorId,
          input.ids,
        ]
      );
    } else {
      // Copy the logged snapshot, not today's library values. New rows are manual
      // actions so provider sync and photo capture cannot claim ownership of them.
      result = await client.query(
        `INSERT INTO food_entries (
          user_id, food_id, meal_id, meal_type_id, quantity, unit,
          entry_date, entry_time, variant_id, created_by_user_id, updated_by_user_id,
          food_name, brand_name, serving_size, serving_unit, calories,
          protein, carbs, fat, saturated_fat, polyunsaturated_fat,
          monounsaturated_fat, trans_fat, cholesterol, sodium, potassium,
          dietary_fiber, sugars, vitamin_a, vitamin_c, calcium, iron,
          caffeine_mg, water_ml, alcohol_g, glycemic_index, custom_nutrients,
          allergens, traces, images, notes
        )
        SELECT user_id, food_id, meal_id, $2, quantity, unit,
               $3::date, entry_time, variant_id, $4, $4,
               food_name, brand_name, serving_size, serving_unit, calories,
               protein, carbs, fat, saturated_fat, polyunsaturated_fat,
               monounsaturated_fat, trans_fat, cholesterol, sodium, potassium,
               dietary_fiber, sugars, vitamin_a, vitamin_c, calcium, iron,
               caffeine_mg, water_ml, alcohol_g, glycemic_index, custom_nutrients,
               allergens, traces, images, notes
          FROM food_entries
         WHERE user_id = $1 AND id = ANY($5::uuid[])
         RETURNING id`,
        [
          userId,
          input.targetMealTypeId,
          input.targetDate,
          input.actorId,
          input.ids,
        ]
      );
    }
    if (result.rows.length !== input.ids.length) {
      throw new Error(
        'Food entry bulk action affected an unexpected number of entries.'
      );
    }
    await client.query('COMMIT');
    return { count: result.rows.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
