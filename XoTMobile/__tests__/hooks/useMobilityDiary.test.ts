import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMobilityDiary } from '../../src/hooks/useMobilityDiary';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { getMobilityState } from '../../src/services/mobilityRoutineStore';
import { apiFetch } from '../../src/services/api/apiClient';
import { createQueryWrapper, createTestQueryClient } from './queryTestUtils';
import { mobilitySession } from '../helpers/mobilityFixtures';
import type { MobilityState } from '../../src/services/mobilityRoutineStore';

let mockIdentityChanged: () => void;
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
  subscribeNutritionIdentity: (fn: () => void) => {
    mockIdentityChanged = fn;
    return jest.fn();
  },
}));
jest.mock('../../src/services/mobilityRoutineStore', () => ({
  getMobilityState: jest.fn(),
  subscribeMobilityState: () => jest.fn(),
}));
jest.mock('../../src/services/api/apiClient', () => ({ apiFetch: jest.fn() }));
const identity = { serverConfigId: 'server', userId: 'alice' };
const session = mobilitySession();
const state: MobilityState = {
  version: 1,
  timezone: 'Europe/Berlin',
  routines: [],
  history: [session],
  activeSession: null,
  imported: true,
  revisions: { [`session:${session.id}`]: 1 },
  pendingOperations: [],
  plans: [],
  conflicts: [],
  syncError: null,
};
const snapshot = {
  timezone: 'Europe/Berlin',
  routines: [],
  schedules: [],
  plans: [],
  sessions: [{ data: session, revision: 1, deleted: false, provenance: 'api' }],
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  jest.mocked(getMobilityState).mockResolvedValue(state);
  jest.mocked(apiFetch).mockResolvedValue(snapshot);
});
const wrapper = () => createQueryWrapper(createTestQueryClient());

test('shows offline local sessions immediately without provider requests', async () => {
  const { result, rerender } = renderHook(
    ({ day }) => useMobilityDiary(day, false),
    { initialProps: { day: '2026-10-04' }, wrapper: wrapper() }
  );
  await waitFor(() => expect(result.current.sessions).toHaveLength(1));
  expect(apiFetch).not.toHaveBeenCalled();
  rerender({ day: '2026-10-03' });
  expect(result.current.sessions).toEqual([]);
});
test('deduplicates local/server identities and uses the account-local day', async () => {
  const midnight = mobilitySession({ startedAt: '2026-10-03T22:30:00Z' });
  jest
    .mocked(getMobilityState)
    .mockResolvedValue({ ...state, history: [midnight] });
  jest.mocked(apiFetch).mockResolvedValue({
    ...snapshot,
    sessions: [{ ...snapshot.sessions[0], data: midnight }],
  });
  const { result } = renderHook(() => useMobilityDiary('2026-10-04', true), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(apiFetch).toHaveBeenCalled());
  await waitFor(() => expect(result.current.sessions).toEqual([midnight]));
  expect(apiFetch).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: '/api/v2/mobility?from=2026-10-04&to=2026-10-04',
      expectedIdentity: identity,
    })
  );
});
test('keeps local history on network failure and suppresses pending explicit deletes', async () => {
  jest.mocked(apiFetch).mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useMobilityDiary('2026-10-04', true), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.sessions).toEqual([session]);
  jest.mocked(apiFetch).mockResolvedValue(snapshot);
  jest.mocked(getMobilityState).mockResolvedValue({
    ...state,
    history: [],
    pendingOperations: [
      {
        operationId: '00000000-0000-4000-8000-000000000010',
        expectedRevision: 1,
        mutation: { kind: 'session', data: session, deleted: true },
      },
    ],
  });
  await act(async () => {
    await result.current.refetch();
  });
  expect(result.current.sessions).toEqual([]);
});
test('prefers a newer server revision and discards late responses after account changes', async () => {
  const remote = {
    ...session,
    routine: { ...session.routine, name: 'Updated elsewhere' },
  };
  jest.mocked(apiFetch).mockResolvedValue({
    ...snapshot,
    sessions: [{ ...snapshot.sessions[0], data: remote, revision: 2 }],
  });
  const { result } = renderHook(() => useMobilityDiary('2026-10-04', true), {
    wrapper: wrapper(),
  });
  await waitFor(() =>
    expect(result.current.sessions[0]?.routine.name).toBe('Updated elsewhere')
  );
  jest
    .mocked(getActiveNutritionIdentity)
    .mockResolvedValue({ ...identity, userId: 'bob' });
  jest
    .mocked(getMobilityState)
    .mockResolvedValue({ ...state, history: [], revisions: {} });
  jest.mocked(apiFetch).mockResolvedValue({ ...snapshot, sessions: [] });
  act(() => mockIdentityChanged());
  expect(result.current.sessions).toEqual([]);
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.sessions).toEqual([]);
});
