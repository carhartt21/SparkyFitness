import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import {
  engagementSettingsSchema,
  type EngagementSettings,
  type EngagementSettingsPatch,
} from '@workspace/shared';
import { AccordionContent, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useEngagementApi } from '@/hooks/Engagement/useEngagementApi';

type BooleanKey = Extract<
  keyof EngagementSettings,
  | 'remote_enabled'
  | 'hydration_enabled'
  | 'meal_capture_enabled'
  | 'meal_review_enabled'
  | 'movement_break_enabled'
  | 'mobility_enabled'
>;

export default function NotificationDeliverySettings() {
  const { fetchEngagementSettings, patchEngagementSettings } =
    useEngagementApi();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<EngagementSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    void fetchEngagementSettings()
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Notification settings could not be loaded.');
        return engagementSettingsSchema.parse(await response.json());
      })
      .then((value) => {
        if (mounted) setSettings(value);
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
  }, [t, fetchEngagementSettings]);

  async function update(
    patch: Omit<EngagementSettingsPatch, 'expected_revision'>
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
      setSettings(engagementSettingsSchema.parse(await response.json()));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Notification settings could not be saved.'
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
            {t('common.loading', 'Loading…')}
          </p>
        ) : (
          <>
            <div className="flex min-h-11 items-center justify-between gap-4 border-b pb-3">
              <Label htmlFor="remote-notifications">
                {t(
                  'settings.notificationDelivery.remote',
                  'Deliver to my phone'
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
                <input
                  id="quiet-start"
                  type="time"
                  className="block rounded-md border bg-background px-3 py-2"
                  value={settings.quiet_start}
                  onChange={(event) =>
                    void update({ quiet_start: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quiet-end">
                  {t('settings.notificationDelivery.until', 'Until')}
                </Label>
                <input
                  id="quiet-end"
                  type="time"
                  className="block rounded-md border bg-background px-3 py-2"
                  value={settings.quiet_end}
                  onChange={(event) =>
                    void update({ quiet_end: event.target.value })
                  }
                />
              </div>
            </fieldset>
          </>
        )}
      </AccordionContent>
    </>
  );
}
