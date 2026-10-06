import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { EffectiveGoalPreference } from '../services/nutrientGoalPreferenceService.js';

const fixture = vi.hoisted(() => ({
  directions: vi.fn<() => Promise<Record<string, EffectiveGoalPreference>>>(),
}));
vi.mock('../models/goalRepository.js', () => ({
  readStoredGoal: vi.fn(async () => ({ calories: 2000 })),
}));
vi.mock('../services/goalService.js', () => ({
  default: { getUserGoals: vi.fn(async () => ({ calories: 2000 })) },
}));
vi.mock('../services/nutrientGoalPreferenceService.js', () => ({
  default: { getEffectiveGoalTypes: fixture.directions },
}));
vi.mock('../models/foodMisc.js', () => ({
  getFoodDerivedWaterMlForDate: vi.fn(async () => 0),
}));
vi.mock('../utils/timezoneLoader.js', () => ({
  loadUserTimezone: vi.fn(async () => 'Europe/Berlin'),
}));

import { collectCoachingEvidence } from '../services/coachingEvidenceService.js';
import { collectReviewEvidence } from '../services/coachingCalendarEvidence.js';

describe('JSON-safe coaching goal evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.directions.mockResolvedValue({
      calories: {
        goalType: 'maximum',
        targetMin: undefined,
        targetMax: undefined,
      },
      protein: {
        goalType: 'minimum',
        targetMin: undefined,
        targetMax: undefined,
      },
      carbs: { goalType: 'target', targetMin: 0, targetMax: 265 },
    });
  });
  const client = () =>
    ({ query: vi.fn(async () => ({ rows: [] })) }) as unknown as PoolClient;

  it.each([
    ['daily', '2026-10-05', '2026-10-05'],
    ['weekly', '2026-09-28', '2026-10-04'],
  ])(
    'collects %s evidence when saved direction overrides have no bounds',
    async (_kind, from, to) => {
      const result = await collectCoachingEvidence(
        client(),
        'synthetic-owner',
        ['nutrition'],
        from,
        to
      );
      const goal = result.rows.find((row) => row.kind === 'goals');
      const value = z
        .object({
          directions: z.record(
            z.string(),
            z.object({
              goalType: z.enum(['minimum', 'maximum', 'target']),
              targetMin: z.number().optional(),
              targetMax: z.number().optional(),
            })
          ),
        })
        .parse(goal?.value);
      expect(value.directions).toEqual({
        calories: { goalType: 'maximum' },
        protein: { goalType: 'minimum' },
        carbs: { goalType: 'target', targetMin: 0, targetMax: 265 },
      });
      expect(z.json().parse(result)).toEqual(
        JSON.parse(JSON.stringify(result))
      );
      const original = await fixture.directions();
      expect(original).toMatchObject({
        calories: { targetMin: undefined, targetMax: undefined },
      });
      expect(Object.hasOwn(original.calories, 'targetMin')).toBe(true);
      expect(Object.hasOwn(original.calories, 'targetMax')).toBe(true);
    }
  );
  it('keeps monthly aggregation independent of daily goal-direction evidence', async () => {
    const result = await collectReviewEvidence(
      client(),
      'synthetic-owner',
      ['nutrition'],
      [],
      '2026-09-01',
      '2026-09-30',
      true
    );
    expect(z.json().safeParse(result).success).toBe(true);
    expect(fixture.directions).not.toHaveBeenCalled();
  });
});
