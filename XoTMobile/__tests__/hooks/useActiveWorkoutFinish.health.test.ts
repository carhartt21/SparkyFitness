import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useActiveWorkoutFinish } from '../../src/hooks/useActiveWorkoutFinish';
import {
  needsPhoneWorkoutEnergy,
  queueCompletedWorkoutExport,
} from '../../src/services/workoutHealthExport';

const mockClear = jest.fn();
const mockState = {
  sessionId: 's1',
  startedAt: 1000,
  completedSetIds: { 'set-1': { completedAt: 2000 } },
  sourceServerConfigId: 'server-1',
  workoutFormat: 'standard',
  session: null,
  clearWorkout: mockClear,
};
jest.mock('../../src/stores/activeWorkoutStore', () => ({
  useActiveWorkoutStore: { getState: () => mockState },
}));
jest.mock('../../src/services/workoutHealthExport', () => ({
  needsPhoneWorkoutEnergy: jest.fn(),
  queueCompletedWorkoutExport: jest.fn(),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'prompt').mockImplementation(() => undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.mocked(needsPhoneWorkoutEnergy).mockResolvedValue(true);
  jest.mocked(queueCompletedWorkoutExport).mockResolvedValue('saved');
});
afterEach(() => jest.restoreAllMocks());

function setup() {
  const safeGoBack = jest.fn();
  const { result } = renderHook(() =>
    useActiveWorkoutFinish({
      navigation: { replace: jest.fn() },
      session: null,
      completedSetIds: {},
      flush: async () => true,
      durationSheetRef: { current: null },
      safeGoBack,
    })
  );
  return { result, safeGoBack };
}
async function submitEnergy(value?: string, skip = false) {
  const { result, safeGoBack } = setup();
  let finish: Promise<void>;
  await act(async () => {
    finish = result.current.handleFinish();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(Alert.prompt).toHaveBeenCalledTimes(1);
  const buttons = jest.mocked(Alert.prompt).mock.calls[0][2];
  if (!Array.isArray(buttons)) throw new Error('Expected buttons');
  await act(async () => {
    buttons[skip ? 0 : 1]!.onPress?.(value);
    await finish!;
  });
  return { safeGoBack };
}

it('accepts a German decimal calorie amount and completes the existing save flow once', async () => {
  const { safeGoBack } = await submitEnergy('175,5');
  expect(queueCompletedWorkoutExport).toHaveBeenCalledWith(
    expect.objectContaining({ activeEnergyKcal: 175.5, completedSetCount: 1 })
  );
  expect(mockClear).toHaveBeenCalledTimes(1);
  expect(safeGoBack).toHaveBeenCalledTimes(1);
});

it('allows unknown energy to skip Health export without cancelling diary completion', async () => {
  await submitEnergy(undefined, true);
  expect(queueCompletedWorkoutExport).toHaveBeenCalledWith(
    expect.objectContaining({ activeEnergyKcal: undefined })
  );
  expect(mockClear).toHaveBeenCalledTimes(1);
});

it('does not prompt or send manual energy when the Watch owns the workout', async () => {
  jest.mocked(needsPhoneWorkoutEnergy).mockResolvedValue(false);
  jest.mocked(queueCompletedWorkoutExport).mockResolvedValue('watch-pending');
  const { result } = setup();
  await act(async () => {
    await result.current.handleFinish();
  });
  expect(Alert.prompt).not.toHaveBeenCalled();
  expect(queueCompletedWorkoutExport).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalled();
});

it('rejects zero and invalid input and allows retry without saving prematurely', async () => {
  const { result } = setup();
  let finish: Promise<void>;
  await act(async () => {
    finish = result.current.handleFinish();
    await Promise.resolve();
    await Promise.resolve();
  });
  const buttons = jest.mocked(Alert.prompt).mock.calls[0][2];
  if (!Array.isArray(buttons)) throw new Error('Expected buttons');
  await act(async () => {
    buttons[1]!.onPress?.('0');
  });
  expect(queueCompletedWorkoutExport).not.toHaveBeenCalled();
  const retry = jest.mocked(Alert.alert).mock.calls[0][2];
  await act(async () => {
    retry?.[0]?.onPress?.();
  });
  const retryButtons = jest.mocked(Alert.prompt).mock.calls[1][2];
  if (!Array.isArray(retryButtons)) throw new Error('Expected retry buttons');
  await act(async () => {
    retryButtons[1]!.onPress?.('190');
    await finish!;
  });
  expect(queueCompletedWorkoutExport).toHaveBeenCalledTimes(1);
});

it('keeps one finish flow while the energy prompt is open', async () => {
  const { result } = setup();
  let finish: Promise<void>;
  await act(async () => {
    finish = result.current.handleFinish();
    await result.current.handleFinish();
    await Promise.resolve();
  });
  expect(Alert.prompt).toHaveBeenCalledTimes(1);
  const buttons = jest.mocked(Alert.prompt).mock.calls[0][2];
  if (!Array.isArray(buttons)) throw new Error('Expected buttons');
  await act(async () => {
    buttons[0]!.onPress?.();
    await finish!;
  });
  expect(queueCompletedWorkoutExport).toHaveBeenCalledTimes(1);
});
