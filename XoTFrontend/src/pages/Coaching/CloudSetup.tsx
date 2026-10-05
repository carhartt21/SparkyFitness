import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  cloudCoachingTaskPrompt,
  type CoachingSettingsV2,
} from '@workspace/shared';
import {
  useCoachingActions,
  useCoachingConnections,
  useCoachingRefresh,
} from '@/hooks/Coaching/useCoaching';
import { GlowCard } from '@/components/ui/glow-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function CloudSetup({
  settings,
  timezone,
}: {
  settings: CoachingSettingsV2;
  timezone: string;
}) {
  const { t, i18n } = useTranslation(),
    api = useCoachingActions(),
    refresh = useCoachingRefresh();
  const [connection, setConnection] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [copied, setCopied] = useState(false);
  const query = useCoachingConnections();
  const prompt = cloudCoachingTaskPrompt(
      settings.reviewTime,
      timezone,
      i18n.language
    ),
    endpoint = window.location.origin + '/mcp/chatgpt';
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError(true);
    }
  };
  return (
    <GlowCard as="section" className="space-y-4 p-5">
      <h2 className="text-xl font-semibold">
        {t('coachingLoop.cloudTitle', {
          defaultValue: 'Connect a cloud review',
        })}
      </h2>
      <ol className="list-decimal space-y-5 pl-5">
        <li className="space-y-3">
          <p>
            {t('coachingLoop.cloudStep1', {
              defaultValue:
                'In ChatGPT, connect X on Track using this MCP address and allow reading and proposals.',
            })}
          </p>
          <code className="block break-all rounded-xl border p-3 text-sm">
            {endpoint}
          </code>
          <Button variant="outline" onClick={() => copy(endpoint)}>
            {t('coachingLoop.copyAddress', {
              defaultValue: 'Copy MCP address',
            })}
          </Button>
        </li>
        <li className="space-y-3">
          <p>
            {t('coachingLoop.cloudStep2', {
              defaultValue:
                'Refresh this list and choose the authorized connection. The selected data below is all it can review; it cannot approve changes.',
            })}
          </p>
          {query.isError && (
            <p role="alert">
              {t('coachingLoop.connectionsError', {
                defaultValue:
                  'Connections are unavailable. Check server OAuth configuration and refresh.',
              })}
            </p>
          )}
          <Label htmlFor="coaching-cloud-connection">
            {t('coachingLoop.chooseConnection', {
              defaultValue: 'Authorized ChatGPT connection',
            })}
          </Label>
          <select
            id="coaching-cloud-connection"
            className="min-h-11 w-full max-w-lg rounded-md border bg-background px-3"
            value={connection}
            onChange={(event) => setConnection(event.target.value)}
          >
            <option value="">
              {t('coachingLoop.chooseConnection', {
                defaultValue: 'Authorized ChatGPT connection',
              })}
            </option>
            {query.data?.connections.map((item) => (
              <option key={item.id} value={item.client_id}>
                {item.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => query.refetch()}>
              {t('coaching.retry', { defaultValue: 'Refresh' })}
            </Button>
            <Button
              disabled={busy || !connection || !settings.domains.length}
              onClick={async () => {
                setBusy(true);
                setError(false);
                try {
                  await api.addCoachingAgent({
                    name:
                      query.data?.connections.find(
                        (item) => item.client_id === connection
                      )?.name ?? 'ChatGPT',
                    domains: settings.domains,
                    oauthClientId: connection,
                    protocolVersion: 2,
                    contextPermissions: settings.contextPermissions,
                  });
                  await refresh();
                } catch {
                  setError(true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('coachingLoop.bindConnection', {
                defaultValue: 'Use for reviewed coaching',
              })}
            </Button>
          </div>
        </li>
        <li className="space-y-3">
          <p>
            {t('coachingLoop.cloudStep3', {
              defaultValue:
                'Test this prompt in a normal ChatGPT conversation using the selected connection. Then create one daily cloud task at the time shown. Scheduling availability depends on your ChatGPT account.',
            })}
          </p>
          <p className="whitespace-pre-wrap break-words rounded-xl border p-4 text-sm text-muted-foreground">
            {prompt}
          </p>
          <Button variant="outline" onClick={() => copy(prompt)}>
            {copied
              ? t('coachingLoop.copied', { defaultValue: 'Copied' })
              : t('coachingLoop.copyPrompt', {
                  defaultValue: 'Copy review prompt',
                })}
          </Button>
        </li>
      </ol>
      <p className="text-sm text-muted-foreground">
        {t('coachingLoop.cloudUnverified', {
          defaultValue:
            'A binding does not confirm a cloud schedule. Verify one unattended run before relying on it. Changing the review time here also requires updating the task in ChatGPT.',
        })}
      </p>
      {error && (
        <p role="alert">
          {t('coaching.error', {
            defaultValue: 'Could not save. Refresh and try again.',
          })}
        </p>
      )}
    </GlowCard>
  );
}
