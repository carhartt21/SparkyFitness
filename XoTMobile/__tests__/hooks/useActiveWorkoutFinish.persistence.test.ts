import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useActiveWorkoutFinish } from '../../src/hooks/useActiveWorkoutFinish';
import {
  needsPhoneWorkoutEnergy,
  queueCompletedWorkoutExport,
} from '../../src/services/workoutHealthExport';

const mockClear = jest.fn();
let mockState = {
  sessionId: 'review-session',
  startedAt: 1000,
  completedSetIds: { 'set-1': { completedAt: 2000 } } as Record<
    string,
    { completedAt: number }
  >,
  sourceServerConfigId: 'server-1',
  workoutFormat: 'standard',
  hasUnsavedChanges: false,
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
  mockState = {
    ...mockState,
    sessionId: 'review-session',
    sourceServerConfigId: 'server-1',
    completedSetIds: { 'set-1': { completedAt: 2000 } },
    hasUnsavedChanges: false,
  };
  mockClear.mockReset();
  jest.spyOn(Alert, 'prompt').mockImplementation(() => undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.mocked(needsPhoneWorkoutEnergy).mockResolvedValue(true);
  jest.mocked(queueCompletedWorkoutExport).mockResolvedValue('skipped');
});
afterEach(() => jest.restoreAllMocks());

function setup(flush: () => Promise<boolean>) {
  const safeGoBack = jest.fn();
  const navigation = { replace: jest.fn() };
  const hook = renderHook(() =>
    useActiveWorkoutFinish({
      navigation,
      session: null,
      completedSetIds: {},
      flush,
      durationSheetRef: { current: null },
      safeGoBack,
    })
  );
  return { ...hook, safeGoBack, navigation };
}

function energyButtons() {
  const buttons = jest.mocked(Alert.prompt).mock.calls[0][2];
  if (!Array.isArray(buttons)) throw new Error('Expected energy prompt');
  return buttons;
}

async function flushClean() {
  mockState = { ...mockState, hasUnsavedChanges: false };
  return true;
}

it('persists sets received while the calorie prompt is open before clearing the workout', async () => {
  const clearedWhileDirty: boolean[] = [];
  mockClear.mockImplementation(() => {
    clearedWhileDirty.push(mockState.hasUnsavedChanges);
  });
  const flush = jest.fn(async () => {
    mockState = { ...mockState, hasUnsavedChanges: false };
    return true;
  });
  const { result } = setup(flush);
  let finish: Promise<void> = Promise.resolve();
  await act(async () => {
    finish = result.current.handleFinish();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(Alert.prompt).toHaveBeenCalledTimes(1);
  // A Watch set updates the store after the initial flush, while the user
  // is still deciding whether to enter energy or skip export.
  mockState = {
    ...mockState,
    completedSetIds: {
      ...mockState.completedSetIds,
      'set-2': { completedAt: 3000 },
    },
    hasUnsavedChanges: true,
  };
  const buttons = jest.mocked(Alert.prompt).mock.calls[0][2];
  if (!Array.isArray(buttons)) throw new Error('Expected energy prompt');
  await act(async () => {
    buttons[0].onPress?.();
    await finish;
  });
  expect(clearedWhileDirty).toEqual([false]);
  expect(queueCompletedWorkoutExport).toHaveBeenCalledWith(
    expect.objectContaining({ completedSetCount: 2 })
  );
});

it('keeps the finish guard active when retrying a failed initial save', async () => {
  const flush = jest
    .fn<Promise<boolean>, []>()
    .mockResolvedValueOnce(false)
    .mockResolvedValue(true);
  const { result } = setup(flush);
  await act(async () => {
    await result.current.handleFinish();
  });
  const retry = jest.mocked(Alert.alert).mock.calls[0][2]?.[0];
  await act(async () => {
    retry?.onPress?.();
    retry?.onPress?.();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(Alert.prompt).toHaveBeenCalledTimes(1);
  await act(async () => {
    energyButtons()[0].onPress?.();
  });
  expect(mockClear).toHaveBeenCalledTimes(1);
});

it('keeps new sets active when the save after the calorie prompt fails', async () => {
  const flush = jest
    .fn()
    .mockImplementationOnce(flushClean)
    .mockResolvedValue(false);
  const { result, safeGoBack } = setup(flush);
  let finish: Promise<void> = Promise.resolve();
  await act(async () => {
    finish = result.current.handleFinish();
    await Promise.resolve();
    await Promise.resolve();
  });
  mockState = { ...mockState, hasUnsavedChanges: true };
  await act(async () => {
    energyButtons()[0].onPress?.();
    await finish;
  });
  expect(mockClear).not.toHaveBeenCalled();
  expect(queueCompletedWorkoutExport).not.toHaveBeenCalled();
  expect(safeGoBack).not.toHaveBeenCalled();
  expect(mockState.hasUnsavedChanges).toBe(true);
});

it('flushes sets received while native Health export is pending before clearing', async () => {
  let resolveExport: (value: 'saved') => void = () => undefined;
  jest.mocked(needsPhoneWorkoutEnergy).mockResolvedValue(false);
  jest.mocked(queueCompletedWorkoutExport).mockImplementation(
    () =>
      new Promise<'saved'>((resolve) => {
        resolveExport = resolve;
      })
  );
  const clearedWhileDirty: boolean[] = [];
  mockClear.mockImplementation(() =>
    clearedWhileDirty.push(mockState.hasUnsavedChanges)
  );
  const flush = jest.fn(flushClean);
  const { result } = setup(flush);
  let finish: Promise<void> = Promise.resolve();
  await act(async () => {
    finish = result.current.handleFinish();
    for (let step = 0; step < 8; step++) await Promise.resolve();
  });
  expect(queueCompletedWorkoutExport).toHaveBeenCalledTimes(1);
  mockState = { ...mockState, hasUnsavedChanges: true };
  await act(async () => {
    resolveExport('saved');
    await finish;
  });
  expect(clearedWhileDirty).toEqual([false]);
  expect(flush).toHaveBeenCalledTimes(3);
});

it('does not clear a replacement workout or export it when the account changes during the prompt', async () => {
  const { result, safeGoBack, navigation } = setup(flushClean);
  let finish: Promise<void> = Promise.resolve();
  await act(async () => {
    finish = result.current.handleFinish();
    await Promise.resolve();
    await Promise.resolve();
  });
  mockState = {
    ...mockState,
    sessionId: 'replacement',
    sourceServerConfigId: 'server-2',
  };
  await act(async () => {
    energyButtons()[0].onPress?.();
    await finish;
  });
  expect(mockClear).not.toHaveBeenCalled();
  expect(queueCompletedWorkoutExport).not.toHaveBeenCalled();
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(safeGoBack).not.toHaveBeenCalled();
});

it('keeps dirty state when a change arrives during the last flush even if that request succeeds', async () => {
  jest.mocked(needsPhoneWorkoutEnergy).mockResolvedValue(false);
  const flush = jest
    .fn()
    .mockImplementationOnce(flushClean)
    .mockImplementationOnce(flushClean)
    .mockImplementationOnce(async () => {
      mockState = { ...mockState, hasUnsavedChanges: true };
      return true;
    });
  const { result, safeGoBack } = setup(flush);
  await act(async () => {
    await result.current.handleFinish();
  });
  expect(queueCompletedWorkoutExport).toHaveBeenCalledTimes(1);
  expect(mockClear).not.toHaveBeenCalled();
  expect(safeGoBack).not.toHaveBeenCalled();
});

it('does not discard a newer workout from an old save-error dialog', async () => {
  const { result, safeGoBack } = setup(async () => false);
  await act(async () => {
    await result.current.handleFinish();
  });
  const discard = jest.mocked(Alert.alert).mock.calls[0][2]?.[1];
  await act(async () => {
    discard?.onPress?.();
  });
  const confirm = jest.mocked(Alert.alert).mock.calls[1][2]?.[1];
  mockState = { ...mockState, sessionId: 'replacement' };
  await act(async () => {
    confirm?.onPress?.();
  });
  expect(mockClear).not.toHaveBeenCalled();
  expect(safeGoBack).not.toHaveBeenCalled();
});
