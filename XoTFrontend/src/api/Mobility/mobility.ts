import {
  mobilitySnapshotSchema,
  type MobilityOperation,
  type MobilitySnapshot,
} from '@workspace/shared';
import { apiCall } from '@/api/api';
export async function loadMobility(
  from: string,
  to: string
): Promise<MobilitySnapshot> {
  return mobilitySnapshotSchema.parse(
    await apiCall('/v2/mobility', { params: { from, to } })
  );
}
export function saveMobility(
  operation: MobilityOperation
): Promise<{ revision: number }> {
  return apiCall('/v2/mobility', {
    method: 'POST',
    body: operation,
    headers: { 'X-XoT-Client': 'web' },
  });
}
