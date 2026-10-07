import { describe, it, expect } from 'vitest';
import {
  calendarCoachingSlots,
  defaultCoachingSettingsV2,
  coachingRunSchema,
  coachingRunV2Schema,
  coachingRunReportV2Schema,
  coachingSettingsSchema,
  coachingSettingsV2Schema,
  cloudCoachingTaskPrompt,
  cloudCoachingInstructions,
} from '@workspace/shared';
import { recordedEvidenceDays } from '../services/coachingCalendarEvidence.js';
const settings = { ...defaultCoachingSettingsV2, enabled: true };
describe('calendar review protocol', () => {
  it.each([
    ['2026-10-05T06:00:00Z', 'daily', '2026-10-04', '2026-10-04'],
    ['2026-10-05T06:00:00Z', 'weekly', '2026-09-28', '2026-10-04'],
    ['2026-10-05T06:00:00Z', 'monthly', '2026-09-01', '2026-09-30'],
    ['2027-01-01T07:00:00Z', 'yearly', '2026-01-01', '2026-12-31'],
    ['2028-03-01T07:00:00Z', 'monthly', '2028-02-01', '2028-02-29'],
    ['2026-10-26T06:59:00Z', 'daily', '2026-10-24', '2026-10-24'],
    ['2026-10-26T07:00:00Z', 'daily', '2026-10-25', '2026-10-25'],
    ['2026-03-30T06:00:00Z', 'weekly', '2026-03-23', '2026-03-29'],
  ])('uses account-local boundaries for %s %s', (now, kind, from, to) => {
    expect(
      calendarCoachingSlots(new Date(now), 'Europe/Berlin', settings).find(
        (slot) => slot.kind === kind
      )
    ).toMatchObject({ from, to });
  });
  it('coalesces missed windows, preserves fixed slot identities and respects pause/opt-ins', () => {
    const slots = calendarCoachingSlots(
      new Date('2026-10-09T10:00:00Z'),
      'Europe/Berlin',
      settings
    );
    expect(slots).toHaveLength(4);
    expect(slots[2]?.from).toBe('2026-09-28');
    expect(slots[0]?.slotKey).toBe('v2:yearly:2025-01-01:2025-12-31');
    expect(
      calendarCoachingSlots(new Date(), 'Europe/Berlin', {
        ...settings,
        enabled: false,
      })
    ).toEqual([]);
    expect(
      calendarCoachingSlots(new Date(), 'Europe/Berlin', {
        ...settings,
        cadences: ['daily'],
      })
    ).toHaveLength(1);
  });
  it('does not widen strict legacy contracts or accept incomplete successful reports', () => {
    expect(coachingSettingsSchema.safeParse(settings).success).toBe(false);
    expect(
      coachingSettingsV2Schema.safeParse({
        ...settings,
        contextPermissions: ['medications'],
      }).success
    ).toBe(false);
    const run = {
      id: '00000000-0000-4000-8000-000000000001',
      agentId: null,
      kind: 'yearly',
      status: 'succeeded',
      from: '2025-01-01',
      to: '2025-12-31',
      startedAt: null,
      finishedAt: null,
      leaseUntil: null,
      failureCode: null,
    };
    expect(coachingRunSchema.safeParse(run).success).toBe(false);
    expect(coachingRunV2Schema.safeParse(run).success).toBe(true);
    expect(
      coachingRunReportV2Schema.safeParse({
        runId: run.id,
        leaseToken: 'a'.repeat(64),
        operationId: run.id,
        status: 'succeeded',
      }).success
    ).toBe(false);
  });
  it('caps coverage by recorded days rather than aggregate row counts', () => {
    expect(
      recordedEvidenceDays(
        [
          {
            id: 'calendar:synthetic',
            domain: 'measurements',
            kind: 'calendar_summary',
            day: null,
            source: 'measurement',
            observedAt: null,
            confirmation: 'confirmed',
            value: { observedDays: ['2026-09-01', '2026-09-02', '2026-10-01'] },
          },
        ],
        '2026-09-01',
        '2026-09-30'
      ).size
    ).toBe(2);
  });
  it('generates a German cloud task without credentials or direct-write approval', () => {
    const prompt = cloudCoachingTaskPrompt('08:00', 'Europe/Berlin', 'de-DE');
    expect(prompt).toContain('08:00 (Europe/Berlin)');
    expect(prompt).toContain('Freigabe erfolgt immer in X on Track');
    expect(prompt).not.toContain('xotagent_');
  });
  it.each(['de-DE', 'en'])(
    'bounds recurring write permission and denial handling in %s',
    (locale) => {
      const prompt = cloudCoachingTaskPrompt('08:00', 'Europe/Berlin', locale);
      for (const tool of [
        'xot_claim_coaching_run',
        'xot_submit_coaching_proposals',
        'xot_report_coaching_run',
      ])
        expect(prompt).toContain(tool);
      for (const status of ['heartbeat', 'failed', 'succeeded'])
        expect(prompt).toContain(status);
      expect(prompt).toContain(
        locale.startsWith('de')
          ? 'ersetzt keine Plattformfreigabe'
          : 'does not replace platform approval'
      );
      expect(prompt).toContain(
        locale.startsWith('de')
          ? 'wenn ich dies gesondert beauftrage'
          : 'unless I separately ask'
      );
      expect(cloudCoachingInstructions).toContain(
        'Do not retry a denied action'
      );
      expect(cloudCoachingInstructions).toContain(
        'Never acknowledge unread feedback'
      );
      expect(cloudCoachingInstructions).toContain('owner separately asks');
      expect(cloudCoachingInstructions).toContain('status=succeeded');
    }
  );
});
