import i18n, { initializeI18n } from '../../src/localization/i18n';
import {
  groupSupplementReminders,
  supplementGroupMembers,
  type IntakeReminderPlan,
} from '../../src/services/supplementReminderGroups';

function plan(
  id: string,
  overrides: Record<string, string> = {},
  time = new Date(2026, 9, 4, 9)
): IntakeReminderPlan {
  return {
    body: `Your planned supplement: ${id}`,
    itemLabel: id,
    triggerDate: time,
    data: {
      key: `med_2026-10-04_${id}_s1_09:00`,
      entryDate: '2026-10-04',
      isSupplement: 'true',
      accountUserId: 'user-1',
      serverConfigId: 'server-1',
      hideNames: 'false',
      ...overrides,
    },
  };
}
beforeAll(async () => {
  await initializeI18n('en');
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});

it.each([
  { isSupplement: 'false' },
  { accountUserId: 'other' },
  { serverConfigId: 'other' },
  { entryDate: '2026-10-05' },
])(
  'never combines unrelated ownership, intake day or medication classification: %j',
  (overrides) => {
    const plans = [plan('a'), plan('b', overrides)];
    expect(groupSupplementReminders(plans)).toEqual(plans);
  }
);
it('uses an exact instant without a rounding window', () => {
  const plans = [plan('a'), plan('b', {}, new Date(2026, 9, 4, 9, 0, 1))];
  expect(groupSupplementReminders(plans)).toEqual(plans);
});
it('groups three items while leaving medication rows in their existing position', () => {
  const medication = plan('rx', { isSupplement: 'false' });
  const grouped = groupSupplementReminders([
    plan('c'),
    medication,
    plan('a'),
    plan('b'),
  ]);
  expect(grouped).toHaveLength(2);
  expect(grouped[1]).toBe(medication);
  expect(grouped[0].data.count).toBe('3');
  expect(supplementGroupMembers(grouped[0].data)).toEqual(
    ['a', 'b', 'c'].map((id) => plan(id).data.key)
  );
});
it('preserves literal names, escapes no copy into payloads, and uses informal German follow-up copy', async () => {
  await i18n.changeLanguage('de');
  const grouped = groupSupplementReminders([
    plan('B12 & Folate', { repeatNumber: '1' }),
    plan('Zink', { repeatNumber: '1' }),
  ])[0];
  expect(grouped.body).toBe(
    'Schon erfasst? Prüfe B12 & Folate, Zink in deiner Supplement-Liste.'
  );
  expect(grouped.data.followUp).toBe('true');
});
it.each([
  undefined,
  {},
  { supplementGroupVersion: '1', memberKeys: '{}' },
  { supplementGroupVersion: '1', memberKeys: '["med_a"]' },
  { supplementGroupVersion: '1', memberKeys: '["med_a","med_a"]' },
  { supplementGroupVersion: '1', memberKeys: '["med_a",1]' },
])('rejects malformed membership: %j', (data) => {
  expect(supplementGroupMembers(data)).toBeNull();
});
