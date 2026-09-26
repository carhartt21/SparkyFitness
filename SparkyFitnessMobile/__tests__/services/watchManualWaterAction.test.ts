jest.mock('../../src/hooks/queryClient', () => ({ queryClient: {} }));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionOutbox', () => ({
  enqueueManualWaterAction: jest.fn(),
  listNutritionActions: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionSync', () => ({
  reconcileNutritionActions: jest.fn(),
}));

import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import {
  enqueueManualWaterAction,
  listNutritionActions,
} from '../../src/services/nutritionActionOutbox';
import { reconcileNutritionActions } from '../../src/services/nutritionActionSync';
import { handleWatchManualWaterAction } from '../../src/services/watchManualWaterAction';

const id = '96e8e5dc-7e51-470d-9844-0a48fae03482';
const payload = {
  clientId: id,
  entryDate: '2026-09-24',
  loggedAt: '2026-09-24T12:34:56Z',
  waterMl: 250 as const,
  scope: '["server-a","user-a"]',
};
const identity = { serverConfigId: 'server-a', userId: 'user-a' };
const mockIdentity = getActiveNutritionIdentity as jest.Mock;
const mockEnqueue = enqueueManualWaterAction as jest.Mock;
const mockList = listNutritionActions as jest.Mock;
const mockReconcile = reconcileNutritionActions as jest.Mock;

describe('handleWatchManualWaterAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIdentity.mockResolvedValue(identity);
    mockList.mockResolvedValue([]);
    mockReconcile.mockResolvedValue({ processed: 0, nextDelayMs: null });
  });

  it('rejects another account before reading or writing its outbox', async () => {
    await expect(
      handleWatchManualWaterAction({
        ...payload,
        scope: '["server-a","user-b"]',
      })
    ).resolves.toBe('rejected');
    expect(mockList).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('uses the Watch UUID and capture time for the durable action', async () => {
    mockList.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        clientOperationId: id,
        type: 'logManualWater',
        syncState: 'synced',
        payload: {
          entry_date: payload.entryDate,
          water_ml: 250,
          logged_at: payload.loggedAt,
        },
      },
    ]);
    await expect(handleWatchManualWaterAction(payload)).resolves.toBe('synced');
    expect(mockEnqueue).toHaveBeenCalledWith({
      ...identity,
      clientOperationId: id,
      entryDate: payload.entryDate,
      loggedAt: payload.loggedAt,
      waterMl: 250,
    });
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('keeps an offline action queued and does not enqueue it again on retry', async () => {
    const existing = {
      clientOperationId: id,
      type: 'logManualWater',
      syncState: 'pending',
      payload: {
        entry_date: payload.entryDate,
        water_ml: 250,
        logged_at: payload.loggedAt,
      },
    };
    mockList.mockResolvedValue([existing]);
    await expect(handleWatchManualWaterAction(payload)).resolves.toBe('queued');
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of an operation ID with changed water details', async () => {
    mockList.mockResolvedValue([
      {
        clientOperationId: id,
        type: 'logManualWater',
        syncState: 'synced',
        payload: {
          entry_date: payload.entryDate,
          water_ml: 500,
          logged_at: payload.loggedAt,
        },
      },
    ]);
    await expect(handleWatchManualWaterAction(payload)).resolves.toBe(
      'rejected'
    );
    expect(mockReconcile).not.toHaveBeenCalled();
  });
});
