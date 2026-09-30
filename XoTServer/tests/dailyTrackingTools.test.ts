import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolExecutionOptions } from 'ai';

vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

// Every write in the repository throws, so a tool that writes fails loudly.
vi.mock('../models/dailyTrackingRepository.js', () => {
  const write = () => vi.fn(() => Promise.reject(new Error('write called')));
  return {
    getDailyCheckin: vi.fn(async () => null),
    listDailyCheckins: vi.fn(async () => []),
    listHabitLogs: vi.fn(async () => []),
    listHabits: vi.fn(async () => []),
    listHealthContextPeriods: vi.fn(async () => []),
    listMeasurementReminders: vi.fn(async () => []),
    recordedMeasurementsOn: vi.fn(async () => ({})),
    saveDailyCheckin: write(),
    skipDailyCheckin: write(),
    logHabit: write(),
    createHabit: write(),
    updateHabit: write(),
    deleteHabit: write(),
    createHealthContextPeriod: write(),
    updateHealthContextPeriod: write(),
    deleteHealthContextPeriod: write(),
    upsertMeasurementReminder: write(),
    setMealStatus: write(),
    updateDailyTrackingPreferences: write(),
  };
});

vi.mock('../services/dailyProgressService.js', () => ({
  getDailyProgress: vi.fn(async (_user: string, date: string) => ({
    version: 1,
    date,
    items: [],
    applicable: 0,
    completed: 0,
    percent: null,
    coverage: {},
  })),
  getMealTrackingStatus: vi.fn(async (_user: string, date: string) => ({
    entry_date: date,
    meals: [],
    coverage: {},
  })),
  getSupplementDoses: vi.fn(async () => []),
}));

vi.mock('../models/medicationRepository.js', () => ({
  default: {
    listMedications: vi.fn(async () => [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Vitamin D3',
        display_name: null,
        is_supplement: true,
        is_active: true,
        dose_amount: '1',
        dose_unit: 'capsule',
        notes: null,
        schedules: [],
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Prescription X',
        display_name: null,
        is_supplement: false,
        is_active: true,
        dose_amount: '5',
        dose_unit: 'mg',
        notes: 'private',
        schedules: [],
      },
    ]),
  },
}));

vi.mock('../models/medicationEntryRepository.js', () => ({
  default: {
    listEntries: vi.fn(async () => [
      {
        id: 'e1',
        medication_id: '11111111-1111-4111-8111-111111111111',
        schedule_id: null,
        status: 'taken',
        entry_date: '2026-09-28',
        taken_at: '2026-09-28T08:00:00Z',
        med_name_snapshot: 'Vitamin D3',
        dose_amount_snapshot: 1,
        dose_unit_snapshot: 'capsule',
      },
      {
        id: 'e2',
        medication_id: '22222222-2222-4222-8222-222222222222',
        schedule_id: null,
        status: 'taken',
        entry_date: '2026-09-28',
        taken_at: '2026-09-28T08:00:00Z',
        med_name_snapshot: 'Prescription X',
        dose_amount_snapshot: 5,
        dose_unit_snapshot: 'mg',
      },
      {
        id: 'e3',
        medication_id: null,
        schedule_id: null,
        status: 'taken',
        entry_date: '2026-09-28',
        taken_at: '2026-09-28T09:00:00Z',
        med_name_snapshot: 'Deleted item',
        dose_amount_snapshot: 1,
        dose_unit_snapshot: 'mg',
      },
    ]),
  },
}));

import {
  buildDailyTrackingTools,
  buildSupplementReadTools,
  DAILY_TRACKING_READ_TOOL_NAMES,
  TRACKING_TOOL_MAX_DAYS,
} from '../ai/tools/dailyTrackingTools.js';
import * as repo from '../models/dailyTrackingRepository.js';

const EXEC: ToolExecutionOptions<Record<string, unknown>> = {
  toolCallId: 't',
  messages: [],
  context: {},
};

type Executable = {
  execute?: (args: unknown, options: typeof EXEC) => unknown;
};

async function call(
  tools: Record<string, Executable>,
  name: string,
  args: unknown
) {
  return String(await tools[name].execute!(args, EXEC));
}

const WRITES = [
  'saveDailyCheckin',
  'skipDailyCheckin',
  'logHabit',
  'createHabit',
  'updateHabit',
  'deleteHabit',
  'createHealthContextPeriod',
  'updateHealthContextPeriod',
  'deleteHealthContextPeriod',
  'upsertMeasurementReminder',
  'setMealStatus',
  'updateDailyTrackingPreferences',
] as const;

describe('daily tracking read tools', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes exactly the declared read tools', () => {
    const tools = buildDailyTrackingTools('user', 'UTC');
    expect(Object.keys(tools).sort()).toEqual(
      [...DAILY_TRACKING_READ_TOOL_NAMES].sort()
    );
  });

  it('never calls a repository write for any tool', async () => {
    const tools = buildDailyTrackingTools('user', 'UTC') as Record<
      string,
      Executable
    >;
    const args: Record<string, unknown> = {
      sparky_list_daily_checkins: {
        start_date: '2026-09-01',
        end_date: '2026-09-28',
      },
      sparky_get_habit_history: {
        start_date: '2026-09-01',
        end_date: '2026-09-28',
      },
    };
    for (const name of DAILY_TRACKING_READ_TOOL_NAMES) {
      const text = await call(tools, name, args[name] ?? {});
      expect(text, name).not.toContain('Error [');
    }
    for (const write of WRITES) {
      expect(vi.mocked(repo[write]), write).not.toHaveBeenCalled();
    }
  });

  it('rejects ranges longer than the tool bound', async () => {
    const tools = buildDailyTrackingTools('user', 'UTC') as Record<
      string,
      Executable
    >;
    const text = await call(tools, 'sparky_list_daily_checkins', {
      start_date: '2025-01-01',
      end_date: '2026-09-28',
    });
    expect(text).toContain(`at most ${TRACKING_TOOL_MAX_DAYS} days`);
    expect(repo.listDailyCheckins).not.toHaveBeenCalled();
  });

  it('rejects unknown arguments instead of acting on them', async () => {
    const tools = buildDailyTrackingTools('user', 'UTC') as Record<
      string,
      Executable
    >;
    const text = await call(tools, 'sparky_get_daily_checkin', {
      date: '2026-09-28',
      state: 'completed',
    });
    expect(text).toContain('Error [');
  });
});

describe('supplement read tools', () => {
  it('lists supplements without medications', async () => {
    const tools = buildSupplementReadTools('user', 'UTC') as Record<
      string,
      Executable
    >;
    const text = await call(tools, 'sparky_list_supplements', {});
    expect(text).toContain('Vitamin D3');
    expect(text).not.toContain('Prescription X');
    expect(text).not.toContain('private');
  });

  it('treats a medication ID as not found', async () => {
    const tools = buildSupplementReadTools('user', 'UTC') as Record<
      string,
      Executable
    >;
    const text = await call(tools, 'sparky_get_supplement', {
      supplement_id: '22222222-2222-4222-8222-222222222222',
    });
    expect(text).toContain('NOT_FOUND');
    expect(text).not.toContain('Prescription X');
  });

  it('lists only supplement intake entries', async () => {
    const tools = buildSupplementReadTools('user', 'UTC') as Record<
      string,
      Executable
    >;
    const text = await call(tools, 'sparky_list_supplement_entries', {
      start_date: '2026-09-28',
      end_date: '2026-09-28',
    });
    expect(text).toContain('"id":"e1"');
    expect(text).not.toContain('e2');
    expect(text).not.toContain('Deleted item');
  });
});
