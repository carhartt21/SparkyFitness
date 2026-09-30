let mockUuidIndex = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    `00000000-0000-4000-8000-${String(++mockUuidIndex).padStart(12, '0')}`,
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../../src/services/api/apiClient';
import { ApiError } from '../../src/services/api/errors';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import {
  saveMobilityRoutine,
  synchronizeMobility,
  getMobilityState,
  startMobilitySession,
} from '../../src/services/mobilityRoutineStore';
import type { MobilityOperation } from '@workspace/shared';
jest.mock('../../src/services/api/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
const identity = {
  serverConfigId: 'synthetic-server',
  userId: 'synthetic-user',
};
const empty = {
  timezone: 'Europe/Berlin',
  routines: [],
  schedules: [],
  plans: [],
  sessions: [],
};
const draft = {
  name: 'Synthetic mobility',
  cue: 'off' as const,
  steps: [
    {
      name: 'Reach',
      instructions: '',
      side: 'both' as const,
      kind: 'timed' as const,
      durationSeconds: 30,
      transitionSeconds: 0,
    },
  ],
};
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
});
it('retains a stable operation ID after a lost response, preserving original identifiers and timestamps', async () => {
  const routine = await saveMobilityRoutine(
    identity,
    draft,
    new Date('2026-09-30T10:00:00Z')
  );
  jest.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'));
  await expect(synchronizeMobility(identity)).rejects.toThrow('offline');
  const queued = (await getMobilityState(identity)).pendingOperations[0];
  expect(queued.mutation).toMatchObject({
    data: { id: routine.id, createdAt: '2026-09-30T10:00:00.000Z' },
  });
  jest
    .mocked(apiFetch)
    .mockResolvedValueOnce({ revision: 1 })
    .mockResolvedValueOnce({
      ...empty,
      routines: [{ revision: 1, data: routine, deleted: false }],
    });
  await synchronizeMobility(identity);
  expect(jest.mocked(apiFetch).mock.calls[1][0].body).toEqual(queued);
  expect((await getMobilityState(identity)).pendingOperations).toEqual([]);
});
it('keeps a conflicting local routine until explicitly resolved', async () => {
  await saveMobilityRoutine(identity, draft);
  jest
    .mocked(apiFetch)
    .mockRejectedValueOnce(new ApiError('conflict', 409))
    .mockResolvedValueOnce(empty);
  await synchronizeMobility(identity);
  const state = await getMobilityState(identity);
  expect(state.conflicts).toHaveLength(1);
  expect(state.routines).toHaveLength(1);
  expect(state.syncError).toBe('conflict');
});
it('does not send old-account operations after the active account changes', async () => {
  await saveMobilityRoutine(identity, draft);
  jest
    .mocked(getActiveNutritionIdentity)
    .mockResolvedValue({ ...identity, userId: 'other' });
  await synchronizeMobility(identity);
  expect(apiFetch).not.toHaveBeenCalled();
});
it('preserves an active local timer while merging remote history', async () => {
  const routine = await saveMobilityRoutine(identity, draft);
  const session = await startMobilitySession(identity, routine.id);
  jest.mocked(apiFetch).mockImplementation(async (request) =>
    request.method === 'POST'
      ? { revision: 1 }
      : {
          ...empty,
          routines: [{ revision: 1, data: routine, deleted: false }],
        }
  );
  await synchronizeMobility(identity);
  expect((await getMobilityState(identity)).activeSession?.id).toBe(session.id);
  const mutations = jest
    .mocked(apiFetch)
    .mock.calls.filter(([request]) => request.method === 'POST')
    .map(([request]) => request.body as MobilityOperation);
  expect(
    mutations.some(
      (op) =>
        op.mutation.kind === 'session' && op.mutation.data.id === session.id
    )
  ).toBe(true);
});
