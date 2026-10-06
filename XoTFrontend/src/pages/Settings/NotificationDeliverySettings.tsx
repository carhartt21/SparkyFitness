import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Input, TimeCommitInput } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  engagementStatusSchema,
  type EngagementStatus,
} from '@workspace/shared';
import { Bell } from 'lucide-react';
import {
  engagementSettingsV2Schema,
  type EngagementSettingsV2,
  type EngagementSettingsPatchV2,
} from '@workspace/shared';
import { AccordionContent, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useEngagementApi } from '@/hooks/Engagement/useEngagementApi';

type BooleanKey = Extract<
  keyof EngagementSettingsV2,
  | 'remote_enabled'
  | 'hydration_enabled'
  | 'meal_capture_enabled'
  | 'meal_review_enabled'
  | 'movement_break_enabled'
  | 'mobility_enabled'
>;

export default function NotificationDeliverySettings() {
  const {
    fetchEngagementSettings,
    patchEngagementSettings,
    fetchEngagementStatus,
  } = useEngagementApi();
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<EngagementSettingsV2 | null>(null);
  const [status, setStatus] = useState<EngagementStatus | null>(null);
  const [limitText, setLimitText] = useState('3');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetchEngagementStatus();
      if (!response.ok) throw new Error('Unavailable');
      setStatus(engagementStatusSchema.parse(await response.json()));
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  }, [fetchEngagementStatus]);
  useEffect(() => {
    let mounted = true;
    void fetchEngagementSettings()
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Notification settings could not be loaded.');
        return engagementSettingsV2Schema.parse(await response.json());
      })
      .then((value) => {
        if (mounted) {
          setSettings(value);
          setLimitText(String(value.daily_limit ?? 3));
        }
        void fetchEngagementStatus()
          .then(async (response) => {
            if (response.ok && mounted)
              setStatus(engagementStatusSchema.parse(await response.json()));
          })
          .catch(() => {
            if (mounted) setStatusError(true);
          });
      })
      .catch(() => {
        if (mounted)
          setError(
            t(
              'settings.notificationDelivery.loadFailed',
              'Notification settings could not be loaded.'
            )
          );
      });
    return () => {
      mounted = false;
    };
  }, [t, fetchEngagementSettings, fetchEngagementStatus]);

  async function update(
    patch: Omit<EngagementSettingsPatchV2, 'expected_revision'>
  ): Promise<void> {
    if (!settings || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await patchEngagementSettings({
        ...patch,
        expected_revision: settings.revision,
      });
      if (!response.ok)
        throw new Error(
          'Settings changed elsewhere or could not be saved. Reload this section and try again.'
        );
      setSettings(engagementSettingsV2Schema.parse(await response.json()));
      await refreshStatus();
    } catch {
      setError(
        t('settings.notificationDelivery.saveFailed', {
          defaultValue:
            'Not saved. Reload this section and try again; settings may have changed elsewhere.',
        })
      );
    } finally {
      setBusy(false);
    }
  }

  const rows: Array<{ key: BooleanKey; label: string }> = [
    {
      key: 'hydration_enabled',
      label: t('settings.notificationDelivery.hydration', 'Hydration check-in'),
    },
    {
      key: 'meal_capture_enabled',
      label: t('settings.notificationDelivery.mealCapture', 'Meal check-in'),
    },
    {
      key: 'meal_review_enabled',
      label: t('settings.notificationDelivery.mealReview', 'Meal photo review'),
    },
    {
      key: 'movement_break_enabled',
      label: t('settings.notificationDelivery.movement', 'Movement break'),
    },
    {
      key: 'mobility_enabled',
      label: t('settings.notificationDelivery.mobility', 'Guided mobility'),
    },
  ];

  return (
    <>
      <AccordionTrigger
        className="p-4 hover:no-underline"
        description={t(
          'settings.notificationDelivery.description',
          'Set quiet hours and the reminders that can reach your phone when the app is closed.'
        )}
      >
        <span className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
          {t('settings.notificationDelivery.title', 'Notification delivery')}
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-5 p-4 pt-0">
        <p className="text-sm text-muted-foreground">
          {t(
            'settings.notificationDelivery.deviceNote',
            'Turn on remote reminders in the iPhone app first. It removes locally scheduled alerts before switching delivery to the server. You can then manage reminders here even while the app is closed.'
          )}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!settings ? (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {t('common.loading', 'Loading...')}
          </p>
        ) : (
          <>
            <div className="flex min-h-11 items-center justify-between gap-4 border-b pb-3">
              <Label htmlFor="remote-notifications">
                {t(
                  'settings.notificationDelivery.remote',
                  'Server delivery for this account'
                )}
              </Label>
              <Switch
                id="remote-notifications"
                checked={settings.remote_enabled}
                disabled={busy || !settings.remote_enabled}
                onCheckedChange={(value) =>
                  void update({ remote_enabled: value })
                }
              />
            </div>
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex min-h-11 items-center justify-between gap-4"
              >
                <Label htmlFor={`remote-${row.key}`}>{row.label}</Label>
                <Switch
                  id={`remote-${row.key}`}
                  checked={settings[row.key]}
                  disabled={busy}
                  onCheckedChange={(value) => void update({ [row.key]: value })}
                />
              </div>
            ))}
            <section className="space-y-3 border-t pt-4">
              <Label htmlFor="optional-cap">
                {t('settings.notificationDelivery.dailyLimit', {
                  defaultValue: 'Optional reminders per day (1–50)',
                })}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.notificationDelivery.capDescription', {
                  defaultValue:
                    'Check-in, habits, weigh-in, meal, movement, mobility and hydration share this quota. No limit still respects quiet hours, cadence and 20-minute spacing. Intake and timer alerts stay on each device.',
                })}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id="optional-cap"
                  type="number"
                  min={1}
                  max={50}
                  value={limitText}
                  className="w-24"
                  disabled={busy}
                  onChange={(event) => setLimitText(event.target.value)}
                />
                <Button
                  disabled={busy}
                  onClick={() => {
                    const value = Number(limitText);
                    if (Number.isInteger(value) && value >= 1 && value <= 50)
                      void update({ daily_limit: value });
                    else
                      setError(
                        t('settings.notificationDelivery.capInvalid', {
                          defaultValue: 'Use a whole number from 1 to 50.',
                        })
                      );
                  }}
                >
                  {t('settings.notificationDelivery.apply', {
                    defaultValue: 'Apply limit',
                  })}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void update({ daily_limit: null })}
                >
                  {t('settings.notificationDelivery.noLimit', {
                    defaultValue: 'No limit',
                  })}
                </Button>
              </div>
              <p className="text-sm">
                {t('settings.notificationDelivery.currentLimit', {
                  defaultValue: 'Current limit: {{limit}}',
                  limit:
                    settings.daily_limit === null
                      ? t('settings.notificationDelivery.noLimit', {
                          defaultValue: 'No limit',
                        })
                      : settings.daily_limit,
                })}
              </p>
            </section>
            <fieldset
              disabled={busy}
              className="grid gap-4 border-t pt-4 sm:grid-cols-2"
            >
              <legend className="font-medium">
                {t('settings.notificationDelivery.schedules', {
                  defaultValue: 'Optional schedules',
                })}
              </legend>
              {(
                [
                  'hydration_start',
                  'hydration_end',
                  'meal_capture_start',
                  'meal_capture_end',
                  'meal_capture_time',
                  'meal_review_time',
                  'movement_break_time',
                ] as const
              ).map((key) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`schedule-${key}`}>
                    {t(`settings.notificationDelivery.time.${key}`)}
                  </Label>
                  <TimeCommitInput
                    id={`schedule-${key}`}
                    value={settings[key]}
                    onCommit={(value) => void update({ [key]: value })}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="water-interval">
                  {t('settings.notificationDelivery.waterInterval', {
                    defaultValue: 'Hours after the last drink',
                  })}
                </Label>
                <Input
                  id="water-interval"
                  type="number"
                  min={1}
                  max={12}
                  value={settings.hydration_interval_hours}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (value >= 1 && value <= 12)
                      void update({ hydration_interval_hours: value });
                  }}
                />
              </div>
            </fieldset>
            <p className="text-sm text-muted-foreground">
              {t('settings.notificationDelivery.trackingNote', {
                defaultValue:
                  'Existing tracking preferences remain authoritative for check-in, habits and weigh-in.',
              })}{' '}
              <Link className="underline underline-offset-4" to="/checkin">
                {t('settings.notificationDelivery.trackingLink', {
                  defaultValue: 'Open check-in',
                })}
              </Link>{' '}
              ·{' '}
              <Link className="underline underline-offset-4" to="/mobility">
                {t('settings.notificationDelivery.mobilityLink', {
                  defaultValue: 'Plan mobility',
                })}
              </Link>
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void refreshStatus()}
            >
              {t('settings.notificationDelivery.refreshStatus', {
                defaultValue: 'Refresh delivery status',
              })}
            </Button>
            {statusError && (
              <p role="alert">
                {t('settings.notificationDelivery.statusUnavailable', {
                  defaultValue:
                    'Delivery status is unavailable. Your saved settings remain unchanged; try refreshing.',
                })}
              </p>
            )}
            {status && (
              <details className="rounded-xl border p-4">
                <summary className="min-h-11 cursor-pointer font-medium">
                  {t('settings.notificationDelivery.status', {
                    defaultValue: 'Delivery status · last 7 days',
                  })}
                </summary>
                <p className="my-3 text-sm text-muted-foreground">
                  {t('settings.notificationDelivery.statusNote', {
                    defaultValue:
                      'Scheduled means reserved. Accepted means Expo accepted the push; a receipt confirms the push service result, not that it was seen. Failed or unknown sends are not replayed automatically.',
                  })}
                </p>
                <ul className="divide-y">
                  {status.occurrences.slice(0, 12).map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap justify-between gap-2 py-3"
                    >
                      <span>
                        {t(`settings.notificationDelivery.kind.${item.kind}`)}
                      </span>
                      <time dateTime={item.scheduled_at}>
                        {new Intl.DateTimeFormat(i18n.language, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          hourCycle: 'h23',
                        }).format(new Date(item.scheduled_at))}
                      </time>
                      <span>
                        {t(
                          `settings.notificationDelivery.state.${item.deliveries[0]?.status ?? item.status}`
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <fieldset
              className="flex flex-wrap gap-4 border-t pt-4"
              disabled={busy}
            >
              <legend className="mb-2 text-sm font-medium">
                {t('settings.notificationDelivery.quietHours', 'Quiet hours')}
              </legend>
              <div className="space-y-1">
                <Label htmlFor="quiet-start">
                  {t('settings.notificationDelivery.from', 'From')}
                </Label>
                <TimeCommitInput
                  id="quiet-start"
                  className="block rounded-md border bg-background px-3 py-2"
                  value={settings.quiet_start}
                  onCommit={(value) => void update({ quiet_start: value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quiet-end">
                  {t('settings.notificationDelivery.until', 'Until')}
                </Label>
                <TimeCommitInput
                  id="quiet-end"
                  className="block rounded-md border bg-background px-3 py-2"
                  value={settings.quiet_end}
                  onCommit={(value) => void update({ quiet_end: value })}
                />
              </div>
            </fieldset>
          </>
        )}
      </AccordionContent>
    </>
  );
}
