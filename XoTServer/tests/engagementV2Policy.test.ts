import { describe, expect, it } from 'vitest';
import {
  deriveEngagementPlan,
  selectOptionalReminderSlots,
  engagementQuietAt,
  engagementSettingsSchema,
  engagementSettingsV2Schema,
  engagementSettingsPatchV2Schema,
  mobilityRoutineSchema,
  mobilityScheduleDays,
  mobilityOutcomeIdsValid,
  type EngagementFacts,
  type EngagementSettingsV2,
} from '@workspace/shared';
const settings: EngagementSettingsV2 = {
  schema_version: 2,
  schedule_initialized: true,
  revision: 1,
  remote_enabled: true,
  quiet_start: '22:00',
  quiet_end: '08:00',
  daily_limit: 3,
  hydration_enabled: true,
  hydration_start: '08:00',
  hydration_end: '22:00',
  hydration_interval_hours: 2,
  meal_capture_enabled: true,
  meal_capture_start: '12:00',
  meal_capture_end: '14:00',
  meal_capture_time: '13:00',
  meal_review_enabled: true,
  meal_review_time: '20:00',
  movement_break_enabled: true,
  movement_break_time: '15:00',
  mobility_enabled: true,
};
const facts: EngagementFacts = {
  paused: false,
  capturedTimes: [],
  resolvedMealTimes: [],
  pendingPhotoCount: 1,
  water: { goalMet: false, latestAt: '2026-09-30T07:00:00Z' },
  movementStarted: false,
  subjects: [
    {
      kind: 'check_in',
      id: 'daily',
      time: '16:00',
      enabled: true,
      resolved: false,
    },
    {
      kind: 'habit',
      id: 'habit-a',
      time: '16:30',
      enabled: true,
      resolved: false,
    },
    {
      kind: 'weigh_in',
      id: 'weight-a',
      time: '17:00',
      enabled: true,
      resolved: false,
    },
    {
      kind: 'mobility',
      id: 'plan-a',
      time: '18:00',
      enabled: true,
      resolved: false,
    },
  ],
};
const plan = (patch: Partial<EngagementFacts> = {}) =>
  deriveEngagementPlan({
    now: new Date('2026-09-30T08:00:00Z'),
    timezone: 'Europe/Berlin',
    settings,
    facts: { ...facts, ...patch },
  });
describe('configured reminders', () => {
  it('keeps v1 strict and accepts configurable or unlimited v2 caps', () => {
    expect(engagementSettingsSchema.safeParse(settings).success).toBe(false);
    expect(
      engagementSettingsV2Schema.parse({ ...settings, daily_limit: null })
        .daily_limit
    ).toBeNull();
    for (const daily_limit of [0, 51, 1.5])
      expect(
        engagementSettingsPatchV2Schema.safeParse({
          expected_revision: 1,
          daily_limit,
        }).success
      ).toBe(false);
  });
  it('includes unfinished check-ins, habits, weighing and planned mobility', () =>
    expect(plan().candidates.map((c) => c.kind)).toEqual(
      expect.arrayContaining(['check_in', 'habit', 'weigh_in', 'mobility'])
    ));
  it('suppresses explicit completed/skipped subjects, captured meal windows, reviewed photos and started timers', () => {
    const result = plan({
      subjects: facts.subjects.map((s) => ({ ...s, resolved: true })),
      capturedTimes: ['2026-09-30T10:10:00Z'],
      pendingPhotoCount: 0,
      movementStarted: true,
      water: { latestAt: null, goalMet: true },
    });
    expect(result.candidates).toEqual([]);
  });
  it('unknown nutrition, drink goal or subject state is never interpreted as missing', () => {
    const result = plan({
      capturedTimes: null,
      resolvedMealTimes: null,
      pendingPhotoCount: null,
      water: null,
      movementStarted: null,
      subjects: facts.subjects.map((s) => ({ ...s, resolved: null })),
    });
    expect(result.candidates).toEqual([]);
    expect(
      result.diagnostics.every((d) => d.reason === 'data_unavailable')
    ).toBe(true);
  });
  it('pauses every optional kind without touching medication or rest domains', () =>
    expect(plan({ paused: true }).candidates).toEqual([]));
  it('anchors water cadence to the latest real drink, not the changing cron minute', () => {
    const input = { timezone: 'Europe/Berlin', settings, facts };
    const first = deriveEngagementPlan({
      ...input,
      now: new Date('2026-09-30T08:00:00Z'),
    });
    const second = deriveEngagementPlan({
      ...input,
      now: new Date('2026-09-30T08:01:00Z'),
    });
    expect(first.candidates.filter((s) => s.kind === 'hydration')).toEqual(
      second.candidates.filter((s) => s.kind === 'hydration')
    );
    expect(
      first.candidates.find((s) => s.kind === 'hydration')?.preferredAt
    ).toBe(Date.parse('2026-09-30T09:00:00Z'));
  });
  it('respects meal status without inventing a zero-calorie meal', () =>
    expect(
      plan({ resolvedMealTimes: ['12:30'] }).candidates.some(
        (s) => s.kind === 'meal_capture'
      )
    ).toBe(false));
  it('uses local calendar day around midnight and DST', () => {
    expect(
      engagementQuietAt(
        Date.parse('2026-10-25T00:30:00Z'),
        'Europe/Berlin',
        '22:00',
        '08:00'
      )
    ).toBe(true);
    expect(
      deriveEngagementPlan({
        now: new Date('2026-09-30T23:30:00Z'),
        timezone: 'Europe/Berlin',
        settings,
        facts,
      }).candidates.every((s) => s.localDay === '2026-10-01')
    ).toBe(true);
  });
  it('applies nullable cap without removing collision, expiry or quiet-hour safeguards', () => {
    const candidates = [0, 5, 40, 60].map((minute) => ({
      id: String(minute),
      preferredAt: Date.parse('2026-09-30T09:00:00Z') + minute * 60_000,
      earliestAt: 0,
      expiresAt: Date.parse('2026-09-30T11:00:00Z'),
      flexibilityMinutes: 20,
    }));
    const input = {
      candidates,
      now: Date.parse('2026-09-30T08:00:00Z'),
      timezone: 'Europe/Berlin',
      quietStart: '22:00',
      quietEnd: '08:00',
      occupied: [],
    };
    expect(
      selectOptionalReminderSlots({ ...input, dailyLimit: 1 })
    ).toHaveLength(1);
    const unlimited = selectOptionalReminderSlots({
      ...input,
      dailyLimit: null,
    });
    expect(unlimited).toHaveLength(4);
    expect(unlimited[1].preferredAt - unlimited[0].preferredAt).toBe(
      20 * 60_000
    );
    expect(
      selectOptionalReminderSlots({
        ...input,
        dailyLimit: null,
        quietStart: '10:00',
        quietEnd: '14:00',
      })
    ).toEqual([]);
  });
  it('orders equally timed candidates by stable identity', () => {
    const candidates = ['z', 'a'].map((id) => ({
      id,
      preferredAt: 100000,
      earliestAt: 100000,
      expiresAt: 200000,
      flexibilityMinutes: 0,
    }));
    expect(
      selectOptionalReminderSlots({
        candidates,
        now: 0,
        dailyLimit: null,
        occupied: [],
        timezone: 'UTC',
        quietStart: '00:00',
        quietEnd: '00:00',
      })[0].id
    ).toBe('a');
  });
});
describe('mobility snapshots and recurrence', () => {
  const routine = mobilityRoutineSchema.parse({
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Synthetic routine',
    cue: 'off',
    createdAt: '2026-09-30T09:00:00Z',
    updatedAt: '2026-09-30T09:00:00Z',
    steps: [
      {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Reach',
        instructions: '',
        side: 'both',
        kind: 'timed',
        durationSeconds: 30,
        transitionSeconds: 0,
      },
    ],
  });
  it('materializes enabled weekday calendars without converting days through device time', () => {
    const schedule = {
      id: routine.id,
      routineId: routine.id,
      weekdays: [1, 3, 5],
      time: '18:00',
      startDay: '2026-09-28',
      endDay: '2026-10-02',
      enabled: true,
    };
    expect(mobilityScheduleDays(schedule, '2026-09-27', '2026-10-04')).toEqual([
      '2026-09-28',
      '2026-09-30',
      '2026-10-02',
    ]);
    expect(
      mobilityScheduleDays(
        { ...schedule, enabled: false },
        '2026-09-27',
        '2026-10-04'
      )
    ).toEqual([]);
  });
  it('leaves missing outcomes unknown and rejects foreign step IDs', () => {
    expect(mobilityOutcomeIdsValid(routine, [])).toBe(true);
    expect(
      mobilityOutcomeIdsValid(routine, [
        {
          stepId: routine.id,
          result: 'completed',
          recordedAt: '2026-09-30T09:00:00Z',
        },
      ])
    ).toBe(false);
  });
});
