import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type {
  OfflineMealActionBody,
  OfflineMealActionResponse,
} from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import { createFoodEntryMealWithClient } from '../models/foodEntryMealRepository.js';
import foodRepository from '../models/foodRepository.js';
import { canonicalJson } from '../utils/canonicalJson.js';

export class OfflineMealActionError extends Error {
  constructor(
    readonly statusCode: 400 | 409,
    message: string
  ) {
    super(message);
  }
}

/** Parent, leaf snapshots and retained replay receipt commit together. */
export async function createOfflineMealAction(
  userId: string,
  action: OfflineMealActionBody
): Promise<OfflineMealActionResponse> {
  const fingerprint = createHash('sha256')
    .update(canonicalJson(action))
    .digest('hex');
  const client: PoolClient = await getClient(userId, userId);
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`offline-meal:${userId}:${action.client_operation_id}`]
    );
    const previous = await client.query<{
      request_fingerprint: string;
      meal_entry_id: string | null;
    }>(
      'SELECT request_fingerprint, meal_entry_id FROM offline_meal_actions WHERE user_id = $1 AND client_operation_id = $2',
      [userId, action.client_operation_id]
    );
    if (previous.rows[0]) {
      if (previous.rows[0].request_fingerprint !== fingerprint)
        throw new OfflineMealActionError(
          409,
          'Operation ID already belongs to a different meal.'
        );
      await client.query('COMMIT');
      return {
        mealEntryId: previous.rows[0].meal_entry_id,
        alreadyApplied: true,
      };
    }
    const mealType = await client.query<{ id: string }>(
      'SELECT id FROM meal_types WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
      [action.meal_type_id, userId]
    );
    if (!mealType.rows[0])
      throw new OfflineMealActionError(400, 'Meal category is unavailable.');
    const meal = action.meal;
    const denominator = meal.serving_size * meal.total_servings;
    const factor = action.quantity / denominator;
    if (!Number.isFinite(denominator) || !Number.isFinite(factor))
      throw new OfflineMealActionError(400, 'Invalid meal portion.');
    // Source IDs never cause re-reading newer nutrition or failing on a deleted
    // template. This ad-hoc diary meal owns the exact recipe reviewed offline.
    const parent = (await createFoodEntryMealWithClient(
      client,
      {
        user_id: userId,
        meal_template_id: null,
        meal_type_id: action.meal_type_id,
        entry_date: action.entry_date,
        entry_time: action.entry_time,
        name: meal.name,
        description:
          meal.description && meal.description.length <= 60
            ? meal.description
            : null,
        notes:
          [
            meal.notes,
            meal.description && meal.description.length > 60
              ? meal.description
              : null,
          ]
            .filter(Boolean)
            .join('\n\n') || null,
        quantity: action.quantity,
        unit: meal.serving_unit,
        legacy_serving_unit_math: false,
        entry_total_servings: denominator,
      },
      userId
    )) as { id: string };
    for (const food of meal.foods) {
      const quantity = food.quantity * factor;
      if (!Number.isFinite(quantity) || quantity <= 0)
        throw new OfflineMealActionError(400, 'Invalid ingredient portion.');
      await foodRepository.createFoodEntry(
        {
          ...food,
          quantity,
          user_id: userId,
          food_id: null,
          variant_id: null,
          meal_type_id: action.meal_type_id,
          entry_date: action.entry_date,
          entry_time: action.entry_time,
          food_entry_meal_id: parent.id,
        },
        userId,
        client
      );
    }
    await client.query(
      'INSERT INTO offline_meal_actions (user_id, client_operation_id, request_fingerprint, entry_date, meal_entry_id) VALUES ($1, $2, $3, $4, $5)',
      [
        userId,
        action.client_operation_id,
        fingerprint,
        action.entry_date,
        parent.id,
      ]
    );
    await client.query('COMMIT');
    return { mealEntryId: parent.id, alreadyApplied: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
