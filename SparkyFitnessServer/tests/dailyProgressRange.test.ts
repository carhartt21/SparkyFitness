import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/logging.js', () => ({ log: vi.fn() }));
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: vi.fn(async () => 'UTC'),
}));
vi.mock('@workspace/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@workspace/shared')>();
  return { ...actual, todayInZone: () => '2026-09-28' };
});

const repo = vi.hoisted(() => ({
  getDailyTrackingPreferences: vi.fn(),
  getDailyTrackingPreferencesUpdatedAt: vi.fn(),
  listHabitDefinitionsWithHistory: vi.fn(),
  listHabitLogs: vi.fn(),
  listDailyCheckins: vi.fn(),
  firstDailyCheckinDate: vi.fn(),
  listMeasurementRemindersWithHistory: vi.fn(),
  recordedWeightsInRange: vi.fn(),
  listMealActivityInRange: vi.fn(),
  getDailyCheckin: vi.fn(),
  listHabits: vi.fn(),
  listMeasurementReminders: vi.fn(),
  recordedMeasurementsOn: vi.fn(),
  listMealStatuses: vi.fn(async () => []),
}));
vi.mock('../models/dailyTrackingRepository.js', () => repo);
vi.mock('../models/medicationRepository.js', () => ({
  default: { listMedications: vi.fn(async () => []) },
}));
vi.mock('../models/medicationEntryRepository.js', () => ({
  default: { listEntries: vi.fn(async () => []) },
}));

import { getDailyProgressRange } from '../services/dailyProgressService.js';

const habit = (overrides: Record<string, unknown> = {}) => ({
  id: 'h1',
  name: 'Stretch',
  habit_type: 'completion',
  description: null,
  unit: null,
  target: null,
  step: null,
  days: null,
  reminder_time: null,
  active: true,
  sort_order: 0,
  icon: null,
  created_at: '2026-09-20T08:00:00Z',
  updated_at: '2026-09-20T08:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  repo.getDailyTrackingPreferences.mockResolvedValue({
    include_checkin: true,
    include_habits: true,
    include_supplements: true,
    include_meals: false,
    checkin_reminder_enabled: false,
    checkin_reminder_time: '20:30',
    habit_reminders_enabled: false,
  });
  repo.getDailyTrackingPreferencesUpdatedAt.mockResolvedValue(null);
  repo.listHabitDefinitionsWithHistory.mockResolvedValue([habit()]);
  repo.listHabitLogs.mockResolvedValue([
    { habit_id: 'h1', entry_date: '2026-09-25', value: 1, recorded_at: 't' },
  ]);
  repo.listDailyCheckins.mockResolvedValue([]);
  repo.firstDailyCheckinDate.mockResolvedValue(null);
  repo.listMeasurementRemindersWithHistory.mockResolvedValue([]);
  repo.recordedWeightsInRange.mockResolvedValue({});
});

describe('getDailyProgressRange', () => {
  it('leaves days before tracking started and future days unknown', async () => {
    const days = await getDailyProgressRange('u', '2026-09-18', '2026-09-30');
    const state = (date: string) => days.find((d) => d.date === date)?.state;
    expect(state('2026-09-19')).toBe('unknown');
    expect(state('2026-09-20')).toBe('not_started');
    expect(state('2026-09-25')).toBe('complete');
    expect(state('2026-09-29')).toBe('unknown');
  });

  it('does not apply an edited habit schedule to earlier days', async () => {
    repo.listHabitDefinitionsWithHistory.mockResolvedValue([
      habit({ updated_at: '2026-09-26T10:00:00Z', days: [1] }),
    ]);
    const days = await getDailyProgressRange('u', '2026-09-24', '2026-09-28');
    const state = (date: string) => days.find((d) => d.date === date)?.state;
    expect(state('2026-09-24')).toBe('unknown');
    expect(state('2026-09-25')).toBe('unknown');
    // From the edit onwards the current definition is the right one.
    expect(state('2026-09-28')).toBe('not_started');
  });

  it('ignores habits created after a day', async () => {
    repo.listHabitDefinitionsWithHistory.mockResolvedValue([
      habit(),
      habit({
        id: 'h2',
        created_at: '2026-09-27T09:00:00Z',
        updated_at: '2026-09-27T09:00:00Z',
      }),
    ]);
    const days = await getDailyProgressRange('u', '2026-09-25', '2026-09-25');
    expect(days[0]).toMatchObject({ state: 'complete', applicable: 1 });
  });

  it('only counts the check-in from the first day the user checked in', async () => {
    repo.firstDailyCheckinDate.mockResolvedValue('2026-09-26');
    repo.listHabitDefinitionsWithHistory.mockResolvedValue([]);
    repo.getDailyTrackingPreferencesUpdatedAt.mockResolvedValue(
      '2026-09-01T00:00:00Z'
    );
    const days = await getDailyProgressRange('u', '2026-09-25', '2026-09-26');
    expect(days[0]).toMatchObject({ state: 'none', applicable: 0 });
    expect(days[1]).toMatchObject({ state: 'not_started', applicable: 1 });
  });
});
