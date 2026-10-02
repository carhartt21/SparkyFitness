import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  coachingDomainSchema,
  type CoachingSettings as Settings,
  type CoachingDomain,
} from '@workspace/shared';
import {
  useCoachingSettings,
  useCoachingActions,
  useCoachingContext,
  useCoachingRefresh,
} from '@/hooks/Coaching/useCoaching';
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            ['morningTime', 'eveningTime', 'weeklyTime', 'digestTime'] as const
          ).map((field) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={field}>
                {t(`coaching.${field}`, {
                  defaultValue:
                    field === 'morningTime'
                      ? 'Morning review'
                      : field === 'eveningTime'
                        ? 'Evening review'
                        : field === 'weeklyTime'
                          ? 'Weekly review'
                          : 'Daily digest',
                })}
              </Label>
              <Input
                id={field}
                type="time"
                value={settings[field]}
                onChange={(event) =>
                  setDraft({ ...settings, [field]: event.target.value })
                }
              />
            </div>
          ))}
        </div>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="weeklyDay">
            {t('coaching.weeklyDay', { defaultValue: 'Weekly review day' })}
          </Label>
          <select
            id="weeklyDay"
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={settings.weeklyDay}
            onChange={(event) =>
              setDraft({ ...settings, weeklyDay: Number(event.target.value) })
            }
          >
            {Array.from({ length: 7 }, (_, day) => (
              <option key={day} value={day}>
                {new Intl.DateTimeFormat(i18n.language, {
                  weekday: 'long',
                  timeZone: 'UTC',
                }).format(new Date(Date.UTC(2026, 8, 27 + day)))}
              </option>
            ))}
          </select>
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
        <Button
          disabled={busy || !settings.domains.length}
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
              <p className="text-sm">
                {t('coaching.lastSeen', { defaultValue: 'Last contact' })}:{' '}
                {agent.lastSeenAt
                  ? new Date(agent.lastSeenAt).toLocaleString(i18n.language)
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
                'No reviews have run yet. Keep the Mac runner signed in and running.',
            })}
          </p>
        )}
      </GlowCard>
    </div>
  );
}
