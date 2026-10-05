import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  coachingDomainSchema,
  type CoachingSettingsV2 as Settings,
  coachingCadenceSchema,
  coachingContextPermissionSchema,
  type CoachingDomain,
} from '@workspace/shared';
import {
  useCoachingSettings,
  useCoachingActions,
  useCoachingContext,
  useCoachingRefresh,
} from '@/hooks/Coaching/useCoaching';
import { CloudSetup } from './CloudSetup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlowCard } from '@/components/ui/glow-card';

export function CoachingSettings() {
  const { t, i18n } = useTranslation(),
    query = useCoachingSettings(),
    refresh = useCoachingRefresh();
  const [draft, setDraft] = useState<Settings | null>(null),
    [name, setName] = useState(''),
    [oauthClientId, setOauthClientId] = useState(''),
    [domains, setDomains] = useState<CoachingDomain[]>([
      ...coachingDomainSchema.options,
    ]),
    [key, setKey] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const {
    addCoachingAgent,
    issueCoachingKey,
    revokeCoachingAgent,
    saveCoachingSettings,
  } = useCoachingActions();
  const context = useCoachingContext();
  const settings = draft ?? query.data?.settings;
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await work();
      await refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  if (!settings) return null;
  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-destructive">
          {t('coaching.error', {
            defaultValue: 'Could not save. Refresh and try again.',
          })}
        </p>
      )}
      <GlowCard className="space-y-4 p-5">
        <h2 className="text-xl font-semibold">
          {t('coaching.schedule', { defaultValue: 'Review schedule' })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('coaching.timezone', {
            defaultValue: 'Times use your account timezone: {{timezone}}',
            timezone: query.data?.timezone,
          })}
        </p>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) =>
              setDraft({ ...settings, enabled: event.target.checked })
            }
          />
          {t('coaching.enabled', { defaultValue: 'Enable periodic reviews' })}
        </label>
        <p className="text-sm text-muted-foreground">
          {t('coaching.pauseHint', {
            defaultValue:
              'Pausing stops new agent runs. Accepted actions remain available for you to manage.',
          })}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reviewTime">
              {t('coachingLoop.reviewTime', {
                defaultValue: 'Daily cloud task (24-hour)',
              })}
            </Label>
            <Input
              id="reviewTime"
              type="time"
              value={settings.reviewTime}
              onChange={(event) =>
                setDraft({ ...settings, reviewTime: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="digestTime">
              {t('coaching.digestTime', { defaultValue: 'Daily digest' })}
            </Label>
            <Input
              id="digestTime"
              type="time"
              value={settings.digestTime}
              onChange={(event) =>
                setDraft({ ...settings, digestTime: event.target.value })
              }
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('coachingLoop.calendarHint', {
            defaultValue:
              'Daily: yesterday. Monday: the previous week. First of the month: the previous month. January 1: the previous year. Missed periods coalesce to the latest period for each cadence.',
          })}
        </p>
        <div className="flex flex-wrap gap-x-6">
          {coachingCadenceSchema.options.map((cadence) => (
            <label key={cadence} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={settings.cadences.includes(cadence)}
                onChange={(event) =>
                  setDraft({
                    ...settings,
                    cadences: event.target.checked
                      ? [...settings.cadences, cadence]
                      : settings.cadences.filter((item) => item !== cadence),
                  })
                }
              />
              {t(`coaching.options.${cadence}`, { defaultValue: cadence })}
            </label>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={settings.digestEnabled}
            onChange={(event) =>
              setDraft({ ...settings, digestEnabled: event.target.checked })
            }
          />
          {t('coaching.digestEnabled', {
            defaultValue: 'Notify me when recommendations are waiting',
          })}
        </label>
        <p className="text-sm text-muted-foreground">
          {t('coaching.digestHint', {
            defaultValue:
              'At most one digest each day. Remote notifications must be enabled on a supported phone; quiet hours and your shared daily limit apply.',
          })}
        </p>
        <fieldset>
          <legend className="mb-2 font-medium">
            {t('coaching.dataAccess', {
              defaultValue: 'Data available for review',
            })}
          </legend>
          <div className="flex flex-wrap gap-x-6">
            {coachingDomainSchema.options.map((domain) => (
              <label key={domain} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.domains.includes(domain)}
                  onChange={(event) =>
                    setDraft({
                      ...settings,
                      domains: event.target.checked
                        ? [...settings.domains, domain]
                        : settings.domains.filter((item) => item !== domain),
                    })
                  }
                />
                {t(`coaching.domains.${domain}`, { defaultValue: domain })}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-sm text-muted-foreground">
          {t('coachingLoop.optionalContext', {
            defaultValue:
              'Optional context is shared only when enabled here and in the connection. Medications and dose changes are excluded. Supplement history requires Nutrition; reminder history requires Habits.',
          })}
        </p>
        <div className="flex flex-wrap gap-x-6">
          {coachingContextPermissionSchema.options.map((permission) => (
            <label
              key={permission}
              className="flex min-h-11 items-center gap-2"
            >
              <input
                type="checkbox"
                checked={settings.contextPermissions.includes(permission)}
                onChange={(event) =>
                  setDraft({
                    ...settings,
                    contextPermissions: event.target.checked
                      ? [...settings.contextPermissions, permission]
                      : settings.contextPermissions.filter(
                          (item) => item !== permission
                        ),
                  })
                }
              />
              {t(`coachingLoop.${permission}`, { defaultValue: permission })}
            </label>
          ))}
        </div>
        <Button
          disabled={
            busy || !settings.domains.length || !settings.cadences.length
          }
          onClick={() =>
            run(async () => {
              const { revision, ...body } = settings;
              await saveCoachingSettings({
                ...body,
                expectedRevision: revision,
              });
              setDraft(null);
            })
          }
        >
          {t('coaching.save', { defaultValue: 'Save schedule' })}
        </Button>
      </GlowCard>
      <CloudSetup
        settings={query.data?.settings ?? settings}
        timezone={query.data?.timezone ?? 'UTC'}
      />
      <GlowCard className="space-y-4 p-5">
        <h2 className="text-xl font-semibold">
          {t('coaching.connections', { defaultValue: 'Agent connections' })}
        </h2>
        <p>
          {t('coaching.connectionHint', {
            defaultValue:
              'Each connection reads only the selected wellness areas and submits proposals. Review and activation stay in your app account.',
          })}
        </p>
        {query.data?.agents.map((agent) => (
          <div
            key={agent.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          >
            <div>
              <h3 className="font-semibold">{agent.name}</h3>
              <p className="text-sm text-muted-foreground">
                {agent.enabled
                  ? t('coaching.connected', { defaultValue: 'Connected' })
                  : t('coaching.revoked', { defaultValue: 'Revoked' })}{' '}
                · {agent.credentialKind} ·{' '}
                {agent.domains
                  .map((d) => t(`coaching.domains.${d}`, { defaultValue: d }))
                  .join(', ')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('coachingLoop.connectionContext', {
                  defaultValue: 'Additional connection context',
                })}
                :{' '}
                {agent.contextPermissions
                  .map((permission) =>
                    t(`coachingLoop.${permission}`, {
                      defaultValue: permission,
                    })
                  )
                  .join(', ') || '—'}
              </p>
              <p className="text-sm">
                {t('coaching.lastSeen', { defaultValue: 'Last contact' })}:{' '}
                {agent.lastSeenAt
                  ? new Date(agent.lastSeenAt).toLocaleString(i18n.language, {
                      hour12: false,
                      timeZone: query.data?.timezone,
                    })
                  : '—'}
              </p>
              {agent.expiresAt && (
                <p className="text-sm">
                  {t('coaching.expires', { defaultValue: 'Expires' })}:{' '}
                  {new Date(agent.expiresAt).toLocaleDateString(i18n.language)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {agent.enabled && agent.credentialKind === 'api_key' && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(async () =>
                      setKey((await issueCoachingKey(agent.id)).key)
                    )
                  }
                >
                  {t('coaching.issueKey', {
                    defaultValue: 'Issue or replace key',
                  })}
                </Button>
              )}
              {agent.enabled && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(() => revokeCoachingAgent(agent.id))}
                >
                  {t('coaching.revoke', { defaultValue: 'Revoke connection' })}
                </Button>
              )}
            </div>
          </div>
        ))}
        {key && (
          <section
            className="space-y-3 rounded-xl border border-primary p-4"
            aria-live="polite"
          >
            <p>
              {t('coaching.keyOnce', {
                defaultValue:
                  'Save this key now. It is shown once and expires in 90 days. Use it in the Mac runner configuration.',
              })}
            </p>
            <textarea
              className="min-h-24 w-full break-all rounded-md border bg-background p-3"
              readOnly
              value={key}
              aria-label={t('coaching.key', { defaultValue: 'Agent API key' })}
            />
            <Button
              variant="outline"
              onClick={() => {
                setKey(null);
              }}
            >
              {t('coaching.hideKey', { defaultValue: 'I saved the key' })}
            </Button>
          </section>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="agent-name">
              {t('coaching.agentName', { defaultValue: 'Connection name' })}
            </Label>
            <Input
              id="agent-name"
              value={name}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-oauth">
              {t('coaching.oauthId', {
                defaultValue: 'OAuth client ID (optional)',
              })}
            </Label>
            <Input
              id="agent-oauth"
              value={oauthClientId}
              onChange={(event) => setOauthClientId(event.target.value)}
            />
          </div>
        </div>
        <fieldset>
          <legend className="font-medium">
            {t('coaching.agentAccess', {
              defaultValue: 'Access for this connection',
            })}
          </legend>
          <div className="flex flex-wrap gap-x-6">
            {coachingDomainSchema.options.map((domain) => (
              <label key={domain} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={domains.includes(domain)}
                  onChange={(event) =>
                    setDomains(
                      event.target.checked
                        ? [...domains, domain]
                        : domains.filter((item) => item !== domain)
                    )
                  }
                />
                {t(`coaching.domains.${domain}`, { defaultValue: domain })}
              </label>
            ))}
          </div>
        </fieldset>
        <Button
          disabled={busy || !name.trim() || !domains.length}
          onClick={() =>
            run(async () => {
              await addCoachingAgent({
                name,
                domains,
                protocolVersion: 2,
                contextPermissions: settings.contextPermissions,
                ...(oauthClientId.trim()
                  ? { oauthClientId: oauthClientId.trim() }
                  : {}),
              });
              setName('');
              setOauthClientId('');
            })
          }
        >
          {t('coaching.addAgent', { defaultValue: 'Add connection' })}
        </Button>
      </GlowCard>
      <GlowCard className="space-y-4 p-5">
        <h2 className="text-xl font-semibold">
          {t('coaching.status', { defaultValue: 'Recent reviews' })}
        </h2>
        {context.isError && (
          <p role="alert">
            {t('coaching.statusError', {
              defaultValue: 'Review status is unavailable.',
            })}
          </p>
        )}
        {context.data?.runs.map((run) => (
          <div
            key={run.id}
            className="flex flex-wrap justify-between gap-2 border-b py-3"
          >
            <span>
              {run.from} – {run.to} ·{' '}
              {t(`coaching.options.${run.kind}`, { defaultValue: run.kind })}
            </span>
            <span>
              {t(`coaching.options.${run.status}`, {
                defaultValue: run.status,
              })}
              {run.failureCode
                ? ` · ${t(`coaching.options.${run.failureCode}`, { defaultValue: run.failureCode })}`
                : ''}
            </span>
          </div>
        ))}
        {!context.isPending && !context.data?.runs.length && (
          <p>
            {t('coaching.noRuns', {
              defaultValue:
                'No reviews have run yet. Test the connected ChatGPT review, then verify an unattended cloud run.',
            })}
          </p>
        )}
      </GlowCard>
    </div>
  );
}
