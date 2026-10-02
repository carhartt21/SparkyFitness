import type { DailyProgressDomain, DailyProgressItem } from '@workspace/shared';
import type { IconName } from '../components/Icon';
export const PROGRESS_CATEGORY_ICONS: Record<DailyProgressDomain, IconName> = {
  habit: 'habit',
  measurement: 'scale',
  supplement: 'medication',
  meal: 'meal',
  goal: 'target',
  workout: 'exercise-weights',
  activity: 'exercise-running',
  checkin: 'daily-checkin',
};
export const PROGRESS_DOMAIN_ORDER: DailyProgressDomain[] = [
  'habit',
  'measurement',
  'supplement',
  'meal',
  'goal',
  'workout',
  'activity',
  'checkin',
];
export type ProgressCategoryState =
  'open' | 'partial' | 'complete' | 'skipped' | 'optional' | 'unknown';
export function progressCategories(items: readonly DailyProgressItem[]) {
  return PROGRESS_DOMAIN_ORDER.flatMap((domain) => {
    const rows = items.filter((item) => item.domain === domain);
    if (!rows.length) return [];
    const unresolved = rows.filter(
      (item) => item.state === 'pending' || item.state === 'started'
    ).length;
    const completed = rows.filter((item) => item.state === 'complete').length;
    const state: ProgressCategoryState = unresolved
      ? rows.every((item) => !item.applicable)
        ? rows.every((item) => item.optional)
          ? 'optional'
          : 'unknown'
        : completed || rows.some((item) => item.state === 'started')
          ? 'partial'
          : 'open'
      : completed
        ? 'complete'
        : 'skipped';
    return [{ domain, state, unresolved, completed, total: rows.length }];
  }).sort((a, b) => Number(b.unresolved > 0) - Number(a.unresolved > 0));
}
