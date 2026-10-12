import {
  offlineMealActionResponseSchema,
  type OfflineMealActionBody,
} from '@workspace/shared';
import { apiFetch } from './apiClient';
export async function createOfflineMealAction(body: OfflineMealActionBody) {
  return offlineMealActionResponseSchema.parse(
    await apiFetch({
      endpoint: '/api/v2/offline-meals/actions',
      method: 'POST',
      body,
      serviceName: 'Offline Meals API',
      operation: 'sync saved meal',
    })
  );
}
