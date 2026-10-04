// Simulator-only, schema-validated synthetic transport. Never imported by production.
import {
  mobilityOperationSchema,
  type MobilitySnapshot,
} from '@workspace/shared';
export function createMobilityReviewFixture() {
  const snapshot: MobilitySnapshot = {
    routines: [],
    schedules: [],
    plans: [],
    sessions: [],
    timezone: 'Europe/Berlin',
  };
  const receipts = new Map<string, { revision: number }>();
  let routineId: string | null = null;
  return {
    allowRoutine(id: string) {
      routineId = id;
    },
    respond(url: URL, method: string, body?: string) {
      if (url.pathname !== '/api/v2/mobility') return undefined;
      if (method === 'GET') return snapshot;
      if (method !== 'POST' || !body)
        throw new Error('Unsupported mobility review request');
      const operation = mobilityOperationSchema.parse(JSON.parse(body));
      const old = receipts.get(operation.operationId);
      if (old) return old;
      const mutation = operation.mutation;
      if (mutation.kind === 'routine' && mutation.data.id === routineId) {
        const rows = snapshot.routines;
        const index = rows.findIndex((row) => row.data.id === mutation.data.id);
        const row = {
          data: mutation.data,
          deleted: mutation.deleted,
          revision: operation.expectedRevision + 1,
        };
        if (index === -1) rows.push(row);
        else rows[index] = row;
      } else if (
        mutation.kind === 'session' &&
        mutation.data.routine.id === routineId
      ) {
        const rows = snapshot.sessions;
        const index = rows.findIndex((row) => row.data.id === mutation.data.id);
        const row = {
          data: mutation.data,
          deleted: mutation.deleted,
          revision: operation.expectedRevision + 1,
          provenance: 'api' as const,
        };
        if (index === -1) rows.push(row);
        else rows[index] = row;
      } else
        throw new Error('Review accepts only its synthetic routine/session');
      const result = { revision: operation.expectedRevision + 1 };
      receipts.set(operation.operationId, result);
      return result;
    },
  };
}
