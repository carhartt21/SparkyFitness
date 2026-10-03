import { apiFetch } from './apiClient';

/** Mirrors the `user_custom_nutrients` table shape returned by GET /api/custom-nutrients. */
export interface UserCustomNutrient {
  id: string;
  name: string;
  unit: string;
  catalog_id?: string | null;
  archived?: boolean;
}

/**
 * Fetches the current user's custom nutrient definitions.
 * GET /api/custom-nutrients
 */
export const fetchCustomNutrients = (): Promise<UserCustomNutrient[]> =>
  apiFetch<UserCustomNutrient[]>({
    endpoint: '/api/custom-nutrients',
    serviceName: 'Custom Nutrients API',
    operation: 'fetch custom nutrients',
  });

/** Resolve canonical nutrient identity without changing saved units or health records. */
export const ensureCatalogNutrients = (
  catalogIds: string[]
): Promise<{
  resolved: { catalogId: string; name: string; fixedField?: string }[];
  created: UserCustomNutrient[];
  nutrients: UserCustomNutrient[];
}> =>
  apiFetch({
    endpoint: '/api/custom-nutrients/from-catalog',
    method: 'POST',
    body: { catalogIds },
    serviceName: 'Custom Nutrients API',
    operation: 'resolve supplement nutrients',
  });
