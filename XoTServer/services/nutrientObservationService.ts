import type { PoolClient } from 'pg';
import {
  convertCatalogNutrientAmount,
  getMicronutrientById,
  normalizeNutrientName,
  type HealthNutrientQuantity,
} from '@workspace/shared';

interface NutrientDefinition {
  id: string;
  name: string;
  unit: string;
  catalog_id: string | null;
  archived: boolean;
}

/** Caller owns a user-scoped transaction. Never called by provider search. */
export async function resolveNutrientQuantities(
  client: PoolClient,
  userId: string,
  quantities: readonly HealthNutrientQuantity[]
): Promise<{ custom: Record<string, number>; fixed: Record<string, number> }> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 27))', [
    userId,
  ]);
  const { rows } = await client.query<NutrientDefinition>(
    'SELECT id, name, unit, catalog_id, archived FROM user_custom_nutrients WHERE user_id = $1 FOR UPDATE',
    [userId]
  );
  const custom: Record<string, number> = {};
  const fixed: Record<string, number> = {};
  for (const quantity of quantities) {
    const catalog = getMicronutrientById(quantity.catalogId);
    if (!catalog) continue;
    if (catalog.fixedField) {
      const amount = convertCatalogNutrientAmount(
        catalog.id,
        quantity.amount,
        quantity.unit,
        catalog.unit
      );
      if (amount !== null) fixed[catalog.fixedField] = amount;
      continue;
    }
    let definition = rows.find((row) => row.catalog_id === catalog.id);
    if (!definition) {
      // Adopt only an unambiguous canonical name with a convertible unit.
      // Loose aliases cannot establish chemical identity.
      const candidates = rows.filter(
        (row) =>
          normalizeNutrientName(row.name) ===
          normalizeNutrientName(catalog.displayName)
      );
      if (candidates.length > 1)
        throw Object.assign(new Error('Ambiguous nutrient definition'), {
          status: 409,
        });
      definition = candidates[0];
      if (
        definition &&
        (definition.catalog_id !== null ||
          convertCatalogNutrientAmount(
            catalog.id,
            1,
            catalog.unit,
            definition.unit
          ) === null)
      ) {
        throw Object.assign(new Error('Incompatible nutrient definition'), {
          status: 409,
        });
      }
      if (definition) {
        await client.query(
          'UPDATE user_custom_nutrients SET catalog_id = $1 WHERE id = $2',
          [catalog.id, definition.id]
        );
        definition.catalog_id = catalog.id;
      } else {
        // An orphaned historic key has no recoverable unit. Refuse to guess it.
        const orphan = await client.query<{ exists: boolean }>(
          'SELECT public.nutrient_key_is_reserved($1::uuid, $2) AS exists',
          [userId, catalog.displayName]
        );
        if (orphan.rows[0]?.exists)
          throw Object.assign(
            new Error('Historical nutrient unit requires review'),
            { status: 409 }
          );
        const inserted = await client.query<NutrientDefinition>(
          `INSERT INTO user_custom_nutrients (id, user_id, name, unit, aliases, catalog_id)
           VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5) RETURNING *`,
          [
            userId,
            catalog.displayName,
            catalog.unit,
            JSON.stringify(catalog.aliases),
            catalog.id,
          ]
        );
        definition = inserted.rows[0]!;
        rows.push(definition);
      }
    }
    const amount = convertCatalogNutrientAmount(
      catalog.id,
      quantity.amount,
      quantity.unit,
      definition.unit
    );
    if (amount === null)
      throw Object.assign(new Error('Incompatible nutrient unit'), {
        status: 409,
      });
    // Retained identity is reactivated without modifying explicit display preferences
    // or inventing a daily goal.
    if (definition.archived) {
      await client.query(
        'UPDATE user_custom_nutrients SET archived = false WHERE id = $1',
        [definition.id]
      );
      definition.archived = false;
    }
    custom[definition.name] = amount;
  }
  return { custom, fixed };
}
