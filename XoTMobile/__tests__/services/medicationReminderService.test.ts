import i18n, { initializeI18n } from '../../src/localization/i18n';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { reconcileMedicationReminders } from '../../src/services/medicationReminderService';
import { getActiveNutritionIdentity } from '../../src/services/nutritionIdentity';
import { listNutritionActions } from '../../src/services/nutritionActionOutbox';
import {
  __resetAppPreferencesStoreForTests,
  useAppPreferencesStore,
} from '../../src/stores/appPreferencesStore';
import type {
  MedicationDetail,
  MedicationEntry,
  MedicationSchedule,
} from '@workspace/shared';

jest.mock('../../src/services/nutritionIdentity', () => ({
  getActiveNutritionIdentity: jest.fn(),
}));
jest.mock('../../src/services/nutritionActionOutbox', () => ({
  listNutritionActions: jest.fn(),
}));

const mockGetPerms = Notifications.getPermissionsAsync as jest.MockedFunction<
  typeof Notifications.getPermissionsAsync
>;
const mockSchedule =
  Notifications.scheduleNotificationAsync as jest.MockedFunction<
    typeof Notifications.scheduleNotificationAsync
  >;
const mockCancel =
  Notifications.cancelScheduledNotificationAsync as jest.MockedFunction<
    typeof Notifications.cancelScheduledNotificationAsync
  >;
const mockGetAllScheduled =
  Notifications.getAllScheduledNotificationsAsync as jest.MockedFunction<
    typeof Notifications.getAllScheduledNotificationsAsync
  >;
const mockSetChannel =
  Notifications.setNotificationChannelAsync as jest.MockedFunction<
    typeof Notifications.setNotificationChannelAsync
  >;

// Fixed "now": 2026-07-28 08:00 local. getTodayDate() and the past-dose
// cutoff in the service both derive from this.
const NOW = new Date(2026, 6, 28, 8, 0, 0);
const TODAY = '2026-07-28';
const BASE_KEY = `med_${TODAY}_med-1_sched-1_09:00`;

// The 7-day scheduling window starting at NOW.
const WINDOW_DATES = [
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
  '2026-08-03',
];

const baseKeyFor = (date: string) => `med_${date}_med-1_sched-1_09:00`;

function buildSchedule(
  overrides: Partial<MedicationSchedule> = {}
): MedicationSchedule {
  return {
    id: 'sched-1',
    medication_id: 'med-1',
    schedule_type_id: 'daily',
    time_of_day: '09:00',
    dose_amount: null,
    days_of_week: null,
    interval_days: null,
    day_of_month: null,
    cycle_on_days: null,
    cycle_off_days: null,
    prn_reason: null,
    prn_max_per_day: null,
    with_meal: null,
    start_date: null,
    end_date: null,
    active: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function buildMedication(
  overrides: Partial<MedicationDetail> = {}
): MedicationDetail {
  return {
    id: 'med-1',
    user_id: 'user-1',
    name: 'Metformin',
    display_name: null,
    type_id: 'pill',
    route_id: null,
    strength_value: null,
    strength_unit: null,
    dose_amount: 500,
    dose_unit: 'mg',
    reason_text: null,
    effectiveness_rating: null,
    color: null,
    icon: null,
    photo_path: null,
    is_active: true,
    is_quick: false,
    is_glp1: false,
    notes: null,
    source: 'manual',
    custom_fields: {},
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    schedules: [buildSchedule()],
    ...overrides,
  };
}

function buildEntry(overrides: Partial<MedicationEntry> = {}): MedicationEntry {
  return {
    id: 'entry-1',
    user_id: 'user-1',
    medication_id: 'med-1',
    schedule_id: 'sched-1',
    status: 'taken',
    taken_at: `${TODAY}T09:05:00Z`,
    scheduled_for: null,
    entry_date: TODAY,
    med_name_snapshot: null,
    dose_amount_snapshot: null,
    dose_unit_snapshot: null,
    notes: null,
    source: 'manual',
    custom_fields: {},
    created_at: `${TODAY}T09:05:00Z`,
    updated_at: `${TODAY}T09:05:00Z`,
    ...overrides,
  };
}

function pendingRequest(
  identifier: string,
  data?: Record<string, string>
): Notifications.NotificationRequest {
  return {
    identifier,
    content: { data: data ? { copyRevision: '20261001b', ...data } : data },
    trigger: null,
  } as unknown as Notifications.NotificationRequest;
}

function scheduledKeys(): string[] {
  return (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(
    (c) => c[0].content.data?.key as string
  );
}

describe('reconcileMedicationReminders', () => {
  beforeAll(async () => {
    await initializeI18n('en');
  });
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    __resetAppPreferencesStoreForTests();
    useAppPreferencesStore.setState({ medicationReminderRepeats: true });
    mockGetPerms.mockReset().mockResolvedValue({ status: 'granted' } as never);
    mockSchedule.mockReset().mockResolvedValue('notif-id' as never);
    mockCancel.mockReset().mockResolvedValue(undefined);
    mockGetAllScheduled.mockReset().mockResolvedValue([]);
    mockSetChannel.mockClear();
    (getActiveNutritionIdentity as jest.Mock).mockResolvedValue(null);
    (listNutritionActions as jest.Mock).mockResolvedValue([]);
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('when reminders are off', () => {
    it.each([
      ['medication reminders pref', { medicationRemindersEnabled: false }],
      ['app notifications toggle', { notificationsEnabled: false }],
    ])(
      'cancels pending medication reminders when the %s is off',
      async (_label, prefs) => {
        useAppPreferencesStore.setState(prefs);
        mockGetAllScheduled.mockResolvedValue([
          pendingRequest('n1', { medicationId: 'med-1', key: BASE_KEY }),
          pendingRequest('n2', undefined),
        ]);

        await reconcileMedicationReminders([buildMedication()], []);

        expect(mockCancel).toHaveBeenCalledTimes(1);
        expect(mockCancel).toHaveBeenCalledWith('n1');
        expect(mockSchedule).not.toHaveBeenCalled();
      }
    );

    it('cancels pending medication reminders when the OS permission is not granted', async () => {
      mockGetPerms.mockResolvedValue({ status: 'denied' } as never);
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('n1', { medicationId: 'med-1', key: BASE_KEY }),
      ]);

      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockCancel).toHaveBeenCalledWith('n1');
      expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('never cancels non-medication notifications', async () => {
      useAppPreferencesStore.setState({ medicationRemindersEnabled: false });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('rest-timer', { workoutId: 'w1' }),
        pendingRequest('fasting-goal', undefined),
      ]);

      await reconcileMedicationReminders([], []);

      expect(mockCancel).not.toHaveBeenCalled();
    });
  });

  describe('scheduling', () => {
    it.each([
      ['missing', null],
      ['another account', { userId: 'other-user', serverConfigId: 'server-1' }],
    ])(
      'does not offer an unusable supplement action for %s identity',
      async (_label, identity) => {
        (getActiveNutritionIdentity as jest.Mock).mockResolvedValue(identity);
        mockGetAllScheduled.mockResolvedValue([
          pendingRequest('old-dose', {
            medicationId: 'med-1',
            key: BASE_KEY,
          }),
        ]);

        await reconcileMedicationReminders(
          [buildMedication({ is_supplement: true })],
          []
        );

        expect(mockCancel).toHaveBeenCalledWith('old-dose');
        expect(mockSchedule).not.toHaveBeenCalled();
      }
    );

    it('does not recreate a supplement reminder after an offline response is queued', async () => {
      (getActiveNutritionIdentity as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        serverConfigId: 'server-1',
      });
      (listNutritionActions as jest.Mock).mockResolvedValue([
        {
          type: 'logPlannedSupplement',
          payload: { schedule_id: 'sched-1', entry_date: TODAY },
        },
      ]);
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('old-dose', {
          medicationId: 'med-1',
          key: BASE_KEY,
        }),
      ]);

      await reconcileMedicationReminders(
        [buildMedication({ is_supplement: true })],
        []
      );

      expect(mockCancel).toHaveBeenCalledWith('old-dose');
      expect(scheduledKeys()).not.toContain(BASE_KEY);
      expect(listNutritionActions).toHaveBeenCalledWith({
        userId: 'user-1',
        serverConfigId: 'server-1',
      });
    });

    it('schedules a base reminder plus 10/20/30-minute repeats for an unlogged future dose', async () => {
      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockSchedule).toHaveBeenNthCalledWith(1, {
        identifier: `medication:local:user-1:${BASE_KEY}`,
        content: {
          title: '💊 Medication reminder',
          body: 'Your scheduled intake: Metformin (500 mg)',
          sound: true,
          categoryIdentifier: 'medication-reminder',
          data: {
            medicationId: 'med-1',
            scheduleId: 'sched-1',
            entryDate: TODAY,
            key: BASE_KEY,
            baseKey: BASE_KEY,
            hideNames: 'false',
            locale: 'en',
            responseVersion: '2',
            copyRevision: '20261001b',
            accountUserId: 'user-1',
            serverConfigId: '',
            isSupplement: 'false',
          },
        },
        trigger: {
          type: 'date',
          date: new Date(2026, 6, 28, 9, 0, 0, 0),
          channelId: 'medication-reminders',
        },
      });

      const repeatCalls = mockSchedule.mock.calls.slice(1, 4);
      expect(repeatCalls.map((c) => c[0].content.data?.key)).toEqual([
        `${BASE_KEY}_10`,
        `${BASE_KEY}_20`,
        `${BASE_KEY}_30`,
      ]);
      expect(
        repeatCalls.map((c) => (c[0].trigger as { date: Date }).date)
      ).toEqual([
        new Date(2026, 6, 28, 9, 10, 0, 0),
        new Date(2026, 6, 28, 9, 20, 0, 0),
        new Date(2026, 6, 28, 9, 30, 0, 0),
      ]);
      // Repeats keep pointing at the base dose so a "taken" response can
      // sweep the whole chain.
      expect(
        repeatCalls.every((c) => c[0].content.data?.baseKey === BASE_KEY)
      ).toBe(true);
      expect(repeatCalls.map(([request]) => request.content.title)).toEqual([
        '💊 Intake · follow-up 1',
        '💊 Intake · follow-up 2',
        '💊 Intake · follow-up 3',
      ]);
      expect(
        repeatCalls.every(
          ([request]) =>
            request.content.body !== mockSchedule.mock.calls[0][0].content.body
        )
      ).toBe(true);
    });

    it('schedules base reminders for the whole 7-day window, with repeats only today', async () => {
      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockSchedule).toHaveBeenCalledTimes(10);
      const keys = scheduledKeys();
      for (const date of WINDOW_DATES) {
        expect(keys).toContain(baseKeyFor(date));
      }
      expect(
        keys.filter(
          (k) => k.endsWith('_10') || k.endsWith('_20') || k.endsWith('_30')
        )
      ).toEqual([`${BASE_KEY}_10`, `${BASE_KEY}_20`, `${BASE_KEY}_30`]);

      // Future reminders log the dose against their own day, not today.
      const day3 = mockSchedule.mock.calls.find(
        (c) => c[0].content.data?.key === baseKeyFor('2026-07-31')
      );
      expect(day3?.[0].content.data?.entryDate).toBe('2026-07-31');
      expect((day3?.[0].trigger as { date: Date }).date).toEqual(
        new Date(2026, 6, 31, 9, 0, 0, 0)
      );
    });

    it('schedules only base reminders when repeats are disabled', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });

      await reconcileMedicationReminders([buildMedication()], []);

      expect(scheduledKeys()).toEqual(WINDOW_DATES.map(baseKeyFor));
    });

    it('omits the dose suffix from the body when the medication has no dose amount', async () => {
      await reconcileMedicationReminders(
        [buildMedication({ dose_amount: null, dose_unit: null })],
        []
      );

      expect(mockSchedule.mock.calls[0][0].content.body).toBe(
        'Your scheduled intake: Metformin'
      );
    });

    it.each([['taken'], ['skipped']] as const)(
      'drops today and cancels the pending chain when the dose is %s',
      async (status) => {
        mockGetAllScheduled.mockResolvedValue([
          pendingRequest('n1', { medicationId: 'med-1', key: BASE_KEY }),
          pendingRequest('n2', {
            medicationId: 'med-1',
            key: `${BASE_KEY}_10`,
          }),
        ]);

        await reconcileMedicationReminders(
          [buildMedication()],
          [buildEntry({ status })]
        );

        expect(scheduledKeys()).toEqual(WINDOW_DATES.slice(1).map(baseKeyFor));
        expect(mockCancel).toHaveBeenCalledTimes(2);
        expect(mockCancel).toHaveBeenCalledWith('n1');
        expect(mockCancel).toHaveBeenCalledWith('n2');
      }
    );

    it('still schedules when the only entry is snoozed', async () => {
      await reconcileMedicationReminders(
        [buildMedication()],
        [buildEntry({ status: 'snoozed' })]
      );

      expect(mockSchedule).toHaveBeenCalledTimes(10);
    });

    it('still schedules when the logged entry belongs to a different schedule', async () => {
      await reconcileMedicationReminders(
        [buildMedication()],
        [buildEntry({ schedule_id: 'sched-other' })]
      );

      expect(mockSchedule).toHaveBeenCalledTimes(10);
    });

    it('treats a schedule-less entry for the medication as logging today, like the dashboard card', async () => {
      await reconcileMedicationReminders(
        [buildMedication()],
        [buildEntry({ schedule_id: null })]
      );

      expect(scheduledKeys()).toEqual(WINDOW_DATES.slice(1).map(baseKeyFor));
    });

    it('skips schedules with no time of day', async () => {
      await reconcileMedicationReminders(
        [
          buildMedication({
            schedules: [buildSchedule({ time_of_day: null })],
          }),
        ],
        []
      );

      expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('skips inactive medications', async () => {
      await reconcileMedicationReminders(
        [buildMedication({ is_active: false })],
        []
      );

      expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('skips today entirely when the dose time and all repeats are in the past', async () => {
      await reconcileMedicationReminders(
        [
          buildMedication({
            schedules: [buildSchedule({ time_of_day: '07:00' })],
          }),
        ],
        []
      );

      expect(mockSchedule).toHaveBeenCalledTimes(6);
      expect(scheduledKeys().every((k) => !k.includes(TODAY))).toBe(true);
    });

    it('schedules only the still-future repeats when the base time just passed', async () => {
      // Dose at 07:55, now 08:00: base is past, repeats land at 08:05/08:15/08:25.
      await reconcileMedicationReminders(
        [
          buildMedication({
            schedules: [buildSchedule({ time_of_day: '07:55' })],
          }),
        ],
        []
      );

      expect(mockSchedule).toHaveBeenCalledTimes(9);
      const baseKey = `med_${TODAY}_med-1_sched-1_07:55`;
      expect(scheduledKeys().slice(0, 3)).toEqual([
        `${baseKey}_10`,
        `${baseKey}_20`,
        `${baseKey}_30`,
      ]);
    });

    it('replaces pending reminders when the effective app language changes', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('english', {
          medicationId: 'med-1',
          key: BASE_KEY,
          hideNames: 'false',
          locale: 'pl',
        }),
      ]);

      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockCancel).toHaveBeenCalledWith('english');
      expect(mockSchedule.mock.calls[0][0].content.data?.locale).toBe('en');
    });

    it('refreshes old English notifications with German content and locale', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('old-english', {
          medicationId: 'med-1',
          key: BASE_KEY,
          hideNames: 'false',
          locale: 'en',
          copyRevision: 'old',
        }),
      ]);
      await i18n.changeLanguage('de');
      try {
        await reconcileMedicationReminders([buildMedication()], []);
        expect(mockCancel).toHaveBeenCalledWith('old-english');
        const content = mockSchedule.mock.calls[0][0].content;
        expect(content.data?.locale).toBe('de');
        expect(content.title).not.toMatch(/reminder/i);
        expect(content.body).not.toMatch(/scheduled/i);
        expect(content.data?.copyRevision).toBe('20261001b');
      } finally {
        await i18n.changeLanguage('en');
      }
    });

    it('does not reschedule a dose whose base reminder is already pending', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('n1', {
          medicationId: 'med-1',
          key: BASE_KEY,
          hideNames: 'false',
          locale: 'en',
          responseVersion: '2',
          accountUserId: 'user-1',
          serverConfigId: '',
          isSupplement: 'false',
        }),
      ]);

      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockCancel).not.toHaveBeenCalled();
      expect(scheduledKeys()).toEqual(WINDOW_DATES.slice(1).map(baseKeyFor));
    });

    it('adds the repeat pings behind an already-pending base reminder when repeats turn on mid-day', async () => {
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('n1', {
          medicationId: 'med-1',
          key: BASE_KEY,
          hideNames: 'false',
          locale: 'en',
          responseVersion: '2',
          accountUserId: 'user-1',
          serverConfigId: '',
          isSupplement: 'false',
        }),
      ]);

      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockCancel).not.toHaveBeenCalled();
      const keys = scheduledKeys();
      expect(keys).not.toContain(BASE_KEY);
      expect(keys).toEqual(
        expect.arrayContaining([
          `${BASE_KEY}_10`,
          `${BASE_KEY}_20`,
          `${BASE_KEY}_30`,
        ])
      );
    });

    it('cancels stale reminders from a previous day and schedules fresh ones', async () => {
      const staleKey = 'med_2026-07-27_med-1_sched-1_09:00';
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('stale', { medicationId: 'med-1', key: staleKey }),
      ]);

      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockCancel).toHaveBeenCalledWith('stale');
      expect(mockSchedule).toHaveBeenCalledTimes(10);
    });

    it('cancels medication notifications that carry no key', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('legacy', { medicationId: 'med-1' }),
      ]);

      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockCancel).toHaveBeenCalledWith('legacy');
      expect(mockSchedule).toHaveBeenCalledTimes(7);
    });

    it('stops the lookahead at a schedule end date', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });

      await reconcileMedicationReminders(
        [
          buildMedication({
            schedules: [buildSchedule({ end_date: '2026-07-30' })],
          }),
        ],
        []
      );

      expect(scheduledKeys()).toEqual([
        baseKeyFor('2026-07-28'),
        baseKeyFor('2026-07-29'),
        baseKeyFor('2026-07-30'),
      ]);
    });
  });

  describe('hide names', () => {
    beforeEach(() => {
      useAppPreferencesStore.setState({ medicationReminderHideNames: true });
    });

    it('uses a generic body with no medication name or dose', async () => {
      await reconcileMedicationReminders([buildMedication()], []);

      for (const call of mockSchedule.mock.calls) {
        expect(call[0].content.body).toBe(
          call[0].content.data?.repeatNumber
            ? 'Already recorded? Check your scheduled intake status in the app.'
            : 'Record your scheduled intake if you have taken it.'
        );
        expect(call[0].content.data?.hideNames).toBe('true');
      }
    });

    it('cancels pending named reminders and reschedules them censored when the preference turns on', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('named', {
          medicationId: 'med-1',
          key: BASE_KEY,
          hideNames: 'false',
        }),
      ]);

      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockCancel).toHaveBeenCalledWith('named');
      expect(scheduledKeys()).toEqual(WINDOW_DATES.map(baseKeyFor));
    });

    it('treats unstamped pending reminders as named and replaces them', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('legacy-named', {
          medicationId: 'med-1',
          key: BASE_KEY,
        }),
      ]);

      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockCancel).toHaveBeenCalledWith('legacy-named');
      expect(scheduledKeys()).toContain(BASE_KEY);
    });

    it('cancels pending censored reminders and reschedules them named when the preference turns back off', async () => {
      useAppPreferencesStore.setState({
        medicationReminderHideNames: false,
        medicationReminderRepeats: false,
      });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('censored', {
          medicationId: 'med-1',
          key: BASE_KEY,
          hideNames: 'true',
        }),
      ]);

      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockCancel).toHaveBeenCalledWith('censored');
      const base = mockSchedule.mock.calls.find(
        (c) => c[0].content.data?.key === BASE_KEY
      );
      expect(base?.[0].content.body).toBe(
        'Your scheduled intake: Metformin (500 mg)'
      );
    });
  });

  describe('medication and supplement identity', () => {
    it.each(['en', 'de'])(
      'uses category-specific copy and the schedule dose in %s',
      async (language) => {
        (getActiveNutritionIdentity as jest.Mock).mockResolvedValue({
          userId: 'user-1',
          serverConfigId: 'server-1',
        });
        useAppPreferencesStore.setState({ medicationReminderRepeats: false });
        await i18n.changeLanguage(language);
        try {
          await reconcileMedicationReminders(
            [
              buildMedication({
                is_supplement: true,
                name: 'Synthetic supplement',
                schedules: [buildSchedule({ dose_amount: 2 })],
              }),
            ],
            []
          );
          const content = mockSchedule.mock.calls[0][0].content;
          expect(content.title).toBe(
            language === 'de'
              ? '🌿 Supplement-Erinnerung'
              : '🌿 Supplement reminder'
          );
          expect(content.body).toContain('Synthetic supplement (2 mg)');
          expect(content.data?.isSupplement).toBe('true');
          expect(content.categoryIdentifier).toBe('medication-reminder');
        } finally {
          await i18n.changeLanguage('en');
        }
      }
    );

    it('hides supplement name and dose without calling it a medication', async () => {
      (getActiveNutritionIdentity as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        serverConfigId: 'server-1',
      });
      useAppPreferencesStore.setState({
        medicationReminderHideNames: true,
        medicationReminderRepeats: false,
      });
      await reconcileMedicationReminders(
        [buildMedication({ is_supplement: true, name: 'Private name' })],
        []
      );
      const content = mockSchedule.mock.calls[0][0].content;
      expect(content.title).toBe('🌿 Supplement reminder');
      expect(content.body).toBe(
        'Record your planned supplement if you have taken it.'
      );
      expect(content.body).not.toContain('Private name');
    });

    it('replaces a medication reminder after explicit reclassification as a supplement', async () => {
      (getActiveNutritionIdentity as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        serverConfigId: 'server-1',
      });
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('old-category', {
          medicationId: 'med-1',
          key: BASE_KEY,
          hideNames: 'false',
          locale: 'en',
          responseVersion: '2',
          accountUserId: 'user-1',
          serverConfigId: 'server-1',
          isSupplement: 'false',
        }),
      ]);
      await reconcileMedicationReminders(
        [buildMedication({ is_supplement: true })],
        []
      );
      expect(mockCancel).toHaveBeenCalledWith('old-category');
      expect(mockSchedule.mock.calls[0][0].content.title).toBe(
        '🌿 Supplement reminder'
      );
    });
  });

  describe('platform channel', () => {
    it('ensures the Android medication channel before scheduling', async () => {
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });

      await reconcileMedicationReminders([buildMedication()], []);

      expect(mockSetChannel).toHaveBeenCalledWith(
        'medication-reminders',
        expect.objectContaining({
          importance: Notifications.AndroidImportance.HIGH,
        })
      );
    });
  });

  describe('locking', () => {
    it('preserves different schedule identities with the same item and time', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      await reconcileMedicationReminders(
        [
          buildMedication({
            schedules: [buildSchedule(), buildSchedule({ id: 'sched-other' })],
          }),
        ],
        []
      );
      expect(mockSchedule).toHaveBeenCalledTimes(14);
      expect(new Set(scheduledKeys()).size).toBe(14);
    });

    it('does not retry a failed schedule within a duplicate input pass', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      mockSchedule.mockRejectedValue(new Error('Native schedule failed'));
      const medication = buildMedication();
      await reconcileMedicationReminders([medication, medication], []);
      expect(mockSchedule).toHaveBeenCalledTimes(7);
    });

    it('schedules each occurrence once when the input repeats the same medication or schedule', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      const medication = buildMedication({
        schedules: [buildSchedule(), buildSchedule()],
      });
      await reconcileMedicationReminders([medication, medication], []);
      expect(scheduledKeys()).toEqual(WINDOW_DATES.map(baseKeyFor));
    });

    it('removes duplicate native requests for an otherwise current occurrence', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      const data = {
        medicationId: 'med-1',
        key: BASE_KEY,
        hideNames: 'false',
        locale: 'en',
        responseVersion: '2',
        accountUserId: 'user-1',
        serverConfigId: '',
        isSupplement: 'false',
      };
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('first', data),
        pendingRequest('duplicate', data),
      ]);
      await reconcileMedicationReminders([buildMedication()], []);
      expect(mockCancel).toHaveBeenCalledWith('duplicate');
      expect(mockCancel).not.toHaveBeenCalledWith('first');
      expect(scheduledKeys()).not.toContain(BASE_KEY);
    });

    it('does not add a replacement if cancelling an old request fails', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('old-copy', { medicationId: 'med-1', key: BASE_KEY }),
      ]);
      mockCancel.mockRejectedValue(new Error('Native cancellation failed'));
      await reconcileMedicationReminders([buildMedication()], []);
      expect(scheduledKeys()).not.toContain(BASE_KEY);
    });

    it('uses the same account-scoped native identifiers when the pending snapshot is stale', async () => {
      useAppPreferencesStore.setState({ medicationReminderRepeats: false });
      await reconcileMedicationReminders([buildMedication()], []);
      const first = mockSchedule.mock.calls.map(
        ([request]) => request.identifier
      );
      mockSchedule.mockClear();
      await reconcileMedicationReminders([buildMedication()], []);
      const second = mockSchedule.mock.calls.map(
        ([request]) => request.identifier
      );
      expect(first.every((identifier) => typeof identifier === 'string')).toBe(
        true
      );
      expect(second).toEqual(first);
    });

    it('makes a concurrent second call a no-op', async () => {
      useAppPreferencesStore.setState({ medicationRemindersEnabled: false });
      mockGetAllScheduled.mockResolvedValue([
        pendingRequest('n1', { medicationId: 'med-1', key: BASE_KEY }),
      ]);

      const first = reconcileMedicationReminders([], []);
      const second = reconcileMedicationReminders([], []);
      await Promise.all([first, second]);

      expect(mockGetAllScheduled).toHaveBeenCalledTimes(1);
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });
  });
});
