import { getClient } from '../../db/poolManager.js';
import type { FoodVariant } from '../../schemas/foodSchemas.js';
import {
  foodSearchTokens,
  BLS_COMPONENT_MANIFEST,
  healthMicronutrientIdSchema,
  type HealthNutrientQuantity,
} from '@workspace/shared';

export interface BlsFood {
  code: string;
  name_de: string;
  name_en: string;
  nutrients: Record<string, number>;
  qualifiers?: Record<string, string>;
  dataset_sha256?: string;
}

const REQUIRED = ['ENERCC', 'PROT625', 'CHO', 'FAT'] as const;
const normalizedGermanName =
  "replace(replace(replace(replace(replace(lower(name_de), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), 'aepfel', 'apfel')";

export function mapBlsFood(food: BlsFood, language = 'en') {
  const values = food.nutrients;
  // The API requires numeric energy and macros. A trace, below-detection
  // qualifier, or missing source value is unknown, not a measured zero.
  if (
    !REQUIRED.every(
      (code) =>
        Number.isFinite(values[code]) &&
        values[code] >= 0 &&
        !food.qualifiers?.[code]
    )
  )
    return null;
  const optional = (field: string, code: string): Record<string, number> =>
    Number.isFinite(values[code]) &&
    values[code] >= 0 &&
    !food.qualifiers?.[code]
      ? { [field]: values[code] }
      : {};

  const nutrient_quantities: HealthNutrientQuantity[] = [];
  for (const component of BLS_COMPONENT_MANIFEST) {
    if (component.status !== 'supported') continue;
    const amount = values[component.code];
    if (
      Number.isFinite(amount) &&
      amount >= 0 &&
      !food.qualifiers?.[component.code]
    ) {
      nutrient_quantities.push({
        catalogId: healthMicronutrientIdSchema.parse(component.catalogId),
        amount,
        unit: component.unit,
      });
    }
  }
  const diagnostics = {
    qualified: 0,
    blocked: 0,
    unsupported: 0,
    conversionFailed: 0,
  };
  for (const component of BLS_COMPONENT_MANIFEST) {
    if (
      !Object.hasOwn(values, component.code) &&
      !food.qualifiers?.[component.code]
    )
      continue;
    if (food.qualifiers?.[component.code]) diagnostics.qualified++;
    else if (component.status === 'blocked') diagnostics.blocked++;
    else if (component.status === 'out_of_scope') diagnostics.unsupported++;
    else if (
      !Number.isFinite(values[component.code]) ||
      values[component.code] < 0
    )
      diagnostics.conversionFailed++;
  }
  const variant: FoodVariant = {
    provider_nutrient_diagnostics: diagnostics,
    nutrient_quantities,
    provider_components: BLS_COMPONENT_MANIFEST.flatMap((component) => {
      const value = values[component.code];
      const qualifier = food.qualifiers?.[component.code];
      return Number.isFinite(value) || qualifier
        ? [
            {
              ...component,
              ...(Number.isFinite(value) ? { value } : {}),
              ...(qualifier ? { qualifier } : {}),
            },
          ]
        : [];
    }),
    provider_dataset_sha256: food.dataset_sha256 ?? null,
    source: 'imported',
    provider_nutrient_qualifiers: food.qualifiers ?? {},
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
  const tokens = [...new Set(foodSearchTokens(query))]
    .map((token) => token.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
  if (tokens.length === 0) {
    return {
      foods: [],
      pagination: { page, pageSize, totalCount: 0, hasMore: false },
    };
  }
  const client = await getClient(userId);
  const offset = (page - 1) * pageSize;
  const formWords = new Set([
    'roh',
    'frisch',
    'gekocht',
    'gegart',
    'gedunstet',
    'trocken',
    'ungekocht',
    'getrocknet',
    'sauce',
    'sosse',
    'frito',
    'saft',
    'pulver',
  ]);
  const identity = tokens.filter((token) => !formWords.has(token));
  const identityTokens = identity.length > 0 ? identity : tokens;
  const ingredientName = identityTokens.length === 1 ? identityTokens[0] : null;
  // Terms are reduced to ASCII letters/digits above; the SQL still receives
  // the tsquery as a parameter, never as interpolated user input.
  const identityQuery = identityTokens.map((token) => `${token}:*`).join(' | ');
  const allQuery = tokens.map((token) => `${token}:*`).join(' & ');
  const exact = tokens.join(' ');
  const nameColumn = language.toLowerCase().startsWith('de')
    ? 'name_de'
    : 'name_en';
  const rankName =
    nameColumn === 'name_de' ? normalizedGermanName : 'lower(name_en)';
  const rawWord = nameColumn === 'name_de' ? 'roh' : 'raw';
  const searchable = `to_tsvector('german', ${normalizedGermanName}) || to_tsvector('english', lower(name_en))`;
  const eligible = REQUIRED.map((_, index) => `nutrients ? $${index + 5}`).join(
    ' AND '
  );
  try {
    const { rows } = await client.query(
      `SELECT code, name_de, name_en, nutrients, qualifiers, dataset_sha256,
              count(*) OVER ()::integer AS total_count
       FROM public.bls4_foods
       WHERE (${searchable}) @@ to_tsquery('german', $1)
         AND ${eligible}
       ORDER BY
         CASE WHEN ${rankName} = $3 THEN 0 ELSE 1 END,
         CASE WHEN $10::text IS NOT NULL AND (
           ${rankName} = $10 OR
           ${rankName} LIKE $10 || ' %' OR
           ${rankName} LIKE $10 || ',%'
         ) THEN 0 ELSE 1 END,
         CASE WHEN (${searchable}) @@ to_tsquery('german', $2) THEN 0 ELSE 1 END,
         CASE WHEN $10::text IS NOT NULL AND ${rankName} = $10 || ' ${rawWord}' THEN 0 ELSE 1 END,
         ts_rank_cd((${searchable}), to_tsquery('german', $1)) DESC,
         length(${nameColumn}), ${nameColumn}, code
       LIMIT $4 OFFSET $9`,
      [
        identityQuery,
        allQuery,
        exact,
        pageSize,
        ...REQUIRED,
        offset,
        ingredientName,
      ]
    );
    let emptyPageTotal = 0;
    if (rows.length === 0) {
      const diagnostics = await client.query(
        `SELECT count(*)::integer AS catalogue_count,
                count(*) FILTER (WHERE (${searchable}) @@ to_tsquery('german', $1))::integer AS matching_count,
                count(*) FILTER (WHERE (${searchable}) @@ to_tsquery('german', $1) AND ${eligible})::integer AS eligible_count
         FROM public.bls4_foods`,
        [identityQuery, null, null, null, ...REQUIRED]
      );
      const state = diagnostics.rows[0] as {
        catalogue_count: number;
        matching_count: number;
        eligible_count: number;
      };
      emptyPageTotal = state.eligible_count;
      if (state.catalogue_count === 0) {
        throw Object.assign(new Error('BLS catalogue not initialized'), {
          status: 503,
        });
      }
      if (state.matching_count > 0 && state.eligible_count === 0) {
        throw Object.assign(
          new Error('Matching BLS foods have incomplete core nutrients'),
          { status: 422 }
        );
      }
    }
    const totalCount = rows[0]?.total_count ?? emptyPageTotal;
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
      'SELECT code, name_de, name_en, nutrients, qualifiers, dataset_sha256 FROM public.bls4_foods WHERE code = $1',
      [code]
    );
    return rows[0] ? mapBlsFood(rows[0] as BlsFood, language) : null;
  } finally {
    client.release();
  }
}
