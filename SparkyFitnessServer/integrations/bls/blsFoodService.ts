import { getClient } from '../../db/poolManager.js';
import type { FoodVariant } from '../../schemas/foodSchemas.js';

export interface BlsFood {
  code: string;
  name_de: string;
  name_en: string;
  nutrients: Record<string, number>;
}

const REQUIRED = ['ENERCC', 'PROT625', 'CHO', 'FAT'] as const;

export function mapBlsFood(food: BlsFood, language = 'en') {
  const values = food.nutrients;
  // The API requires numeric energy and macros. A trace, below-detection
  // qualifier, or missing source value is unknown, not a measured zero.
  if (!REQUIRED.every((code) => Number.isFinite(values[code]))) return null;
  const optional = (field: string, code: string): Record<string, number> =>
    Number.isFinite(values[code]) ? { [field]: values[code] } : {};

  const variant: FoodVariant = {
    serving_size: 100,
    serving_unit: 'g',
    calories: values.ENERCC,
    protein: values.PROT625,
    carbs: values.CHO,
    fat: values.FAT,
    ...optional('dietary_fiber', 'FIBT'),
    ...optional('sugars', 'SUGAR'),
    ...optional('saturated_fat', 'FASAT'),
    ...optional('monounsaturated_fat', 'FAMS'),
    ...optional('polyunsaturated_fat', 'FAPU'),
    ...optional('sodium', 'NA'),
    ...optional('potassium', 'K'),
    ...optional('calcium', 'CA'),
    ...optional('iron', 'FE'),
    ...optional('cholesterol', 'CHORL'),
    ...optional('vitamin_c', 'VITC'),
    // Vitamin A is omitted pending the BLS 4.0 errata's corrected values.
    is_default: true,
  };
  return {
    name: language.toLowerCase().startsWith('de') ? food.name_de : food.name_en,
    brand: null,
    provider_external_id: food.code,
    provider_type: 'bls4',
    provider_verified: true,
    is_custom: false,
    default_variant: variant,
    variants: [variant],
  };
}

export async function searchBlsFoods(
  userId: string,
  query: string,
  page = 1,
  pageSize = 20,
  language = 'en'
) {
  const client = await getClient(userId);
  const term = query.trim();
  const offset = (page - 1) * pageSize;
  const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  const prefix = `${term.replace(/[\\%_]/g, '\\$&')}%`;
  const nameColumn = language.toLowerCase().startsWith('de')
    ? 'name_de'
    : 'name_en';
  const eligible = REQUIRED.map((_, index) => `nutrients ? $${index + 4}`).join(
    ' AND '
  );
  try {
    const { rows } = await client.query(
      `SELECT code, name_de, name_en, nutrients,
              count(*) OVER ()::integer AS total_count
       FROM public.bls4_foods
       WHERE (code ILIKE $1 OR name_de ILIKE $1 OR name_en ILIKE $1)
         AND ${eligible}
       ORDER BY CASE WHEN code ILIKE $2 THEN 0 WHEN ${nameColumn} ILIKE $2 THEN 1 ELSE 2 END,
                ${nameColumn}, code
       LIMIT $3 OFFSET $8`,
      [like, prefix, pageSize, ...REQUIRED, offset]
    );
    const totalCount = rows[0]?.total_count ?? 0;
    return {
      foods: rows
        .map((row: BlsFood) => mapBlsFood(row, language))
        .filter(Boolean),
      pagination: {
        page,
        pageSize,
        totalCount,
        hasMore: offset + rows.length < totalCount,
      },
    };
  } finally {
    client.release();
  }
}

export async function getBlsFoodDetails(
  userId: string,
  code: string,
  language = 'en'
) {
  const client = await getClient(userId);
  try {
    const { rows } = await client.query(
      'SELECT code, name_de, name_en, nutrients FROM public.bls4_foods WHERE code = $1',
      [code]
    );
    return rows[0] ? mapBlsFood(rows[0] as BlsFood, language) : null;
  } finally {
    client.release();
  }
}
