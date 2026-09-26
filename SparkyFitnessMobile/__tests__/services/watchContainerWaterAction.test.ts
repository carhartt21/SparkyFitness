jest.mock('../../src/hooks/queryClient', () => ({ queryClient: {} }));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionOutbox', () => ({
  enqueueContainerWaterAction: jest.fn(),
  listNutritionActions: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionSync', () => ({
  reconcileNutritionActions: jest.fn(),
}));

import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import {
  enqueueContainerWaterAction,
  listNutritionActions,
} from '../../src/services/nutritionActionOutbox';
import { reconcileNutritionActions } from '../../src/services/nutritionActionSync';
import { handleWatchContainerWaterAction } from '../../src/services/watchContainerWaterAction';

const id = '96e8e5dc-7e51-470d-9844-0a48fae03482';
const payload = {
  clientId: id,
  entryDate: '2026-09-24',
  containerId: 12,
  loggedAt: '2026-09-24T12:34:56Z',
  scope: '["server-a","user-a"]',
};
const identity = { serverConfigId: 'server-a', userId: 'user-a' };
const mockIdentity = getActiveNutritionIdentity as jest.Mock;
const mockEnqueue = enqueueContainerWaterAction as jest.Mock;
const mockList = listNutritionActions as jest.Mock;
const mockReconcile = reconcileNutritionActions as jest.Mock;

describe('handleWatchContainerWaterAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIdentity.mockResolvedValue(identity);
    mockList.mockResolvedValue([]);
    mockReconcile.mockResolvedValue({ processed: 0, nextDelayMs: null });
  });

  it('rejects another account before reading or writing its outbox', async () => {
    await expect(
      handleWatchContainerWaterAction({
        ...payload,
        scope: '["server-a","user-b"]',
      })
    ).resolves.toBe('rejected');
    expect(mockList).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('stores the Watch UUID and capture time before sync', async () => {
    mockList.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        clientOperationId: id,
        type: 'logContainerWater',
        syncState: 'synced',
        payload: {
          entry_date: payload.entryDate,
          container_id: payload.containerId,
          logged_at: payload.loggedAt,
        },
      },
    ]);
    await expect(handleWatchContainerWaterAction(payload)).resolves.toBe(
      'synced'
    );
    expect(mockEnqueue).toHaveBeenCalledWith({
      ...identity,
      clientOperationId: id,
      entryDate: payload.entryDate,
      containerId: 12,
      loggedAt: payload.loggedAt,
    });
  });

  it('retains an offline action for later retry without enqueueing twice', async () => {
    const existing = {
      clientOperationId: id,
      type: 'logContainerWater',
      syncState: 'pending',
      payload: {
        entry_date: payload.entryDate,
        container_id: payload.containerId,
        logged_at: payload.loggedAt,
      },
    };
    mockList.mockResolvedValue([existing]);
    await expect(handleWatchContainerWaterAction(payload)).resolves.toBe(
      'queued'
    );
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('uses a deterministic time for an older Watch payload', async () => {
    await expect(
      handleWatchContainerWaterAction({ ...payload, loggedAt: '' })
    ).resolves.toBe('queued');
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ loggedAt: '2026-09-24T12:00:00.000Z' })
    );
  });

  it('rejects a changed container on the same operation ID', async () => {
    mockList.mockResolvedValue([
      {
        clientOperationId: id,
        type: 'logContainerWater',
        syncState: 'synced',
        payload: {
          entry_date: payload.entryDate,
          container_id: 13,
          logged_at: payload.loggedAt,
        },
      },
    ]);
    await expect(handleWatchContainerWaterAction(payload)).resolves.toBe(
      'rejected'
    );
    expect(mockReconcile).not.toHaveBeenCalled();
  });
});
