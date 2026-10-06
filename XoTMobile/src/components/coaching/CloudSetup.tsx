import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  cloudCoachingTaskPrompt,
  COACHING_MCP_PATH,
  type CoachingSettingsV2,
} from '@workspace/shared';
import { useCoaching } from '../../hooks/useCoaching';
import { getActiveServerConfig } from '../../services/storage';
import GlowCard from '../ui/GlowCard';
import NeonButton from '../ui/NeonButton';
import BottomSheetPicker from '../BottomSheetPicker';

type Api = ReturnType<typeof useCoaching>['api'];
export default function CloudSetup({
  api,
  scope,
  settings,
  timezone,
}: {
  api: Api;
  scope: string;
  settings: CoachingSettingsV2;
  timezone: string;
}) {
  const { t, i18n } = useTranslation(),
    client = useQueryClient();
  const [connection, setConnection] = useState(''),
    [endpoint, setEndpoint] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: ['coaching', scope, 'connections'],
    queryFn: api.loadCoachingConnections,
  });
  useEffect(() => {
    let active = true;
    void getActiveServerConfig()
      .then((config) => {
        if (active && config)
          setEndpoint(config.url.replace(/\/$/, '') + COACHING_MCP_PATH);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [scope]);
  const prompt = cloudCoachingTaskPrompt(
    settings.reviewTime,
    timezone,
    i18n.language
  );
  return (
    <GlowCard className="gap-4 p-4">
      <Text
        accessibilityRole="header"
        className="text-xl font-semibold text-text-primary"
      >
        {t('coachingLoop.cloudTitle', {
          defaultValue: 'Connect a cloud review',
        })}
      </Text>
      <Text className="text-base text-text-secondary">
        {t('coachingLoop.cloudStep1', {
          defaultValue:
            'In ChatGPT, add the proposal-only coaching MCP address below and approve reading and proposals. The consent screen must show selectable review areas.',
        })}
      </Text>
      <Text selectable className="text-sm text-text-secondary">
        {endpoint}
      </Text>
      <NeonButton
        variant="outline"
        disabled={!endpoint}
        label={t('coachingLoop.copyAddress', {
          defaultValue: 'Copy MCP address',
        })}
        onPress={() => Clipboard.setString(endpoint)}
      />
      <Text className="text-base text-text-secondary">
        {t('coachingLoop.cloudStep2', {
          defaultValue:
            'Refresh this list and choose the authorized connection. The selected data is all it can review; it cannot approve changes.',
        })}
      </Text>
      {query.isError && (
        <Text accessibilityRole="alert" className="text-text-secondary">
          {t('coachingLoop.connectionsError', {
            defaultValue:
              'Connections are unavailable. Check server OAuth configuration and refresh.',
          })}
        </Text>
      )}
      {!query.isPending &&
        !query.isError &&
        !query.data?.connections.length && (
          <Text className="text-sm text-text-secondary">
            {t('coachingLoop.noAuthorizedConnection', {
              defaultValue:
                'No coaching connection is authorized yet. Add the coaching address above in ChatGPT and approve reading and proposals. Reconnecting an older read/write connection may retain its existing permissions.',
            })}
          </Text>
        )}
      <BottomSheetPicker
        title={t('coachingLoop.chooseConnection', {
          defaultValue: 'Authorized ChatGPT connection',
        })}
        value={connection}
        options={(query.data?.connections ?? []).map((item) => ({
          value: item.client_id,
          label: item.name,
        }))}
        onSelect={setConnection}
      />
      <NeonButton
        variant="outline"
        label={t('coaching.retry', { defaultValue: 'Refresh' })}
        onPress={() => {
          void query.refetch();
        }}
      />
      <NeonButton
        disabled={busy || !connection || !settings.domains.length}
        label={t('coachingLoop.bindConnection', {
          defaultValue: 'Use for reviewed coaching',
        })}
        onPress={() => {
          setBusy(true);
          setError(false);
          void api
            .addCoachingAgent({
              name:
                query.data?.connections.find(
                  (item) => item.client_id === connection
                )?.name ?? 'ChatGPT',
              domains: settings.domains,
              oauthClientId: connection,
              protocolVersion: 2,
              contextPermissions: settings.contextPermissions,
            })
            .then(() =>
              client.invalidateQueries({ queryKey: ['coaching', scope] })
            )
            .catch(() => setError(true))
            .finally(() => setBusy(false));
        }}
      />
      {error && (
        <Text accessibilityRole="alert" className="text-text-primary">
          {t('coaching.error', {
            defaultValue: 'Could not save. Refresh and try again.',
          })}
        </Text>
      )}
      <Text className="text-base text-text-secondary">
        {t('coachingLoop.cloudStep3', {
          defaultValue:
            'Test this prompt in a normal ChatGPT conversation using the selected connection. Then create one daily cloud task at the time shown. Scheduling availability depends on your ChatGPT account.',
        })}
      </Text>
      <Text selectable className="text-sm text-text-secondary">
        {prompt}
      </Text>
      <NeonButton
        variant="outline"
        label={
          copied
            ? t('coachingLoop.copied', { defaultValue: 'Copied' })
            : t('coachingLoop.copyPrompt', {
                defaultValue: 'Copy review prompt',
              })
        }
        onPress={() => {
          Clipboard.setString(prompt);
          setCopied(true);
        }}
      />
      <Text className="text-sm text-text-secondary">
        {t('coachingLoop.cloudUnverified', {
          defaultValue:
            'A binding does not confirm a cloud schedule. Verify one unattended run before relying on it. Changing the review time here also requires updating the task in ChatGPT.',
        })}
      </Text>
    </GlowCard>
  );
}
