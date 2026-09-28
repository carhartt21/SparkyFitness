import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import {
  arbitrateDiscretionaryCandidates,
  nutritionReminderCandidates,
  trackingReminderCandidates,
} from '../../src/services/healthEngagementPolicy';
import {
  initTrackingEngagementResponses,
  reconcileTrackingEngagementReminders,
  trackingReminderUrl,
} from '../../src/services/trackingEngagementReminders';
import { hasNotificationPermission } from '../../src/services/notifications';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { __resetDiscretionaryPromptLedgerForTests } from '../../src/services/discretionaryPromptLedger';
import { getTodayDate } from '../../src/utils/dateUtils';

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: 'default',
}));
jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/notifications', () => ({
  hasNotificationPermission: jest.fn(),
}));

const DAY = '2026-09-28';
const at = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2026, 8, 28, hours, minutes).getTime();
};

describe('trackingReminderCandidates', () => {
  const base = {
    day: DAY,
    now: at('06:00'),
    checkin: { enabled: true, time: '20:30', resolved: false },
    habits: [],
    measurements: [],
  };

  it('invites an unrecorded check-in at the chosen time', () => {
    const [candidate] = trackingReminderCandidates(base);
    expect(candidate).toMatchObject({
      id: `tracking:checkin:${DAY}`,
      domain: 'tracking',
      kind: 'checkin',
      preferredAt: at('20:30'),
    });
  });

  it('resolves a completed or skipped check-in and never prompts when unknown', () => {
    expect(
      trackingReminderCandidates({
        ...base,
        checkin: { enabled: true, time: '20:30', resolved: true },
      })
    ).toEqual([]);
    expect(trackingReminderCandidates({ ...base, checkin: null })).toEqual([]);
  });

  it('only prompts for unrecorded habits and measurements in the future', () => {
    const candidates = trackingReminderCandidates({
      ...base,
      now: at('12:00'),
      checkin: null,
      habits: [
        { id: 'a', time: '19:00:00', resolved: false },
        { id: 'b', time: '19:00', resolved: true },
        { id: 'c', time: '08:00', resolved: false },
      ],
      measurements: [{ key: 'weight', time: '18:00', resolved: false }],
    });
    expect(candidates.map((candidate) => candidate.id)).toEqual([
      `tracking:habit:${DAY}:a`,
      `tracking:measurement:${DAY}:weight`,
    ]);
  });

  it('shares the daily budget and spacing with other optional reminders', () => {
    const tracking = trackingReminderCandidates({
      ...base,
      habits: [
        { id: 'a', time: '20:30', resolved: false },
        { id: 'b', time: '20:35', resolved: false },
      ],
    });
    const accepted = arbitrateDiscretionaryCandidates({
      candidates: tracking,
      dailyCap: 3,
      domainCaps: { tracking: 2 },
      collisionMinutes: 20,
      reservedTimes: [],
      now: at('06:00'),
    });
    expect(accepted).toHaveLength(2);
    expect(
      accepted[1].preferredAt - accepted[0].preferredAt
    ).toBeGreaterThanOrEqual(20 * 60_000);
  });
});

describe('tracking reminder notifications', () => {
  const identity = { serverConfigId: 'server-A', userId: 'user-A' };

  beforeEach(async () => {
    __resetDiscretionaryPromptLedgerForTests();
    await AsyncStorage.clear();
    jest.clearAllMocks();
    jest.mocked(hasNotificationPermission).mockResolvedValue(true);
    jest
      .mocked(Notifications.getAllScheduledNotificationsAsync)
      .mockResolvedValue([]);
    jest
      .mocked(Notifications.getPresentedNotificationsAsync)
      .mockResolvedValue([]);
    jest
      .mocked(Notifications.scheduleNotificationAsync)
      .mockResolvedValue('id');
    jest.mocked(getActiveNutritionIdentity).mockResolvedValue(identity);
  });

  it('schedules the weigh-in prompt with neutral copy', async () => {
    const tomorrow = Date.now() + 86_400_000;
    await reconcileTrackingEngagementReminders({
      identity,
      enabled: true,
      habitNames: new Map(),
      candidates: [
        {
          id: 'tracking:measurement:future:weight',
          domain: 'tracking',
          kind: 'measurement',
          preferredAt: tomorrow,
          earliestAt: tomorrow,
          expiresAt: tomorrow + 3_600_000,
          flexibilityMinutes: 0,
        },
      ],
    });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Weigh-in',
          body: 'Ready to record today’s weight?',
        }),
      })
    );
  });

  it('opens the screen for today’s reminder and records nothing', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    initTrackingEngagementResponses();
    const listener = jest.mocked(
      Notifications.addNotificationResponseReceivedListener
    ).mock.calls[0][0];
    listener({
      actionIdentifier: 'default',
      notification: {
        request: {
          identifier: 'engagement:tracking:server-A:user-A:x',
          content: {
            data: {
              version: 1,
              candidateId: `tracking:checkin:${getTodayDate()}`,
              serverConfigId: 'server-A',
              userId: 'user-A',
            },
          },
        },
      },
    } as unknown as Notifications.NotificationResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(openURL).toHaveBeenCalledWith('sparkyfitnessmobile://checkin');
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('ignores reminders from another day', () => {
    expect(trackingReminderUrl('tracking:checkin:2000-01-01')).toBeNull();
    expect(trackingReminderUrl(`tracking:habit:${getTodayDate()}:a`)).toBe(
      'sparkyfitnessmobile://habits'
    );
  });
});

describe('meal status and meal reminders', () => {
  const state = {
    day: DAY,
    capturedCount: 0,
    incompleteCount: 0,
    pendingSyncCount: 0,
    remoteKnown: true,
    knownCalories: null,
    capturedAt: [],
    generatedAt: 0,
  };
  const windows = [
    {
      id: 'selected',
      start: '11:00',
      end: '14:00',
      prompt: '13:00',
      enabled: true,
    },
  ];

  it('resolves the capture reminder when a meal in the window is marked complete or no meal', () => {
    expect(
      nutritionReminderCandidates({
        state,
        windows,
        reviewTime: null,
        now: at('09:00'),
      })
    ).toHaveLength(1);
    expect(
      nutritionReminderCandidates({
        state,
        windows,
        reviewTime: null,
        now: at('09:00'),
        resolvedMealTimes: ['12:30:00'],
      })
    ).toEqual([]);
  });

  it('keeps the reminder when the resolved meal belongs to another window', () => {
    expect(
      nutritionReminderCandidates({
        state,
        windows,
        reviewTime: null,
        now: at('09:00'),
        resolvedMealTimes: ['08:00'],
      })
    ).toHaveLength(1);
  });
});
