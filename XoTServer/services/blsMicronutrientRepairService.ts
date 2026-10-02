import type { PoolClient } from 'pg';
import { getClient } from '../db/poolManager.js';
import {
  mapBlsFood,
  type BlsFood,
} from '../integrations/bls/blsFoodService.js';
import { resolveNutrientQuantities } from './nutrientObservationService.js';

interface RepairRow extends BlsFood {
  id: string;
  custom_nutrients: Record<string, unknown> | null;
}

/** Private, unedited, versioned 100-g variants only. Diary history is immutable. */
export async function repairBlsMicronutrients(
  userId: string,
  options: {
    apply: boolean;
    limit: number;
    after?: string;
    includeUnversioned?: boolean;
  }
) {
  if (
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 500
  )
    throw new Error('Repair limit must be between 1 and 500');
  const client: PoolClient = await getClient(userId, userId);
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 27))',
      [userId]
    );
    const { rows } = await client.query<RepairRow>(
      `
      SELECT v.id, v.custom_nutrients, b.code, b.name_de, b.name_en, b.nutrients, b.qualifiers, b.dataset_sha256
      FROM food_variants v JOIN foods f ON f.id = v.food_id JOIN bls4_foods b ON b.code = f.provider_external_id
      WHERE f.user_id = $1 AND f.provider_type = 'bls4' AND NOT f.shared_with_public
        AND v.source = 'imported' AND v.serving_size = 100 AND v.serving_unit = 'g'
        AND f.updated_at = f.created_at AND v.updated_at = v.created_at
        AND (v.provider_dataset_sha256 = b.dataset_sha256 OR (
          $4::boolean AND v.provider_dataset_sha256 IS NULL
          AND b.dataset_sha256 = '12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91'
        ))
        AND ($2::uuid IS NULL OR v.id > $2::uuid)
      ORDER BY v.id LIMIT $3 FOR UPDATE OF v`,
      [
        userId,
        options.after ?? null,
        options.limit,
        options.includeUnversioned ?? false,
      ]
    );
    let changed = 0;
    let added = 0;
    for (const row of rows) {
      const mapped = mapBlsFood(row);
      if (!mapped) continue;
      const resolved = await resolveNutrientQuantities(
        client,
        userId,
        mapped.default_variant.nutrient_quantities ?? []
      );
      const missing = Object.fromEntries(
        Object.entries(resolved.custom).filter(
          ([key]) => !Object.hasOwn(row.custom_nutrients ?? {}, key)
        )
      );
      if (Object.keys(missing).length === 0) continue;
      changed++;
      added += Object.keys(missing).length;
      await client.query(
        "UPDATE food_variants SET custom_nutrients = COALESCE(custom_nutrients, '{}'::jsonb) || $1::jsonb WHERE id = $2",
        [JSON.stringify(missing), row.id]
      );
    }
    await client.query(options.apply ? 'COMMIT' : 'ROLLBACK');
    return {
      mode: options.apply ? 'apply' : 'dry-run',
      scanned: rows.length,
      changed,
      added,
      nextCursor: rows.length === options.limit ? rows.at(-1)?.id : null,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
