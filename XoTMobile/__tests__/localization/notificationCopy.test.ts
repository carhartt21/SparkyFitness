import i18n, { initializeI18n } from '../../src/localization/i18n';
import { notificationStatusLabels } from '../../src/localization/notificationStatusLabels';
import english from '../../src/localization/locales/en/translation.json';
import german from '../../src/localization/locales/de/translation.json';
import { engagementReminderKindV2Schema } from '@workspace/shared';
beforeAll(async () => {
  await initializeI18n('en');
});
function text(source: unknown, key: string): string | undefined {
  let value: unknown = source;
  for (const part of key.split('.')) {
    if (typeof value !== 'object' || value === null || !(part in value)) return;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' ? value : undefined;
}
it('covers every notification kind and delivery reason with reviewed German copy', () => {
  const keys = [
    ...engagementReminderKindV2Schema.options.map(
      (kind) => `notificationSettings.kind.${kind}`
    ),
    ...[
      'disabled',
      'paused',
      'data_unavailable',
      'resolved',
      'expired',
      'scheduled',
      'local_delivery',
      'no_device',
      'daily_limit',
      'quiet_hours',
      'spacing',
    ].map((reason) => `notificationSettings.reason.${reason}`),
    ...['enabled', 'disabled', 'unsupported', 'unknown'].map(
      (state) => `widgetGuide.status.${state}`
    ),
  ];
  for (const key of keys) {
    expect(text(english, key)).toBeTruthy();
    expect(text(german, key)).toBeTruthy();
    expect(text(german, key)).not.toMatch(
      /scheduled|reminder|as taken|goal reached/i
    );
  }
});
it('keeps the permission explanation and phone/account distinction explicit', () => {
  expect(german.notificationSettings.allowSubtitle).toMatch(/Andere Geräte/);
  expect(german.notificationSettings.permissionBody).toMatch(/Berechtigung/);
  expect(german.notificationSettings.remoteRemindersSubtitle).toMatch(/Server/);
});

it('resolves explicit delivery labels through the active German locale', async () => {
  await i18n.changeLanguage('de');
  try {
    const labels = notificationStatusLabels(i18n.t.bind(i18n));
    expect(labels.kind.hydration).toBe('Wasser');
    expect(labels.deliveryState.sent).toBe('Push angenommen');
    expect(labels.reason.quiet_hours).toBe('Während der Ruhezeit pausiert.');
  } finally {
    await i18n.changeLanguage('en');
  }
});
