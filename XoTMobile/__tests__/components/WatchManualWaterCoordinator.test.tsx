jest.mock('../../modules/watch-connectivity', () => {
  const listeners = new Map();
  return {
    __esModule: true,
    default: {
      isSupported: jest.fn(() => true),
      addListener: jest.fn((name: string, listener: unknown) => {
        listeners.set(name, listener);
        return { remove: jest.fn() };
      }),
      sendAck: jest.fn().mockResolvedValue(undefined),
    },
    listeners,
  };
});
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionOutbox', () => ({
  listNutritionActions: jest.fn(),
  subscribeNutritionActions: jest.fn(),
}));
jest.mock('../../src/services/watchManualWaterAction', () => ({
  handleWatchManualWaterAction: jest.fn(),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

import { act, render, waitFor } from '@testing-library/react-native';
import WatchConnectivity from '../../modules/watch-connectivity';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import {
  listNutritionActions,
  subscribeNutritionActions,
} from '../../src/services/nutritionActionOutbox';
import { handleWatchManualWaterAction } from '../../src/services/watchManualWaterAction';
import WatchManualWaterCoordinator from '../../src/components/WatchManualWaterCoordinator';

const listenerMap = (
  jest.requireMock('../../modules/watch-connectivity') as {
    listeners: Map<string, (payload: unknown) => void>;
  }
).listeners;
const mockTransport = WatchConnectivity!;
const mockHandler = handleWatchManualWaterAction as jest.Mock;
const mockIdentity = getActiveNutritionIdentity as jest.Mock;
const mockList = listNutritionActions as jest.Mock;
const mockSubscribe = subscribeNutritionActions as jest.Mock;
const clientId = '96e8e5dc-7e51-470d-9844-0a48fae03482';

describe('WatchManualWaterCoordinator', () => {
  let actionsChanged: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    listenerMap.clear();
    mockSubscribe.mockImplementation((listener: () => void) => {
      actionsChanged = listener;
      return jest.fn();
    });
    mockIdentity.mockResolvedValue({
      serverConfigId: 'server-a',
      userId: 'user-a',
    });
    mockList.mockResolvedValue([]);
  });

  it('holds acknowledgement while queued, then acknowledges server sync', async () => {
    mockHandler.mockResolvedValue('queued');
    render(<WatchManualWaterCoordinator />);
    act(() => listenerMap.get('onManualWater')?.({ clientId }));
    await waitFor(() => expect(mockHandler).toHaveBeenCalledTimes(1));
    expect(mockTransport.sendAck).not.toHaveBeenCalled();

    mockList.mockResolvedValue([
      { clientOperationId: clientId, syncState: 'synced' },
    ]);
    act(() => actionsChanged());
    await waitFor(() =>
      expect(mockTransport.sendAck).toHaveBeenCalledWith(clientId, true)
    );
  });

  it('acknowledges a rejected account scope as failed', async () => {
    mockHandler.mockResolvedValue('rejected');
    render(<WatchManualWaterCoordinator />);
    act(() => listenerMap.get('onManualWater')?.({ clientId }));
    await waitFor(() =>
      expect(mockTransport.sendAck).toHaveBeenCalledWith(clientId, false)
    );
  });
});
