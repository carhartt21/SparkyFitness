import { createHash } from 'node:crypto';
import {
  instantHourMinute,
  pickMealTypeForTime,
  type ContainerWaterActionBody,
  type WaterContainerResponse,
} from '@workspace/shared';
import { getClient } from '../db/poolManager.js';
import foodRepository from '../models/foodRepository.js';
import measurementRepository from '../models/measurementRepository.js';
import { loadUserTimezone } from '../utils/timezoneLoader.js';
import { buildFoodEntrySnapshot } from '../utils/foodEntrySnapshot.js';
import type { VariantNutritionSource } from '../utils/foodEntrySnapshot.js';
import { containerPressWaterMl } from '../utils/containerWaterAmount.js';
import hydrationTotalsService from './hydrationTotalsService.js';

export class ContainerWaterActionError extends Error {
  constructor(
    readonly statusCode: 404 | 409,
    message: string
  ) {
    super(message);
  }
}

interface LinkedFoodVariant extends VariantNutritionSource {
  id: string;
  food_id: string;
  food_name: string;
  brand_name: string | null;
}

function requestFingerprint(action: ContainerWaterActionBody): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        action.entry_date,
        action.container_id,
        new Date(action.logged_at).toISOString(),
      ])
    )
    .digest('hex');
}

/**
 * One durable container press. The receipt, optional food entry, water row and
 * aggregate share a user-scoped transaction. A committed press can be retried
 * after a lost response without recreating either side effect, even if the
 * original food or water row was subsequently deleted.
 */
export async function createContainerWaterAction(
  userId: string,
  actingUserId: string,
  action: ContainerWaterActionBody
) {
  const fingerprint = requestFingerprint(action);
  // Read preferences before taking the operation lock. The existing loader
  // uses a separate pool client, which must not wait on this transaction.
  const timezone = await loadUserTimezone(userId);
  const client = await getClient(userId, actingUserId);
  let waterLogId: string | null;
  let foodEntryId: string | null = null;
  let waterMl: number;
  let alreadyApplied = false;

  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`container-water:${userId}:${action.client_operation_id}`]
    );
    const previous = await client.query(
      `SELECT request_fingerprint, water_log_id, food_entry_id, water_ml
       FROM water_container_actions
       WHERE user_id = $1 AND client_operation_id = $2`,
      [userId, action.client_operation_id]
    );
    if (previous.rows[0]) {
      if (previous.rows[0].request_fingerprint !== fingerprint) {
        throw new ContainerWaterActionError(
          409,
          'Operation ID already belongs to a different container press.'
        );
      }
      alreadyApplied = true;
      waterLogId = previous.rows[0].water_log_id;
      foodEntryId = previous.rows[0].food_entry_id;
      waterMl = Number(previous.rows[0].water_ml);
    } else {
      const containerResult = await client.query(
        `SELECT * FROM user_water_containers
         WHERE id = $1 AND user_id = $2 FOR SHARE`,
        [action.container_id, userId]
      );
      const container = containerResult.rows[0] as
        WaterContainerResponse | undefined;
      if (!container) {
        throw new ContainerWaterActionError(404, 'Water container not found.');
      }

      let linkedVariant: LinkedFoodVariant | null = null;
      if (container.linked_food_id) {
        const foodResult = await client.query(
          `SELECT f.name AS food_name, f.brand AS brand_name, fv.*
           FROM foods f
           JOIN LATERAL (
             SELECT * FROM food_variants candidate
             WHERE candidate.food_id = f.id
               AND (($2::uuid IS NOT NULL AND candidate.id = $2::uuid)
                    OR ($2::uuid IS NULL AND candidate.is_default = TRUE))
             ORDER BY candidate.updated_at DESC, candidate.id
             LIMIT 1
           ) fv ON TRUE
           WHERE f.id = $1`,
          [container.linked_food_id, container.linked_variant_id]
        );
        linkedVariant = (foodResult.rows[0] as LinkedFoodVariant) ?? null;
      }

      if (linkedVariant && container.linked_food_id) {
        let mealTypeId = container.linked_meal_type_id;
        if (!mealTypeId) {
          const mealTypes = await client.query(
            `SELECT mt.id, mt.name,
                    COALESCE(umv.default_time, mt.default_time) AS default_time
             FROM meal_types mt
             LEFT JOIN user_meal_visibilities umv
               ON mt.id = umv.meal_type_id AND umv.user_id = $1
             WHERE mt.user_id = $1 OR mt.user_id IS NULL
             ORDER BY mt.sort_order ASC, mt.id ASC`,
            [userId]
          );
          mealTypeId =
            pickMealTypeForTime(
              mealTypes.rows as Array<{
                id: string;
                name: string;
                default_time: string | null;
              }>,
              instantHourMinute(new Date(action.logged_at), timezone)
            )?.id ?? null;
        }

        const linkedQuantity =
          Number(container.linked_quantity) > 0
            ? Number(container.linked_quantity)
            : 1;
        const foodEntry = await foodRepository.createFoodEntry(
          {
            user_id: userId,
            food_id: container.linked_food_id,
            variant_id: linkedVariant.id,
            meal_type_id: mealTypeId,
            quantity: linkedQuantity,
            unit: linkedVariant.serving_unit || 'serving',
            entry_date: action.entry_date,
            food_entry_meal_id: null,
            meal_plan_template_id: null,
            ...buildFoodEntrySnapshot(
              {
                name: linkedVariant.food_name,
                brand: linkedVariant.brand_name,
              },
              linkedVariant
            ),
          },
          actingUserId,
          client
        );
        foodEntryId = foodEntry.id;
      }

      waterMl = containerPressWaterMl(container, linkedVariant);
      if (!Number.isFinite(waterMl) || waterMl < 0 || waterMl > 10000) {
        throw new ContainerWaterActionError(
          409,
          'Container water amount is invalid.'
        );
      }

      // Manual and container writes share this owner/day lock so concurrent
      // recomputes cannot overwrite a newer sum with an older snapshot.
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        [userId, action.entry_date]
      );
      const waterLog = await measurementRepository.insertWaterIntakeLog(
        userId,
        actingUserId,
        action.entry_date,
        waterMl,
        action.container_id,
        container.name,
        'manual',
        action.logged_at,
        foodEntryId,
        Number(container.hydration_factor ?? 1),
        client,
        action.client_operation_id
      );
      waterLogId = waterLog.id;
      await measurementRepository.recomputeWaterAggregate(
        client,
        userId,
        actingUserId,
        action.entry_date,
        'manual'
      );
      await client.query(
        `INSERT INTO water_container_actions
           (user_id, client_operation_id, request_fingerprint, entry_date,
            container_id, logged_at, water_ml, water_log_id, food_entry_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          action.client_operation_id,
          fingerprint,
          action.entry_date,
          action.container_id,
          action.logged_at,
          waterMl,
          waterLogId,
          foodEntryId,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const totals = await hydrationTotalsService.resolveWaterTotalsForDate(
    userId,
    actingUserId,
    action.entry_date
  );
  return { waterLogId, foodEntryId, waterMl, alreadyApplied, totals };
}
