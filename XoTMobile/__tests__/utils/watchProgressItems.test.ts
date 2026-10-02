import { buildWatchProgressItems } from '../../src/utils/watchProgressItems';
import {
  plannedActivityLabel,
  progressActivityLabel,
} from '../../src/components/tracking/trackingLabels';
import type { DailyProgressItem, Habit } from '@workspace/shared';
import { createInstance } from 'i18next';
import de from '../../src/localization/locales/de/translation.json';
const row = (domain: DailyProgressItem['domain']): DailyProgressItem => ({
  id: domain,
  domain,
  label: 'Synthetic name',
  date: '2026-10-02',
  state: 'pending',
  applicable: true,
  reference_id: 'ref',
  recorded_at: null,
  reason: 'not_recorded',
});
it('localizes machine activity types while leaving personal names literal and blocks richer completion', async () => {
  const i18n = createInstance();
  await i18n.init({ lng: 'de', resources: { de: { translation: de } } });
  expect(plannedActivityLabel(i18n.t, 'running')).toBe('Laufen');
  expect(progressActivityLabel(i18n.t, 'Sunday long run', 'running')).toBe(
    'Sunday long run'
  );
  expect(
    buildWatchProgressItems(
      [
        {
          ...row('activity'),
          label: 'Sunday long run',
          activity_type: 'running',
        },
      ],
      [],
      [],
      i18n.t
    )[0].label
  ).toBe('Sunday long run');
  const items = buildWatchProgressItems(
    [
      row('habit'),
      row('meal'),
      { ...row('activity'), activity_type: 'running', label: 'running' },
      row('supplement'),
      { ...row('workout'), state: 'complete' },
    ],
    [{ id: 'ref', habit_type: 'completion', active: true } as Habit],
    [{ id: 'ref', name: 'Frühstück' }],
    i18n.t
  );
  expect(items.map((item) => item.label)).toEqual([
    'Synthetic name',
    'Frühstück',
    'Laufen',
    'Synthetic name',
  ]);
  expect(items.map((item) => item.canComplete)).toEqual([
    true,
    true,
    false,
    false,
  ]);
  expect(
    buildWatchProgressItems(
      [row('habit')],
      [{ id: 'ref', habit_type: 'count', active: true } as Habit],
      [],
      i18n.t
    )[0].canComplete
  ).toBe(false);
});
