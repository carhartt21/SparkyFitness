import { progressCategories } from '../../src/utils/progressCategories';
import type { DailyProgressItem } from '@workspace/shared';
const row = (
  domain: DailyProgressItem['domain'],
  state: DailyProgressItem['state'] = 'pending',
  applicable = true
): DailyProgressItem => ({
  id: domain,
  domain,
  label: 'Synthetic name',
  date: '2026-10-02',
  state,
  applicable,
  optional: !applicable && state !== 'excluded',
  reference_id: 'ref',
  recorded_at: null,
  reason: 'not_recorded',
});
it('groups individual goals, prioritizes open categories and preserves completed/skipped categories', () => {
  const categories = progressCategories([
    row('habit', 'complete'),
    row('supplement'),
    { ...row('supplement', 'complete'), id: 'dose2' },
    row('meal', 'excluded', false),
    row('checkin'),
    row('activity', 'pending', false),
  ]);
  expect(categories.map((group) => group.domain)).toEqual([
    'supplement',
    'activity',
    'checkin',
    'habit',
    'meal',
  ]);
  expect(categories.map((group) => group.state)).toEqual([
    'partial',
    'optional',
    'open',
    'complete',
    'skipped',
  ]);
  expect(categories[0].total).toBe(2);
});
it('does not label pending optional tasks complete merely because the denominator is zero', () => {
  expect(progressCategories([row('activity', 'pending', false)])[0].state).toBe(
    'optional'
  );
  expect(
    progressCategories([
      { ...row('activity', 'pending', false), optional: false },
    ])[0].state
  ).toBe('unknown');
  expect(progressCategories([])).toEqual([]);
});
