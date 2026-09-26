import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAddSheetActions } from '../../src/hooks/useAddSheetActions';
import { useSyncHealthData } from '../../src/hooks/useSyncHealthData';
import { navigationRef } from '../../src/components/ActiveWorkoutBar';
import { queryClient } from '../../src/hooks/queryClient';
import { serverConnectionQueryKey } from '../../src/hooks/queryKeys';
import { loadActiveDraft } from '../../src/services/workoutDraftService';
import { checkServerConnection } from '../../src/services/api/healthDataApi';

jest.mock('../../src/hooks/useSyncHealthData', () => ({
  useSyncHealthData: () => ({ isPending: false, mutate: jest.fn() }),
}));
jest.mock('../../src/hooks/useStartLiveWorkout', () => ({
  promptForActiveWorkoutConflict: jest.fn(),
}));
jest.mock('../../src/components/TabsLayout', () => ({
  NON_ADD_TABS: ['Dashboard', 'Diary', 'Library', 'Settings'],
}));
jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  navigationRef: {
    isReady: () => true,
    dispatch: jest.fn(),
    getRootState: () => ({
      routes: [
        {
          name: 'Tabs',
          state: {
            routes: [{ name: 'Diary', params: { selectedDate: '2020-01-01' } }],
          },
        },
      ],
    }),
  },
}));
jest.mock('../../src/services/workoutDraftService', () => ({
  loadActiveDraft: jest.fn().mockResolvedValue(null),
  clearDraft: jest.fn(),
}));
jest.mock('../../src/services/api/healthDataApi', () => ({
  checkServerConnection: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/utils/dateUtils', () => ({
  getTodayDate: () => '2026-09-27',
}));

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  jest.mocked(loadActiveDraft).mockResolvedValue(null);
  jest.mocked(checkServerConnection).mockResolvedValue(true);
});

it.each([
  ['scan', 'FoodScan'],
  ['food', 'FoodSearch'],
  ['measurements', 'MeasurementsAdd'],
] as const)(
  'opens %s for local today despite a historical Diary date, without resetting navigation',
  async (action, name) => {
    const { result } = renderHook(() =>
      useAddSheetActions({ syncMutation: useSyncHealthData() })
    );
    await act(async () => result.current.handleLaunchIconAction(action));
    expect(navigationRef.dispatch).toHaveBeenCalledWith({
      type: 'NAVIGATE',
      payload: { name, params: { date: '2026-09-27' } },
    });
  }
);

it('waits for cold-start connectivity and opens the activity editor for today', async () => {
  const { result } = renderHook(() =>
    useAddSheetActions({ syncMutation: useSyncHealthData() })
  );
  await act(async () => result.current.handleLaunchIconAction('activity'));
  expect(checkServerConnection).toHaveBeenCalledTimes(1);
  expect(navigationRef.dispatch).toHaveBeenCalledWith({
    type: 'NAVIGATE',
    payload: {
      name: 'ActivityAdd',
      params: { date: '2026-09-27', skipDraftLoad: true },
    },
  });
});

it('preserves the existing draft conflict prompt instead of overwriting a draft', async () => {
  jest
    .mocked(loadActiveDraft)
    .mockResolvedValue({ type: 'workout' } as Awaited<
      ReturnType<typeof loadActiveDraft>
    >);
  queryClient.setQueryData(serverConnectionQueryKey, true);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { result } = renderHook(() =>
    useAddSheetActions({ syncMutation: useSyncHealthData() })
  );
  await act(async () => result.current.handleLaunchIconAction('activity'));
  expect(alert).toHaveBeenCalled();
  expect(navigationRef.dispatch).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  buttons.find((button) => button.text === 'Resume Draft')!.onPress!();
  expect(navigationRef.dispatch).toHaveBeenCalledWith({
    type: 'NAVIGATE',
    payload: { name: 'WorkoutAdd' },
  });
  alert.mockRestore();
});

it('keeps the existing connection recovery prompt when offline', async () => {
  jest.mocked(checkServerConnection).mockResolvedValue(false);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { result } = renderHook(() =>
    useAddSheetActions({ syncMutation: useSyncHealthData() })
  );
  await act(async () => result.current.handleLaunchIconAction('activity'));
  expect(alert).toHaveBeenCalled();
  expect(navigationRef.dispatch).not.toHaveBeenCalled();
  alert.mockRestore();
});
