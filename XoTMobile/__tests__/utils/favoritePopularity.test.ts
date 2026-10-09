import {
  compareFavoritePopularity,
  FavoriteUsageFieldsSchema,
} from '@workspace/shared';
it('ranks actual use, recency, then favorite date and stable id', () => {
  const sorted = [
    { id: 'unused', usage_count_28d: 0, favorited_at: '2026-10-09' },
    { id: 'older', usage_count_28d: 3, last_used_at: '2026-10-07' },
    { id: 'recent', usage_count_28d: 3, last_used_at: '2026-10-08' },
    { id: 'frequent', usage_count_28d: 4, last_used_at: '2026-10-01' },
  ].sort(compareFavoritePopularity);
  expect(sorted.map((item) => item.id)).toEqual([
    'frequent',
    'recent',
    'older',
    'unused',
  ]);
});
it('retains older cached ordering when usage fields and favorite dates are absent', () => {
  expect(
    [{ id: 'z' }, { id: 'a' }]
      .sort(compareFavoritePopularity)
      .map((item) => item.id)
  ).toEqual(['z', 'a']);
  expect(FavoriteUsageFieldsSchema.parse({ id: 'old' })).toEqual({});
  expect(
    FavoriteUsageFieldsSchema.safeParse({ usage_count_28d: -1 }).success
  ).toBe(false);
});
