import { apiFetch } from '../../src/services/api/apiClient';
import { queryClient } from '../../src/hooks/queryClient';
import { getMobilityState } from '../../src/services/mobilityRoutineStore';
import { mobilitySession } from '../helpers/mobilityFixtures';
import { exportMobilityToHealth } from '../../src/services/mobilityHealthExport';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import {
  getWorkoutHealthExportStatus,
  isWorkoutHealthRecordingEnabled,
  queueCompletedWorkoutExport,
  retryPendingWorkoutExports,
} from '../../src/services/workoutHealthExport';
import { requestWorkoutActiveEnergy } from '../../src/services/workoutEnergyPrompt';
import type { MobilitySession } from '@workspace/shared';
import type { TFunction } from 'i18next';

jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/workoutHealthExport', () => ({
  getWorkoutHealthExportStatus: jest.fn(),
  isWorkoutHealthRecordingEnabled: jest.fn(),
  queueCompletedWorkoutExport: jest.fn(),
  retryPendingWorkoutExports: jest.fn(),
}));
jest.mock('../../src/services/workoutEnergyPrompt', () => ({
  requestWorkoutActiveEnergy: jest.fn(),
}));
jest.mock('../../src/services/api/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../src/services/mobilityRoutineStore', () => ({
  getMobilityState: jest.fn(),
}));
const identity = { serverConfigId: 'server', userId: 'alice' };
const t = ((key: string) => key) as TFunction;
const session: MobilitySession = {
  id: 'session',
  routine: {
    id: 'routine',
    name: 'Mobility',
    steps: [],
    cue: 'both',
    reminderTime: null,
    createdAt: '2026-10-04T09:00:00Z',
    updatedAt: '2026-10-04T09:00:00Z',
  },
  state: 'finished',
  phase: 'step',
  stepIndex: 0,
  elapsedSeconds: 0,
  phaseStartedAt: null,
  startedAt: '2026-10-04T09:00:00Z',
  endedAt: '2026-10-04T09:02:00Z',
  outcomes: [
    { stepId: 'step', result: 'completed', recordedAt: '2026-10-04T09:02:00Z' },
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  jest.mocked(apiFetch).mockResolvedValue({ weight: 80 });
  jest
    .mocked(getMobilityState)
    .mockResolvedValue({ timezone: 'Europe/Berlin' } as Awaited<
      ReturnType<typeof getMobilityState>
    >);
  jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  jest.mocked(isWorkoutHealthRecordingEnabled).mockResolvedValue(true);
  jest.mocked(getWorkoutHealthExportStatus).mockResolvedValue(null);
  jest.mocked(requestWorkoutActiveEnergy).mockResolvedValue(12.5);
  jest.mocked(queueCompletedWorkoutExport).mockImplementation(async () => {
    jest.mocked(getWorkoutHealthExportStatus).mockResolvedValue('saved');
    return 'saved';
  });
});
test('exports confirmed mobility using the existing ledger, original times and known energy', async () => {
  expect(await exportMobilityToHealth(session, identity, t)).toBe('saved');
  expect(queueCompletedWorkoutExport).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionId: 'mobility:session',
      activityKind: 'mobility',
      sourceUserId: 'alice',
      sourceServerConfigId: 'server',
      activeEnergyKcal: 12.5,
      completedSetCount: 1,
      startedAt: Date.parse(session.startedAt),
      finishedAt: Date.parse(session.endedAt!),
    })
  );
});
test('keeps history without exporting unknown energy, unperformed sessions or instant manual results', async () => {
  jest.mocked(requestWorkoutActiveEnergy).mockResolvedValue(undefined);
  expect(await exportMobilityToHealth(session, identity, t)).toBe('skipped');
  expect(
    await exportMobilityToHealth({ ...session, outcomes: [] }, identity, t)
  ).toBe('skipped');
  expect(
    await exportMobilityToHealth(
      { ...session, endedAt: session.startedAt },
      identity,
      t
    )
  ).toBe('skipped');
  expect(queueCompletedWorkoutExport).not.toHaveBeenCalled();
});
test('requires opt-in and never re-prompts for saved or pending exports', async () => {
  jest.mocked(isWorkoutHealthRecordingEnabled).mockResolvedValueOnce(false);
  expect(await exportMobilityToHealth(session, identity, t)).toBe('disabled');
  jest.mocked(getWorkoutHealthExportStatus).mockResolvedValueOnce('saved');
  expect(await exportMobilityToHealth(session, identity, t)).toBe('saved');
  jest
    .mocked(getWorkoutHealthExportStatus)
    .mockResolvedValueOnce('pending')
    .mockResolvedValueOnce('saved');
  expect(await exportMobilityToHealth(session, identity, t)).toBe('saved');
  expect(retryPendingWorkoutExports).toHaveBeenCalledTimes(1);
  expect(requestWorkoutActiveEnergy).not.toHaveBeenCalled();
});
test('rejects account changes while the calorie prompt is open', async () => {
  jest
    .mocked(getActiveNutritionIdentity)
    .mockResolvedValueOnce(identity)
    .mockResolvedValueOnce(identity)
    .mockResolvedValueOnce({ ...identity, userId: 'bob' });
  await expect(exportMobilityToHealth(session, identity, t)).rejects.toThrow(
    'account changed'
  );
  expect(queueCompletedWorkoutExport).not.toHaveBeenCalled();
});

test('offers an estimate from an account-scoped latest weight lookup; confirmation still supplies export energy', async () => {
  const timed = mobilitySession();
  timed.routine.steps[0] = {
    ...timed.routine.steps[0]!,
    kind: 'timed',
    durationSeconds: 600,
  };
  timed.endedAt = '2026-10-04T09:10:00Z';
  timed.outcomes[0]!.recordedAt = timed.endedAt;
  expect(await exportMobilityToHealth(timed, identity, t)).toBe('saved');
  expect(apiFetch).toHaveBeenCalledWith(
    expect.objectContaining({ expectedIdentity: identity, timeoutMs: 5000 })
  );
  expect(requestWorkoutActiveEnergy).toHaveBeenCalledWith(t, {
    mobility: true,
    estimate: { activeKcal: 18, weightKg: 80, timedSeconds: 600 },
  });
  expect(queueCompletedWorkoutExport).toHaveBeenCalledWith(
    expect.objectContaining({ activeEnergyKcal: 12.5 })
  );
});
test('failed weight retrieval retains the manual or skip path without substituting a default weight', async () => {
  jest.mocked(apiFetch).mockRejectedValue(new Error('offline'));
  await exportMobilityToHealth(mobilitySession(), identity, t);
  expect(requestWorkoutActiveEnergy).toHaveBeenCalledWith(t, {
    mobility: true,
    estimate: undefined,
  });
});
