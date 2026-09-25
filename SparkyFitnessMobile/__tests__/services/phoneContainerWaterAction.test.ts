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
import { logPhoneContainerWaterAction } from '../../src/services/phoneContainerWaterAction';

const identity = { serverConfigId: 'server-a', userId: 'user-a' };
const operationId = '96e8e5dc-7e51-470d-9844-0a48fae03482';
const queryClient = {} as Parameters<typeof logPhoneContainerWaterAction>[2];
const mockIdentity = getActiveNutritionIdentity as jest.Mock;
const mockEnqueue = enqueueContainerWaterAction as jest.Mock;
const mockList = listNutritionActions as jest.Mock;
const mockReconcile = reconcileNutritionActions as jest.Mock;

describe('logPhoneContainerWaterAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIdentity.mockResolvedValue(identity);
    mockEnqueue.mockResolvedValue({ clientOperationId: operationId });
    mockList.mockResolvedValue([
      { clientOperationId: operationId, syncState: 'synced' },
    ]);
    mockReconcile.mockResolvedValue({ processed: 1, nextDelayMs: null });
  });

  it('requires an active account before storing or sending a drink', async () => {
    mockIdentity.mockResolvedValue(null);
    await expect(
      logPhoneContainerWaterAction('2026-09-24', 12, queryClient)
    ).rejects.toThrow('No active nutrition account');
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('stores the captured day, container, and time before attempting sync', async () => {
    await expect(
      logPhoneContainerWaterAction(
        '2026-09-24',
        12,
        queryClient,
        '2026-09-24T20:30:00.000Z'
      )
    ).resolves.toBe('synced');
    expect(mockEnqueue).toHaveBeenCalledWith({
      ...identity,
      entryDate: '2026-09-24',
      containerId: 12,
      loggedAt: '2026-09-24T20:30:00.000Z',
    });
    expect(mockEnqueue.mock.invocationCallOrder[0]).toBeLessThan(
      mockReconcile.mock.invocationCallOrder[0]
    );
  });

  it('reports an offline press as queued without discarding it', async () => {
    mockReconcile.mockRejectedValue(new Error('Offline'));
    mockList.mockResolvedValue([
      { clientOperationId: operationId, syncState: 'pending' },
    ]);
    await expect(
      logPhoneContainerWaterAction('2026-09-24', 12, queryClient)
    ).resolves.toBe('queued');
  });

  it('keeps a stored press queued if reading its status fails', async () => {
    mockList.mockRejectedValue(new Error('Local read failed'));
    await expect(
      logPhoneContainerWaterAction('2026-09-24', 12, queryClient)
    ).resolves.toBe('queued');
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
  });

  it('surfaces a permanent server rejection for review', async () => {
    mockList.mockResolvedValue([
      { clientOperationId: operationId, syncState: 'attentionRequired' },
    ]);
    await expect(
      logPhoneContainerWaterAction('2026-09-24', 12, queryClient)
    ).resolves.toBe('attentionRequired');
  });
});
