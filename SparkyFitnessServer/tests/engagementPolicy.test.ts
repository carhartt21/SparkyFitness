import { describe, expect, it } from 'vitest';
import type { EngagementSettings } from '@workspace/shared';
import {
  dueEngagementCandidates,
  mayReserveEngagementCandidate,
  nextAllowedEngagementTime,
} from '../services/engagementPolicy.js';

const settings: EngagementSettings = {
  revision: 0,
  remote_enabled: true,
  quiet_start: '22:00',
  quiet_end: '08:00',
  hydration_enabled: true,
  meal_capture_enabled: true,
  meal_review_enabled: true,
  movement_break_enabled: true,
  mobility_enabled: true,
};

describe('remote engagement policy', () => {
  it('sends no optional reminder while a context period pauses them', () => {
    expect(
      dueEngagementCandidates({
        now: new Date('2026-09-27T09:05:00Z'),
        timezone: 'Europe/Berlin',
        settings,
        context: {
          foodCount: 0,
          waterCount: 0,
          exerciseCount: 0,
          pendingPhotoCount: 0,
          remindersPaused: true,
        },
      })
    ).toEqual([]);
  });

  it('uses the account local day across a UTC offset and only acts on known gaps', () => {
    const candidates = dueEngagementCandidates({
      now: new Date('2026-09-27T09:05:00Z'),
      timezone: 'Europe/Berlin',
      settings,
      context: {
        foodCount: 1,
        waterCount: 0,
        exerciseCount: 0,
        pendingPhotoCount: 0,
      },
    });
    expect(candidates.map((candidate) => candidate.kind)).toEqual([
      'hydration',
    ]);
    expect(candidates[0]?.localDay).toBe('2026-09-27');
    expect(candidates[0]?.scheduledAt.toISOString()).toBe(
      '2026-09-27T09:00:00.000Z'
    );
  });

  it('does not send a stale or quiet-hours reminder', () => {
    const input = {
      timezone: 'Europe/Berlin',
      settings,
      context: {
        foodCount: 0,
        waterCount: 0,
        exerciseCount: 0,
        pendingPhotoCount: 1,
      },
    };
    expect(
      dueEngagementCandidates({
        ...input,
        now: new Date('2026-09-27T19:00:00Z'),
      })
    ).toEqual([]);
    expect(
      dueEngagementCandidates({
        ...input,
        now: new Date('2026-09-27T18:05:00Z'),
        settings: { ...settings, quiet_start: '19:00', quiet_end: '08:00' },
      })
    ).toEqual([]);
  });

  it('caps optional prompts at three per day and keeps twenty minutes apart', () => {
    const candidate = {
      kind: 'hydration' as const,
      localDay: '2026-09-27',
      scheduledAt: new Date('2026-09-27T09:00:00Z'),
    };
    expect(
      mayReserveEngagementCandidate(candidate, [
        { scheduledAt: new Date('2026-09-27T08:41:00Z'), status: 'sent' },
      ])
    ).toBe(false);
    expect(
      mayReserveEngagementCandidate(candidate, [
        { scheduledAt: new Date('2026-09-27T08:40:00Z'), status: 'sent' },
      ])
    ).toBe(true);
    expect(
      mayReserveEngagementCandidate(candidate, [
        { scheduledAt: new Date('2026-09-27T07:00:00Z'), status: 'sent' },
        { scheduledAt: new Date('2026-09-27T08:00:00Z'), status: 'sent' },
        { scheduledAt: new Date('2026-09-27T08:30:00Z'), status: 'pending' },
      ])
    ).toBe(false);
  });

  it('defers a snooze across quiet hours without changing an allowed time', () => {
    expect(
      nextAllowedEngagementTime(
        new Date('2026-09-27T20:15:00Z'),
        'Europe/Berlin',
        settings
      ).toISOString()
    ).toBe('2026-09-28T06:00:00.000Z');
    expect(
      nextAllowedEngagementTime(
        new Date('2026-09-27T15:15:00Z'),
        'Europe/Berlin',
        settings
      ).toISOString()
    ).toBe('2026-09-27T15:15:00.000Z');
  });
});
