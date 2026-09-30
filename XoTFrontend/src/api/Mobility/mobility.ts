import {
  mobilitySnapshotSchema,
  type MobilityOperation,
  type MobilitySnapshot,
  mobilityOperationResultSchema,
  type MobilityOperationResult,
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
export async function saveMobility(
  operation: MobilityOperation
): Promise<MobilityOperationResult> {
  return mobilityOperationResultSchema.parse(
    await apiCall('/v2/mobility', {
      method: 'POST',
      body: operation,
    })
  );
}
