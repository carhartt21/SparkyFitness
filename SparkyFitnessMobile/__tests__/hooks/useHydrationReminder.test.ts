import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import {
  cancelWaterReminders,
  cancelWaterRemindersForDifferentIdentity,
  reconcileWaterReminders,
  useHydrationReminderReconciler,
  __resetWaterReminderStateForTests,
  type HydrationReminderReconcilerInput,
  type WaterReminderReconcileInput,
} from '../../src/hooks/useHydrationReminder';
import {
  cancelScheduledNotification,
  cancelScheduledNotificationWithResult,
  scheduleWaterReminderNotifications,
} from '../../src/services/notifications';
import {
  __resetDiscretionaryPromptLedgerForTests,
  reserveDiscretionaryPrompt,
} from '../../src/services/discretionaryPromptLedger';
import {
  useAppPreferencesStore,
  __resetAppPreferencesStoreForTests,
} from '../../src/stores/appPreferencesStore';

jest.mock('../../src/services/notifications', () => ({
  scheduleWaterReminderNotifications: jest.fn(),
  cancelScheduledNotification: jest.fn(),
  cancelScheduledNotificationWithResult: jest.fn(),
}));

const mockSchedule = scheduleWaterReminderNotifications as jest.MockedFunction<
  typeof scheduleWaterReminderNotifications
>;
const mockCancel = cancelScheduledNotification as jest.MockedFunction<
  typeof cancelScheduledNotification
>;
const mockCancelWithResult =
  cancelScheduledNotificationWithResult as jest.MockedFunction<
    typeof cancelScheduledNotificationWithResult
  >;

const STORAGE_KEY = '@SparkyFitness/waterReminderSchedule';
const at = (day: number, hours: number, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes, 0, 0);
const NOW = at(15, 9, 30);

function reconcileInput(
  overrides: Partial<WaterReminderReconcileInput> = {}
): WaterReminderReconcileInput {
  return {
    today: '2026-09-15',
    lastLoggedAt: at(15, 9),
    goalMetToday: false,
    intervalHours: 2,
    windowStart: '08:00',
    windowEnd: '22:00',
    ...overrides,
  };
}

async function storedIds(): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw).notificationIds : null;
}

beforeEach(async () => {
  __resetDiscretionaryPromptLedgerForTests();
  __resetWaterReminderStateForTests();
  __resetAppPreferencesStoreForTests();
  await AsyncStorage.clear();
  mockSchedule.mockReset().mockResolvedValue(['n1', 'n2']);
  mockCancel.mockReset().mockResolvedValue(undefined);
  mockCancelWithResult.mockReset().mockResolvedValue(true);
});

describe('reconcileWaterReminders', () => {
  it('schedules the chain computed from the last log and remembers the ids', async () => {
    await reconcileWaterReminders(reconcileInput(), NOW);

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const times = mockSchedule.mock.calls[0][0];
    expect(times[0]).toEqual(at(15, 11));
    expect(times).toHaveLength(12);
    expect(await storedIds()).toEqual(['n1', 'n2']);
  });

  it('is a no-op when nothing relevant changed', async () => {
    await reconcileWaterReminders(reconcileInput(), NOW);
    await reconcileWaterReminders(reconcileInput(), NOW);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('replaces reminders when an account mapping becomes available for quick log', async () => {
    await reconcileWaterReminders(reconcileInput(), NOW);
    await reconcileWaterReminders(
      reconcileInput({
        identity: { serverConfigId: 'server-A', userId: 'user-A' },
      }),
      NOW
    );
    expect(mockCancel).toHaveBeenCalledWith('n1');
    expect(mockSchedule.mock.calls[1][1]).toEqual({
      serverConfigId: 'server-A',
      userId: 'user-A',
    });
  });

  it('replaces the chain when a new drink is logged', async () => {
    await reconcileWaterReminders(reconcileInput(), NOW);
    mockSchedule.mockResolvedValueOnce(['n3']);

    await reconcileWaterReminders(
      reconcileInput({ lastLoggedAt: at(15, 10) }),
      at(15, 10)
    );

    expect(mockCancel).toHaveBeenCalledWith('n1');
    expect(mockCancel).toHaveBeenCalledWith('n2');
    expect(mockSchedule.mock.calls[1][0][0]).toEqual(at(15, 12));
    expect(await storedIds()).toEqual(['n3']);
  });

  it('uses the shared policy times and replaces the chain when its budget changes', async () => {
    await reconcileWaterReminders(
      reconcileInput({ plannedTimes: [at(15, 11), at(16, 8)] }),
      NOW
    );
    expect(mockSchedule.mock.calls[0][0]).toEqual([at(15, 11), at(16, 8)]);

    await reconcileWaterReminders(
      reconcileInput({ plannedTimes: [at(15, 11, 20), at(16, 8)] }),
      NOW
    );
    expect(mockCancel).toHaveBeenCalledWith('n1');
    expect(mockSchedule.mock.calls[1][0]).toEqual([at(15, 11, 20), at(16, 8)]);
  });

  it("moves the chain to tomorrow's window once today's goal is met", async () => {
    await reconcileWaterReminders(reconcileInput(), NOW);
    await reconcileWaterReminders(reconcileInput({ goalMetToday: true }), NOW);

    expect(mockCancel).toHaveBeenCalledWith('n1');
    expect(mockSchedule.mock.calls[1][0][0]).toEqual(at(16, 8));
  });

  it('retries on the next reconcile when nothing could be scheduled', async () => {
    mockSchedule.mockResolvedValueOnce([]);
    await reconcileWaterReminders(reconcileInput(), NOW);
    expect(await storedIds()).toBeNull();

    await reconcileWaterReminders(reconcileInput(), NOW);
    expect(mockSchedule).toHaveBeenCalledTimes(2);
    expect(await storedIds()).toEqual(['n1', 'n2']);
  });

  it('cancels the chain when it cannot be persisted', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('storage unavailable')
    );

    await reconcileWaterReminders(reconcileInput(), NOW);

    expect(mockCancel).toHaveBeenCalledWith('n1');
    expect(mockCancel).toHaveBeenCalledWith('n2');
    expect(await storedIds()).toBeNull();

    await reconcileWaterReminders(reconcileInput(), NOW);
    expect(await storedIds()).toEqual(['n1', 'n2']);
  });
});

describe('cancelWaterReminders', () => {
  it('retains a scheduled offline chain for the same account on relaunch', async () => {
    const identity = { serverConfigId: 'server-A', userId: 'user-A' };
    await reconcileWaterReminders(reconcileInput({ identity }), NOW);

    await cancelWaterRemindersForDifferentIdentity(identity);

    expect(await storedIds()).toEqual(['n1', 'n2']);
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockCancelWithResult).not.toHaveBeenCalled();
  });

  it('cancels a stored chain from another account', async () => {
    await reconcileWaterReminders(
      reconcileInput({
        identity: { serverConfigId: 'server-A', userId: 'user-A' },
      }),
      NOW
    );

    await cancelWaterRemindersForDifferentIdentity({
      serverConfigId: 'server-A',
      userId: 'user-B',
    });

    expect(await storedIds()).toBeNull();
    expect(mockCancel).toHaveBeenCalledWith('n1');
    expect(mockCancel).toHaveBeenCalledWith('n2');
  });

  it('cancels an old chain without an account marker', async () => {
    await reconcileWaterReminders(reconcileInput(), NOW);

    await cancelWaterRemindersForDifferentIdentity({
      serverConfigId: 'server-A',
      userId: 'user-A',
    });

    expect(await storedIds()).toBeNull();
    expect(mockCancel).toHaveBeenCalledWith('n1');
  });

  it('releases a future budget slot after a confirmed native cancellation', async () => {
    const identity = { serverConfigId: 'server-A', userId: 'user-A' };
    const day = new Date(Date.now() + 86_400_000);
    day.setHours(10, 0, 0, 0);
    const plannedAt = day.getTime() + 2 * 3_600_000;
    for (const [index, family] of ['nutrition', 'movement'].entries()) {
      await reserveDiscretionaryPrompt({
        identity,
        candidateId: `${family}:${index}`,
        at: day.getTime() + index * 3_600_000,
      });
    }
    await reserveDiscretionaryPrompt({
      identity,
      candidateId: `hydration:drink:${plannedAt}`,
      at: plannedAt,
    });
    mockSchedule.mockImplementationOnce(
      async (times, _identity, onScheduled) => {
        onScheduled?.('n1', times[0]);
        return ['n1'];
      }
    );
    await reconcileWaterReminders(
      reconcileInput({ identity, plannedTimes: [new Date(plannedAt)] }),
      NOW
    );
    await cancelWaterReminders();
    expect(mockCancelWithResult).toHaveBeenCalledWith('n1');
    expect(
      await reserveDiscretionaryPrompt({
        identity,
        candidateId: 'nutrition:replacement',
        at: day.getTime() + 3 * 3_600_000,
      })
    ).toBe(true);
  });

  it('cancels and forgets the scheduled chain', async () => {
    await reconcileWaterReminders(reconcileInput(), NOW);
    await cancelWaterReminders();

    expect(mockCancel).toHaveBeenCalledWith('n1');
    expect(mockCancel).toHaveBeenCalledWith('n2');
    expect(await storedIds()).toBeNull();
  });

  it('no-ops when nothing is scheduled', async () => {
    await cancelWaterReminders();
    expect(mockCancel).not.toHaveBeenCalled();
  });
});

describe('useHydrationReminderReconciler', () => {
  function hookInput(
    overrides: Partial<HydrationReminderReconcilerInput> = {}
  ): HydrationReminderReconcilerInput {
    return {
      today: '2026-09-15',
      lastLoggedAt: null,
      waterMl: 0,
      waterGoalMl: 2500,
      isLoading: false,
      refetch: jest.fn(),
      ...overrides,
    };
  }

  beforeEach(() => {
    useAppPreferencesStore.setState({
      waterReminderIntervalHours: 1,
      waterReminderWindowStart: '00:00',
      waterReminderWindowEnd: '23:59',
    });
  });

  it('schedules once reminders are on and data has loaded', async () => {
    useAppPreferencesStore.getState().setWaterReminderEnabled(true);
    renderHook(() => useHydrationReminderReconciler(hookInput()));
    await waitFor(() => expect(mockSchedule).toHaveBeenCalledTimes(1));
  });

  it('does not schedule while data is still loading', async () => {
    useAppPreferencesStore.getState().setWaterReminderEnabled(true);
    renderHook(() =>
      useHydrationReminderReconciler(hookInput({ isLoading: true }))
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('does not schedule while water reminders are off', async () => {
    renderHook(() => useHydrationReminderReconciler(hookInput()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('turning water reminders off cancels the scheduled chain', async () => {
    useAppPreferencesStore.getState().setWaterReminderEnabled(true);
    renderHook(() => useHydrationReminderReconciler(hookInput()));
    await waitFor(() => expect(mockSchedule).toHaveBeenCalledTimes(1));

    act(() => {
      useAppPreferencesStore.getState().setWaterReminderEnabled(false);
    });

    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith('n1'));
    await waitFor(async () => expect(await storedIds()).toBeNull());
  });

  it('turning the master notifications toggle off cancels the chain too', async () => {
    useAppPreferencesStore.getState().setWaterReminderEnabled(true);
    renderHook(() => useHydrationReminderReconciler(hookInput()));
    await waitFor(() => expect(mockSchedule).toHaveBeenCalledTimes(1));

    act(() => {
      useAppPreferencesStore.getState().setNotificationsEnabled(false);
    });

    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith('n1'));
  });

  it('refetches when the app returns to the foreground', () => {
    useAppPreferencesStore.getState().setWaterReminderEnabled(true);
    const listeners: ((state: string) => void)[] = [];
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler) => {
        listeners.push(handler as (state: string) => void);
        return { remove: jest.fn() } as never;
      });
    const refetch = jest.fn();

    renderHook(() => useHydrationReminderReconciler(hookInput({ refetch })));
    act(() => {
      listeners.forEach((listener) => listener('active'));
    });

    expect(refetch).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
