import { getClient } from '../db/poolManager.js';
import { log } from '../config/logging.js';
import foodRepository from '../models/foodRepository.js';
import foodServingRepository, {
  type ServingVariantRow,
  type ServingWrite,
} from '../models/foodServingRepository.js';
import {
  metricWeightOf,
  portionFactor,
  scaleServingNutrition,
  servingWeightOf,
  type FoodLastServing,
  type PortionNutrition,
  type ServingWeight,
  type saveFoodServingsBodySchema,
} from '@workspace/shared';
import type { z } from 'zod';

type SaveFoodServingsInput = z.output<typeof saveFoodServingsBodySchema>;

/** A rejected save with the HTTP status and, for conflicts, details. */
export class ServingSaveError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 422,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ServingSaveError';
  }
}

function asNutrition(row: ServingVariantRow): PortionNutrition {
  return row as unknown as PortionNutrition;
}

function asWeighted(row: {
  serving_size: string | number;
  serving_unit: string;
  metric_amount?: string | number | null;
  metric_unit?: string | null;
}) {
  return {
    serving_size: row.serving_size,
    serving_unit: row.serving_unit,
    metric_amount: row.metric_amount,
    metric_unit: row.metric_unit,
  };
}

/** The row whose nutrition the user edits: the internal default, else first. */
function pickBasis(rows: ServingVariantRow[]): ServingVariantRow | undefined {
  return rows.find((row) => row.is_default === true) ?? rows[0];
}

function servingKey(size: number, unit: string, label: string | null) {
  return `${Number(size)}|${unit.trim().toLowerCase()}|${(label ?? '').trim().toLowerCase()}`;
}

async function assertOwner(userId: string, foodId: string) {
  const ownerId = await foodRepository.getFoodOwnerId(foodId, userId);
  if (!ownerId) throw new ServingSaveError('Food not found.', 404);
  if (ownerId !== userId) {
    throw new ServingSaveError(
      'Forbidden: You do not have permission to change the servings of this food.',
      403
    );
  }
}

/**
 * Saves a food's portion list in one transaction: deletes, weight of the
 * basis, then every portion with its order. Portions with a known weight (or
 * in the basis's own unit) get nutrition derived from the basis; a portion
 * the client marks `derive: false` keeps its own stored values.
 */
async function saveFoodServings(
  userId: string,
  foodId: string,
  body: SaveFoodServingsInput
): Promise<ServingVariantRow[]> {
  await assertOwner(userId, foodId);
  const client = await getClient(userId);
  try {
    await client.query('BEGIN');
    const rows = await foodServingRepository.lockFoodVariants(client, foodId);
    const basis = pickBasis(rows);
    if (!basis) {
      throw new ServingSaveError('This food has no nutrition values yet.', 422);
    }
    const byId = new Map(rows.map((row) => [row.id, row]));

    const deletedIds = [...new Set(body.deleted_ids)];
    for (const id of deletedIds) {
      if (!byId.has(id)) {
        throw new ServingSaveError(
          'A deleted serving is not part of this food.',
          400
        );
      }
      if (id === basis.id) {
        throw new ServingSaveError(
          'The nutrition values of a food cannot be deleted.',
          400
        );
      }
    }
    const seenIds = new Set<string>();
    for (const serving of body.servings) {
      if (!serving.id) continue;
      if (!byId.has(serving.id) || deletedIds.includes(serving.id)) {
        throw new ServingSaveError('A serving is not part of this food.', 400);
      }
      if (serving.id === basis.id) {
        throw new ServingSaveError(
          'The nutrition values are edited separately from saved portions.',
          400
        );
      }
      if (seenIds.has(serving.id)) {
        throw new ServingSaveError('A serving was sent twice.', 400);
      }
      seenIds.add(serving.id);
    }

    // Weight of a basis whose own unit is not metric ("1 bar = 45 g").
    let basisRow: ServingVariantRow = basis;
    if (
      body.basis_metric_amount !== undefined &&
      !metricWeightOf(basis.serving_size, basis.serving_unit)
    ) {
      const unit = body.basis_metric_unit ?? 'g';
      await foodServingRepository.setBasisWeight(
        client,
        basis.id,
        body.basis_metric_amount,
        unit
      );
      basisRow = {
        ...basis,
        metric_amount: body.basis_metric_amount,
        metric_unit: body.basis_metric_amount === null ? null : unit,
      };
    }
    const basisWeight = servingWeightOf(asWeighted(basisRow));

    const assignments = await foodServingRepository.countTemplateAssignments(
      client,
      deletedIds
    );
    if (assignments > 0 && !body.confirm_cascade) {
      throw new ServingSaveError(
        'Meal plan templates still use a serving you removed.',
        409,
        { code: 'SERVING_IN_USE', template_assignments: assignments }
      );
    }
    await foodServingRepository.deleteVariants(client, foodId, deletedIds);

    const keys = new Set([
      servingKey(
        Number(basisRow.serving_size),
        basisRow.serving_unit,
        basisRow.serving_label
      ),
    ]);
    for (const serving of body.servings) {
      const key = servingKey(
        serving.serving_size,
        serving.serving_unit,
        serving.serving_label
      );
      if (keys.has(key)) {
        throw new ServingSaveError(
          'Two servings have the same amount, unit and name.',
          400
        );
      }
      keys.add(key);

      const existing = serving.id ? byId.get(serving.id) : undefined;
      const unitWeight = metricWeightOf(
        serving.serving_size,
        serving.serving_unit
      );
      const statedWeight: ServingWeight | null =
        serving.metric_amount !== null && serving.metric_amount !== undefined
          ? {
              metric_amount: serving.metric_amount,
              metric_unit: basisWeight?.metric_unit ?? 'g',
            }
          : null;
      const weight = unitWeight ?? statedWeight;
      const target = {
        serving_size: serving.serving_size,
        serving_unit: serving.serving_unit,
        metric_amount: weight?.metric_amount ?? null,
        metric_unit: weight?.metric_unit ?? null,
      };
      const write: ServingWrite = {
        serving_label: serving.serving_label ?? null,
        serving_size: serving.serving_size,
        serving_unit: serving.serving_unit,
        // g/ml rows get their weight from the database trigger.
        metric_amount: unitWeight
          ? null
          : (statedWeight?.metric_amount ?? null),
        metric_unit: unitWeight ? null : (statedWeight?.metric_unit ?? null),
        sort_order: serving.sort_order,
      };

      const factor = portionFactor(target, asWeighted(basisRow));
      if (serving.derive && factor !== null) {
        write.nutrition = scaleServingNutrition(asNutrition(basisRow), factor);
      } else if (existing) {
        // Own nutrition: a new amount in the same unit rescales the row's own
        // values; any other change needs a weight so it can be recalculated.
        const sameUnit =
          existing.serving_unit.trim().toLowerCase() ===
          serving.serving_unit.trim().toLowerCase();
        const oldSize = Number(existing.serving_size);
        if (!sameUnit) {
          throw new ServingSaveError(
            'Enter the weight of this serving so its nutrition can be recalculated.',
            422,
            { serving_id: existing.id }
          );
        }
        if (oldSize > 0 && oldSize !== serving.serving_size) {
          write.nutrition = scaleServingNutrition(
            asNutrition(existing),
            serving.serving_size / oldSize
          );
        }
      } else {
        throw new ServingSaveError(
          'Enter the weight of a new serving so its nutrition can be calculated.',
          422
        );
      }

      if (existing) {
        await foodServingRepository.updateServing(client, existing.id, write);
      } else if (write.nutrition) {
        await foodServingRepository.insertServing(client, foodId, basisRow, {
          ...write,
          nutrition: write.nutrition,
        });
      }
    }

    await foodServingRepository.markBasis(client, foodId, basis.id);
    const saved = await foodServingRepository.lockFoodVariants(client, foodId);
    await client.query('COMMIT');
    return saved;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getLastServing(
  targetUserId: string,
  actingUserId: string,
  foodId: string
): Promise<FoodLastServing | null> {
  return foodServingRepository.getLastServing(
    targetUserId,
    actingUserId,
    foodId
  );
}

interface LoggedEntry {
  user_id?: string | null;
  food_id?: string | null;
  variant_id?: string | null;
  quantity?: string | number | null;
  unit?: string | null;
  serving_size?: string | number | null;
}

/**
 * Remembers the serving of a food the user just logged or edited by hand.
 * Best effort: logging must never fail because this preference could not be
 * saved, so errors are logged and swallowed.
 */
async function recordLastServing(
  actingUserId: string,
  entry: LoggedEntry | null | undefined
): Promise<void> {
  const quantity = Number(entry?.quantity);
  if (
    !entry?.user_id ||
    !entry.food_id ||
    !entry.variant_id ||
    !entry.unit ||
    !(quantity > 0)
  ) {
    return;
  }
  const servingSize = Number(entry.serving_size);
  try {
    await foodServingRepository.upsertLastServing(actingUserId, {
      userId: entry.user_id,
      foodId: entry.food_id,
      variantId: entry.variant_id,
      quantity,
      unit: entry.unit,
      servingSize: servingSize > 0 ? servingSize : null,
    });
  } catch (error) {
    log('warn', 'Could not remember the last-used serving:', error);
  }
}

export default {
  saveFoodServings,
  getLastServing,
  recordLastServing,
};
