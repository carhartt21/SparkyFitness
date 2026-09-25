import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import HydrationReminderReconciler from '../../src/components/HydrationReminderReconciler';
import { useDailySummary } from '../../src/hooks/useDailySummary';
import { useServerConnection } from '../../src/hooks/useServerConnection';
import {
  cancelWaterReminders,
  cancelWaterRemindersForDifferentIdentity,
  useHydrationReminderReconciler,
} from '../../src/hooks/useHydrationReminder';
import {
  getActiveNutritionIdentity,
  subscribeNutritionIdentity,
} from '../../src/services/nutritionIdentity';
import { useManualWaterActions } from '../../src/hooks/useManualWaterActions';
import { fetchWaterIntakeLog } from '../../src/services/api/measurementsApi';
import {
  useAppPreferencesStore,
  __resetAppPreferencesStoreForTests,
} from '../../src/stores/appPreferencesStore';
import {
  createQueryWrapper,
  createTestQueryClient,
  type QueryClient,
} from '../hooks/queryTestUtils';

jest.mock('../../src/hooks/useDailySummary', () => ({
  useDailySummary: jest.fn(),
}));
jest.mock('../../src/hooks/useServerConnection', () => ({
  useServerConnection: jest.fn(),
}));
jest.mock('../../src/hooks/useHydrationReminder', () => ({
  useHydrationReminderReconciler: jest.fn(),
  cancelWaterReminders: jest.fn(() => Promise.resolve()),
  cancelWaterRemindersForDifferentIdentity: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
  subscribeNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/hooks/useManualWaterActions', () => ({
  useManualWaterActions: jest.fn(),
}));
jest.mock('../../src/services/api/measurementsApi', () => ({
  fetchWaterIntakeLog: jest.fn(),
}));

const mockUseDailySummary = useDailySummary as jest.MockedFunction<
  typeof useDailySummary
>;
const mockUseServerConnection = useServerConnection as jest.MockedFunction<
  typeof useServerConnection
>;
const mockReconciler = useHydrationReminderReconciler as jest.MockedFunction<
  typeof useHydrationReminderReconciler
>;
const mockLocalWater = useManualWaterActions as jest.MockedFunction<
  typeof useManualWaterActions
>;
const mockFetchLog = fetchWaterIntakeLog as jest.MockedFunction<
  typeof fetchWaterIntakeLog
>;
const mockGetIdentity = getActiveNutritionIdentity as jest.MockedFunction<
  typeof getActiveNutritionIdentity
>;
const mockSubscribeIdentity = subscribeNutritionIdentity as jest.MockedFunction<
  typeof subscribeNutritionIdentity
>;
const mockCancelWater = cancelWaterReminders as jest.MockedFunction<
  typeof cancelWaterReminders
>;
const mockCancelForIdentity =
  cancelWaterRemindersForDifferentIdentity as jest.MockedFunction<
    typeof cancelWaterRemindersForDifferentIdentity
  >;

describe('HydrationReminderReconciler', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetAppPreferencesStoreForTests();
    queryClient = createTestQueryClient();
    mockGetIdentity.mockResolvedValue({
      serverConfigId: 'server-1',
      userId: 'account-a',
    });
    mockSubscribeIdentity.mockReturnValue(() => undefined);
    mockUseServerConnection.mockReturnValue({
      isConnected: true,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);
    mockUseDailySummary.mockReturnValue({
      summary: { waterConsumed: 500, waterGoal: 2500 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as never);
    mockLocalWater.mockReturnValue({
      latestLoggedAt: null,
      pendingMl: 0,
      attentionMl: 0,
      remoteKnown: false,
      storageError: false,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("feeds today's water total, goal and latest log time into the reconciler", async () => {
    useAppPreferencesStore.getState().setWaterReminderEnabled(true);
    mockLocalWater.mockReturnValue({
      latestLoggedAt: new Date('2026-09-15T10:30:00.000Z'),
      pendingMl: 0,
      attentionMl: 0,
      remoteKnown: true,
      storageError: false,
    });
    mockFetchLog.mockResolvedValue([
      { logged_at: '2026-09-15T08:00:00.000Z' },
      { logged_at: '2026-09-15T10:30:00.000Z' },
    ] as never);

    const { toJSON } = render(
      <HydrationReminderReconciler
        sharedPlan={[]}
        nowMs={Date.now()}
        medicationReservedTimes={[]}
        spentByDay={{}}
      />,
      {
        wrapper: createQueryWrapper(queryClient),
      }
    );

    expect(toJSON()).toBeNull();
    await waitFor(() =>
      expect(mockReconciler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          waterMl: 500,
          waterGoalMl: 2500,
          isLoading: false,
          lastLoggedAt: new Date('2026-09-15T10:30:00.000Z'),
        })
      )
    );
  });

  it('skips fetching while reminders are off but still runs the reconciler so it can cancel', async () => {
    render(
      <HydrationReminderReconciler
        sharedPlan={[]}
        nowMs={Date.now()}
        medicationReservedTimes={[]}
        spentByDay={{}}
      />,
      {
        wrapper: createQueryWrapper(queryClient),
      }
    );

    expect(mockFetchLog).not.toHaveBeenCalled();
    expect(mockUseDailySummary).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
    expect(mockReconciler).toHaveBeenCalled();
    await waitFor(() =>
      expect(mockReconciler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          identity: expect.objectContaining({ userId: 'account-a' }),
        })
      )
    );
  });

  it('skips fetching while the server is unreachable, matching the Dashboard', async () => {
    useAppPreferencesStore.getState().setWaterReminderEnabled(true);
    mockUseServerConnection.mockReturnValue({
      isConnected: false,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);

    render(
      <HydrationReminderReconciler
        sharedPlan={[]}
        nowMs={Date.now()}
        medicationReservedTimes={[]}
        spentByDay={{}}
      />,
      {
        wrapper: createQueryWrapper(queryClient),
      }
    );

    expect(mockFetchLog).not.toHaveBeenCalled();
    expect(mockUseDailySummary).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
    expect(mockReconciler).toHaveBeenCalled();
    await waitFor(() =>
      expect(mockReconciler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          identity: expect.objectContaining({ userId: 'account-a' }),
        })
      )
    );
  });

  it('uses a durable offline drink as the reminder anchor', async () => {
    useAppPreferencesStore.getState().setWaterReminderEnabled(true);
    mockUseServerConnection.mockReturnValue({
      isConnected: false,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as never);
    mockLocalWater.mockReturnValue({
      latestLoggedAt: new Date('2026-09-15T10:30:00.000Z'),
      pendingMl: 250,
      attentionMl: 0,
      remoteKnown: false,
      storageError: false,
    });

    render(
      <HydrationReminderReconciler
        sharedPlan={[]}
        nowMs={Date.now()}
        medicationReservedTimes={[]}
        spentByDay={{}}
      />,
      {
        wrapper: createQueryWrapper(queryClient),
      }
    );

    await waitFor(() =>
      expect(mockReconciler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: false,
          lastLoggedAt: new Date('2026-09-15T10:30:00.000Z'),
          waterMl: 750,
        })
      )
    );
  });

  it('clears the old reminder identity before reading a new account', async () => {
    useAppPreferencesStore.getState().setWaterReminderEnabled(true);
    let notifyIdentityChange: (() => void) | undefined;
    mockSubscribeIdentity.mockImplementation((listener) => {
      notifyIdentityChange = listener;
      return () => undefined;
    });
    render(
      <HydrationReminderReconciler
        sharedPlan={[]}
        nowMs={Date.now()}
        medicationReservedTimes={[]}
        spentByDay={{}}
      />,
      { wrapper: createQueryWrapper(queryClient) }
    );
    await waitFor(() =>
      expect(mockReconciler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          identity: expect.objectContaining({ userId: 'account-a' }),
        })
      )
    );

    let finishRead:
      | ((identity: { serverConfigId: string; userId: string }) => void)
      | undefined;
    mockGetIdentity.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = resolve;
      })
    );
    act(() => notifyIdentityChange?.());

    expect(mockReconciler).toHaveBeenLastCalledWith(
      expect.objectContaining({ identity: null, isLoading: true })
    );
    expect(mockCancelWater).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishRead?.({ serverConfigId: 'server-1', userId: 'account-b' });
    });
    await waitFor(() =>
      expect(mockReconciler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          identity: expect.objectContaining({ userId: 'account-b' }),
        })
      )
    );
    expect(mockUseDailySummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ scope: 'server-1:account-b' })
    );
    expect(mockCancelForIdentity).toHaveBeenLastCalledWith({
      serverConfigId: 'server-1',
      userId: 'account-b',
    });
  });
});
