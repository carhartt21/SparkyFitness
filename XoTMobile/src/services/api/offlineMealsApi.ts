import {
  offlineMealActionResponseSchema,
  type OfflineMealActionBody,
} from '@workspace/shared';
import { apiFetch, type ExpectedNutritionIdentity } from './apiClient';
export async function createOfflineMealAction(
  body: OfflineMealActionBody,
  expectedIdentity?: ExpectedNutritionIdentity
) {
  return offlineMealActionResponseSchema.parse(
    await apiFetch({
      endpoint: '/api/v2/offline-meals/actions',
      method: 'POST',
      body,
      ...(expectedIdentity ? { expectedIdentity } : {}),
      serviceName: 'Offline Meals API',
      operation: 'sync saved meal',
    })
  );
}
