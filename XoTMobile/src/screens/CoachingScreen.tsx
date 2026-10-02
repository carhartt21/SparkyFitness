import { useCoachingCopy } from '../hooks/useCoachingCopy';
import { useRef, useState } from 'react';
import { Text, View, Switch, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  coachingActionSchema,
  coachingDomainSchema,
  type CoachingProposal,
  type CoachingFeedback,
  type CoachingPreview,
  type CoachingSettings,
  type CoachingDomain,
} from '@workspace/shared';
import type { RootStackParamList } from '../types/navigation';
import { useCoaching } from '../hooks/useCoaching';
import TrackingScreen from '../components/tracking/TrackingScreen';
import GlowCard from '../components/ui/GlowCard';
import NeonButton from '../components/ui/NeonButton';
import FormInput from '../components/FormInput';
import BottomSheetPicker from '../components/BottomSheetPicker';
import { CommitmentFeedback } from '../components/coaching/CommitmentFeedback';
import CoachingFields from '../components/coaching/CoachingFields';
import { useNeonScale } from '../components/tracking/useNeonScale';
import { newUuid } from '../utils/ids';

type Api = ReturnType<typeof useCoaching>['api'];
function Review({
  proposal,
  api,
  scope,
  onClose,
}: {
  proposal: CoachingProposal;
  api: Api;
  scope: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation(),
    client = useQueryClient();
  const [draft, setDraft] = useState(() => z.json().parse(proposal.action)),
    [preview, setPreview] = useState<CoachingPreview | null>(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [showEvidence, setShowEvidence] = useState(false);
  const scale = useNeonScale();
  const operation = useRef<{ fingerprint: string; id: string } | null>(null);
  const evidence = useQuery({
    queryKey: ['coaching', scope, proposal.id, 'evidence'],
    queryFn: () => api.loadCoachingEvidence(proposal.id),
  });
  const parsed = coachingActionSchema.safeParse(draft);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await work();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const decide = (decision: 'accept' | 'decline') =>
    run(async () => {
      if (decision === 'accept' && !preview) return;
      const fingerprint = JSON.stringify({ decision, preview, reason });
      if (operation.current?.fingerprint !== fingerprint)
        operation.current = { fingerprint, id: newUuid() };
      await api.reviewCoaching(
        proposal.id,
        decision === 'accept' && preview
          ? {
              decision,
              operationId: operation.current.id,
              expectedRevision: proposal.revision,
              previewToken: preview.previewToken,
              action: preview.action,
              reason,
            }
          : {
              decision: 'decline',
              operationId: operation.current.id,
              expectedRevision: proposal.revision,
              reason,
            }
      );
      await client.invalidateQueries();
      onClose();
    });
  return (
    <GlowCard glowColor={scale.mint} className="gap-4 p-4">
      <Text
        accessibilityRole="header"
        className="text-xl font-semibold text-text-primary"
      >
        {proposal.title}
      </Text>
      <Text className="text-base text-text-primary">{proposal.rationale}</Text>
      <Text className="text-base text-text-secondary">{proposal.benefit}</Text>
      <NeonButton
        variant="outline"
        label={t('coaching.evidence', {
          defaultValue: 'Evidence and limitations',
        })}
        onPress={() => setShowEvidence(!showEvidence)}
      />
      {showEvidence && (
        <View className="gap-3">
          {proposal.evidence.map((ref, index) => (
            <View key={index}>
              <Text className="text-base text-text-primary">
                {ref.from} – {ref.to} ·{' '}
                {new Intl.NumberFormat(i18n.language, {
                  style: 'percent',
                }).format(ref.coverage)}{' '}
                · {ref.freshness}
              </Text>
              {ref.limitation && (
                <Text className="text-base text-text-secondary">
                  {ref.limitation}
                </Text>
              )}
            </View>
          ))}
          {evidence.isPending && (
            <Text className="text-text-primary">
              {t('coaching.loading', { defaultValue: 'Loading…' })}
            </Text>
          )}
          {evidence.isError && (
            <Text accessibilityRole="alert" className="text-text-primary">
              {t('coaching.evidenceError', {
                defaultValue:
                  'Evidence could not be loaded. Try again before accepting.',
              })}
            </Text>
          )}
          {evidence.data?.map((row) => (
            <View
              key={row.id}
              className="gap-2 rounded-xl border border-border-subtle p-3"
            >
              <Text className="font-semibold text-text-primary">
                {row.kind} · {row.day} · {row.source} · {row.confirmation}
              </Text>
              <CoachingFields
                value={row.value}
                readOnly
                api={api}
                scope={scope}
              />
            </View>
          ))}
        </View>
      )}
      <Text className="text-lg font-semibold text-text-primary">
        {t('coaching.action', { defaultValue: 'Action details' })}
      </Text>
      <CoachingFields
        value={draft}
        action={parsed.success ? parsed.data : proposal.action}
        readOnly={busy}
        api={api}
        scope={scope}
        onChange={(next) => {
          setDraft(next);
          setPreview(null);
        }}
      />
      {!parsed.success && (
        <Text accessibilityRole="alert" className="text-text-primary">
          {t('coaching.invalid', {
            defaultValue:
              'Check the action details, dates, quantities and selected items.',
          })}
        </Text>
      )}
      <Text className="text-base text-text-primary">
        {t('coaching.reason', { defaultValue: 'Your feedback (optional)' })}
      </Text>
      <FormInput
        accessibilityLabel={t('coaching.reason', {
          defaultValue: 'Your feedback (optional)',
        })}
        value={reason}
        onChangeText={setReason}
        maxLength={2000}
      />
      {error && (
        <Text accessibilityRole="alert" className="text-text-primary">
          {t('coaching.error', {
            defaultValue: 'Could not save. Refresh and try again.',
          })}
        </Text>
      )}
      {preview && (
        <View className="gap-4 rounded-xl border border-border-subtle p-3">
          <Text className="text-lg font-semibold text-text-primary">
            {t('coaching.preview', { defaultValue: 'Changes to confirm' })}
          </Text>
          {preview.effects.map((effect, index) => (
            <View key={index} className="gap-3">
              <Text className="font-semibold text-text-primary">
                {t('coaching.before', { defaultValue: 'Before' })} ·{' '}
                {effect.unit}
              </Text>
              <CoachingFields
                value={effect.before}
                readOnly
                api={api}
                scope={scope}
              />
              <Text className="font-semibold text-text-primary">
                {t('coaching.after', { defaultValue: 'After' })}
              </Text>
              <CoachingFields
                value={effect.after}
                readOnly
                api={api}
                scope={scope}
              />
            </View>
          ))}
          {preview.warnings.map((warning) => (
            <Text key={warning} className="text-sm text-text-secondary">
              {warning}
            </Text>
          ))}
        </View>
      )}
      <NeonButton
        disabled={busy || !parsed.success || !evidence.data}
        label={t('coaching.preview', { defaultValue: 'Changes to confirm' })}
        onPress={() => {
          void run(async () => {
            if (parsed.success)
              setPreview(
                await api.previewCoaching(
                  proposal.id,
                  proposal.revision,
                  parsed.data
                )
              );
          });
        }}
      />
      {preview && (
        <NeonButton
          disabled={busy}
          label={t('coaching.accept', { defaultValue: 'Accept and activate' })}
          onPress={() => {
            void decide('accept');
          }}
        />
      )}
      <NeonButton
        disabled={busy}
        variant="outline"
        label={t('coaching.decline', { defaultValue: 'Decline' })}
        onPress={() => {
          void decide('decline');
        }}
      />
      <NeonButton
        variant="subtle"
        label={t('coaching.close', { defaultValue: 'Close' })}
        onPress={onClose}
      />
    </GlowCard>
  );
}
function Settings({ api, scope }: { api: Api; scope: string }) {
  const copy = useCoachingCopy();
  const { t, i18n } = useTranslation(),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ['coaching', scope, 'settings'],
    queryFn: api.loadCoachingSettings,
  });
  const context = useQuery({
    queryKey: ['coaching', scope, 'context'],
    queryFn: api.loadCoachingContext,
    refetchInterval: 60_000,
  });
  const [draft, setDraft] = useState<CoachingSettings | null>(null),
    [name, setName] = useState(''),
    [domains, setDomains] = useState<CoachingDomain[]>([
      ...coachingDomainSchema.options,
    ]),
    [key, setKey] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const settings = draft ?? query.data?.settings;
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await work();
      await client.invalidateQueries();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  if (!settings) return null;
  return (
    <View className="gap-4">
      {error && (
        <Text accessibilityRole="alert" className="text-text-primary">
          {t('coaching.error', {
            defaultValue: 'Could not save. Refresh and try again.',
          })}
        </Text>
      )}
      <GlowCard className="gap-4 p-4">
        <Text className="text-xl font-semibold text-text-primary">
          {t('coaching.schedule', { defaultValue: 'Review schedule' })}
        </Text>
        <Text className="text-base text-text-secondary">
          {t('coaching.timezone', {
            defaultValue: 'Times use your account timezone: {{timezone}}',
            timezone: query.data?.timezone,
          })}
        </Text>
        <View className="gap-2">
          <Text className="text-base text-text-primary">
            {t('coaching.enabled', { defaultValue: 'Enable periodic reviews' })}
          </Text>
          <Switch
            accessibilityLabel={t('coaching.enabled', {
              defaultValue: 'Enable periodic reviews',
            })}
            value={settings.enabled}
            onValueChange={(value) => setDraft({ ...settings, enabled: value })}
          />
        </View>
        <Text className="text-base text-text-secondary">
          {t('coaching.pauseHint', {
            defaultValue:
              'Pausing stops new agent runs. Accepted actions remain available for you to manage.',
          })}
        </Text>
        {(
          ['morningTime', 'eveningTime', 'weeklyTime', 'digestTime'] as const
        ).map((field) => (
          <View key={field} className="gap-2">
            <Text className="text-base text-text-primary">
              {copy(`coaching.${field}`, field)}
            </Text>
            <FormInput
              accessibilityLabel={copy(`coaching.${field}`, field)}
              value={settings[field]}
              onChangeText={(value) =>
                setDraft({ ...settings, [field]: value })
              }
              placeholder="08:00"
            />
          </View>
        ))}
        <BottomSheetPicker
          title={t('coaching.weeklyDay', { defaultValue: 'Weekly review day' })}
          value={settings.weeklyDay}
          options={Array.from({ length: 7 }, (_, day) => ({
            value: day,
            label: new Intl.DateTimeFormat(i18n.language, {
              weekday: 'long',
              timeZone: 'UTC',
            }).format(new Date(Date.UTC(2026, 8, 27 + day))),
          }))}
          onSelect={(value) => setDraft({ ...settings, weeklyDay: value })}
        />
        <Text className="text-base text-text-primary">
          {t('coaching.digestEnabled', {
            defaultValue: 'Notify me when recommendations are waiting',
          })}
        </Text>
        <Switch
          accessibilityLabel={t('coaching.digestEnabled', {
            defaultValue: 'Notify me when recommendations are waiting',
          })}
          value={settings.digestEnabled}
          onValueChange={(value) =>
            setDraft({ ...settings, digestEnabled: value })
          }
        />
        <Text className="text-base text-text-secondary">
          {t('coaching.digestHint', {
            defaultValue:
              'At most one digest each day. Remote notifications must be enabled on a supported phone; quiet hours and your shared daily limit apply.',
          })}
        </Text>
        {coachingDomainSchema.options.map((domain) => (
          <View
            key={domain}
            className="flex-row items-center justify-between gap-3"
          >
            <Text className="flex-1 text-base text-text-primary">
              {copy(`coaching.domains.${domain}`, domain)}
            </Text>
            <Switch
              accessibilityLabel={copy(`coaching.domains.${domain}`, domain)}
              value={settings.domains.includes(domain)}
              onValueChange={(value) =>
                setDraft({
                  ...settings,
                  domains: value
                    ? [...settings.domains, domain]
                    : settings.domains.filter((item) => item !== domain),
                })
              }
            />
          </View>
        ))}
        <NeonButton
          disabled={busy || !settings.domains.length}
          label={t('coaching.save', { defaultValue: 'Save schedule' })}
          onPress={() => {
            void run(async () => {
              const { revision, ...body } = settings;
              await api.saveCoachingSettings({
                ...body,
                expectedRevision: revision,
              });
              setDraft(null);
            });
          }}
        />
      </GlowCard>
      <GlowCard className="gap-4 p-4">
        <Text className="text-xl font-semibold text-text-primary">
          {t('coaching.connections', { defaultValue: 'Agent connections' })}
        </Text>
        <Text className="text-base text-text-secondary">
          {t('coaching.connectionHint', {
            defaultValue:
              'Each connection reads only the selected wellness areas and submits proposals. Review and activation stay in your app account.',
          })}
        </Text>
        {query.data?.agents.map((agent) => (
          <View
            key={agent.id}
            className="gap-2 border-t border-border-subtle pt-3"
          >
            <Text className="font-semibold text-text-primary">
              {agent.name}
            </Text>
            <Text className="text-text-secondary">
              {agent.domains.join(', ')} ·{' '}
              {agent.enabled
                ? t('coaching.connected', { defaultValue: 'Connected' })
                : t('coaching.revoked', { defaultValue: 'Revoked' })}
            </Text>
            <Text className="text-text-secondary">
              {t('coaching.lastSeen', { defaultValue: 'Last contact' })}:{' '}
              {agent.lastSeenAt
                ? new Date(agent.lastSeenAt).toLocaleString(i18n.language)
                : '—'}
            </Text>
            {agent.enabled && agent.credentialKind === 'api_key' && (
              <NeonButton
                disabled={busy}
                variant="outline"
                label={t('coaching.issueKey', {
                  defaultValue: 'Issue or replace key',
                })}
                onPress={() => {
                  void run(async () =>
                    setKey((await api.issueCoachingKey(agent.id)).key)
                  );
                }}
              />
            )}
            {agent.enabled && (
              <NeonButton
                disabled={busy}
                variant="outline"
                label={t('coaching.revoke', {
                  defaultValue: 'Revoke connection',
                })}
                onPress={() => {
                  void run(() => api.revokeCoachingAgent(agent.id));
                }}
              />
            )}
          </View>
        ))}
        {key && (
          <View className="gap-3 rounded-xl border border-border-subtle p-3">
            <Text className="text-text-primary">
              {t('coaching.keyOnce', {
                defaultValue:
                  'Save this key now. It is shown once and expires in 90 days. Use it in the Mac runner configuration.',
              })}
            </Text>
            <Text selectable className="text-base text-text-primary">
              {key}
            </Text>
            <NeonButton
              variant="outline"
              label={t('coaching.hideKey', { defaultValue: 'I saved the key' })}
              onPress={() => setKey(null)}
            />
          </View>
        )}
        <FormInput
          accessibilityLabel={t('coaching.agentName', {
            defaultValue: 'Connection name',
          })}
          placeholder={t('coaching.agentName', {
            defaultValue: 'Connection name',
          })}
          value={name}
          onChangeText={setName}
        />
        {coachingDomainSchema.options.map((domain) => (
          <View
            key={domain}
            className="flex-row items-center justify-between gap-3"
          >
            <Text className="flex-1 text-base text-text-primary">
              {copy(`coaching.domains.${domain}`, domain)}
            </Text>
            <Switch
              accessibilityLabel={copy(`coaching.domains.${domain}`, domain)}
              value={domains.includes(domain)}
              onValueChange={(value) =>
                setDomains(
                  value
                    ? [...domains, domain]
                    : domains.filter((item) => item !== domain)
                )
              }
            />
          </View>
        ))}
        <NeonButton
          disabled={busy || !name.trim() || !domains.length}
          label={t('coaching.addAgent', { defaultValue: 'Add connection' })}
          onPress={() => {
            void run(async () => {
              await api.addCoachingAgent({ name, domains });
              setName('');
            });
          }}
        />
      </GlowCard>
      <GlowCard className="gap-3 p-4">
        <Text className="text-xl font-semibold text-text-primary">
          {t('coaching.status', { defaultValue: 'Recent reviews' })}
        </Text>
        {context.data?.runs.map((run) => (
          <Text key={run.id} className="text-base text-text-primary">
            {run.from} – {run.to} ·{' '}
            {copy(`coaching.options.${run.status}`, run.status)}{' '}
            {run.failureCode
              ? copy(`coaching.options.${run.failureCode}`, run.failureCode)
              : ''}
          </Text>
        ))}
      </GlowCard>
    </View>
  );
}
function Inbox({
  api,
  scope,
  navigation,
}: {
  api: Api;
  scope: string;
  navigation: NativeStackScreenProps<
    RootStackParamList,
    'Coaching'
  >['navigation'];
}) {
  const [feedback, setFeedback] = useState<Record<string, CoachingFeedback>>(
    {}
  );
  const copy = useCoachingCopy();
  const { t, i18n } = useTranslation(),
    client = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'active' | 'history' | 'settings'>(
      'pending'
    ),
    [domain, setDomain] = useState(''),
    [selected, setSelected] = useState<CoachingProposal | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const settings = useQuery({
    queryKey: ['coaching', scope, 'settings'],
    queryFn: api.loadCoachingSettings,
  });
  const query = useInfiniteQuery({
    queryKey: ['coaching', scope, 'inbox', tab, domain],
    initialPageParam: 0,
    enabled: tab !== 'settings' && !!settings.data?.featureEnabled,
    queryFn: ({ pageParam }) =>
      api.loadCoachingInbox(
        pageParam,
        tab === 'active' || tab === 'history' ? tab : 'pending',
        domain || undefined
      ),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
  const scale = useNeonScale();
  const proposals = query.data?.pages.flatMap((page) => page.proposals) ?? [],
    actions = query.data?.pages.flatMap((page) => page.commitments) ?? [];
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await work();
      await client.invalidateQueries();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <TrackingScreen
      title={t('coaching.title', { defaultValue: 'Recommendations' })}
      subtitle={t('coaching.intro', {
        defaultValue:
          'Review suggestions based on your recorded data. You decide which actions become part of your plan.',
      })}
      onBack={() => navigation.goBack()}
      onRefresh={() => client.invalidateQueries()}
      testID="coaching-screen"
    >
      <View className="gap-4">
        {(query.isError || settings.isError || error) && (
          <Text
            accessibilityRole="alert"
            className="text-base text-text-primary"
          >
            {t('coaching.ownerError', {
              defaultValue:
                'Sign in to your own account with an app session to review recommendations. If the connection failed, refresh and try again.',
            })}
          </Text>
        )}
        {settings.isPending && (
          <Text className="text-base text-text-primary">
            {t('coaching.loading', { defaultValue: 'Loading…' })}
          </Text>
        )}
        {settings.data && !settings.data.featureEnabled ? (
          <Text className="text-base text-text-primary">
            {t('coaching.unavailable', {
              defaultValue:
                'Recommendations are not enabled on this server yet.',
            })}
          </Text>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2">
              {(['pending', 'active', 'history', 'settings'] as const).map(
                (value) => (
                  <NeonButton
                    key={value}
                    variant={tab === value ? 'primary' : 'outline'}
                    label={copy(`coaching.tabs.${value}`, value)}
                    onPress={() => {
                      setTab(value);
                      setSelected(null);
                    }}
                  />
                )
              )}
            </View>
            <NeonButton
              disabled={busy || !settings.data?.settings.enabled}
              variant="outline"
              label={t('coaching.request', {
                defaultValue: 'Request a review',
              })}
              onPress={() => {
                void run(() => api.requestCoaching());
              }}
            />
            {tab === 'settings' ? (
              <Settings api={api} scope={scope} />
            ) : (
              <>
                <BottomSheetPicker
                  title={t('coaching.domain', {
                    defaultValue: 'Wellness area',
                  })}
                  value={domain}
                  options={[
                    {
                      value: '',
                      label: t('coaching.allDomains', {
                        defaultValue: 'All areas',
                      }),
                    },
                    ...coachingDomainSchema.options.map((value) => ({
                      value,
                      label: copy(`coaching.domains.${value}`, value),
                    })),
                  ]}
                  onSelect={setDomain}
                />
                {selected && (
                  <Review
                    key={selected.id}
                    proposal={selected}
                    api={api}
                    scope={scope}
                    onClose={() => setSelected(null)}
                  />
                )}
                {tab === 'active'
                  ? actions
                      .filter((action) => action.status === 'active')
                      .map((action) => (
                        <GlowCard
                          key={action.id}
                          glowColor={scale.green}
                          className="gap-3 p-4"
                        >
                          <Text className="text-xl font-semibold text-text-primary">
                            {'title' in action.action
                              ? action.action.title
                              : (proposals.find(
                                  (p) => p.id === action.proposalId
                                )?.title ?? action.action.kind)}
                          </Text>
                          <Text className="text-base text-text-primary">
                            {copy(
                              `coaching.options.${action.success.metric}`,
                              action.success.metric
                            )}
                            : {action.success.target} {action.success.unit} ·{' '}
                            {action.success.reviewDay}
                          </Text>
                          {action.outcome && (
                            <Text className="text-base text-text-secondary">
                              {copy(
                                `coaching.options.${action.outcome.interpretation}`,
                                action.outcome.interpretation
                              )}{' '}
                              · {action.outcome.value ?? '—'} ·{' '}
                              {new Intl.NumberFormat(i18n.language, {
                                style: 'percent',
                              }).format(action.outcome.coverage)}
                            </Text>
                          )}
                          <CoachingFields
                            value={z.json().parse(action.action)}
                            readOnly
                            api={api}
                            scope={scope}
                          />
                          <CommitmentFeedback
                            value={feedback[action.id] ?? {}}
                            onChange={(next) =>
                              setFeedback({ ...feedback, [action.id]: next })
                            }
                          />
                          {(action.action.kind === 'task'
                            ? (['completed', 'skipped', 'stopped'] as const)
                            : (['skipped', 'stopped'] as const)
                          ).map((status) => (
                            <NeonButton
                              key={status}
                              disabled={busy}
                              variant="outline"
                              label={copy(
                                status === 'completed'
                                  ? 'coaching.complete'
                                  : status === 'skipped'
                                    ? 'coaching.skip'
                                    : 'coaching.stop',
                                status
                              )}
                              onPress={() => {
                                void run(() =>
                                  api.updateCoachingAction(action.id, {
                                    operationId: newUuid(),
                                    ...feedback[action.id],
                                    expectedRevision: action.revision,
                                    status,
                                  })
                                );
                              }}
                            />
                          ))}
                          <Text className="text-sm text-text-secondary">
                            {t('coaching.stopHint', {
                              defaultValue:
                                'Stopping tracking closes this commitment and its task reminders. Manage accepted habits and plans in their usual app screens.',
                            })}
                          </Text>
                        </GlowCard>
                      ))
                  : proposals
                      .filter((proposal) =>
                        tab === 'history' ? proposal.status !== 'pending' : true
                      )
                      .map((proposal) => (
                        <GlowCard
                          key={proposal.id}
                          glowColor={
                            proposal.impact >= 4 ? scale.mint : undefined
                          }
                          className="gap-3 p-4"
                        >
                          <Text className="text-sm text-text-secondary">
                            {copy(
                              `coaching.domains.${proposal.domain}`,
                              proposal.domain
                            )}{' '}
                            · {t('coaching.impact', { defaultValue: 'Impact' })}{' '}
                            {proposal.impact}/5
                          </Text>
                          <Text className="text-xl font-semibold text-text-primary">
                            {proposal.title}
                          </Text>
                          <Text className="text-base text-text-primary">
                            {proposal.benefit}
                          </Text>
                          <Text className="text-sm text-text-secondary">
                            {proposal.effort} ·{' '}
                            {copy(
                              `coaching.options.${proposal.status}`,
                              proposal.status
                            )}{' '}
                            · {proposal.expiresDay}
                          </Text>
                          {tab === 'pending' ? (
                            <NeonButton
                              label={t('coaching.review', {
                                defaultValue: 'Review recommendation',
                              })}
                              onPress={() => setSelected(proposal)}
                            />
                          ) : (
                            <>
                              <Text className="text-base text-text-secondary">
                                {proposal.rationale}
                              </Text>
                              {proposal.status === 'declined' && (
                                <NeonButton
                                  disabled={busy}
                                  variant="outline"
                                  label={t('coaching.reconsider', {
                                    defaultValue: 'Reconsider this topic',
                                  })}
                                  onPress={() => {
                                    void run(() =>
                                      api.requestCoaching([proposal.topic])
                                    );
                                  }}
                                />
                              )}
                              <NeonButton
                                disabled={
                                  busy ||
                                  actions.some(
                                    (a) =>
                                      a.proposalId === proposal.id &&
                                      a.status === 'active'
                                  )
                                }
                                variant="subtle"
                                label={t('coaching.delete', {
                                  defaultValue: 'Delete review history',
                                })}
                                onPress={() => {
                                  Alert.alert(
                                    t('coaching.delete', {
                                      defaultValue: 'Delete review history',
                                    }),
                                    t('coaching.deleteConfirm', {
                                      defaultValue:
                                        'Delete this recommendation and its retained evidence and history permanently? Diary entries and accepted configurations are kept.',
                                    }),
                                    [
                                      {
                                        text: t('common.cancel', {
                                          defaultValue: 'Cancel',
                                        }),
                                        style: 'cancel',
                                      },
                                      {
                                        text: t('coaching.delete', {
                                          defaultValue: 'Delete review history',
                                        }),
                                        style: 'destructive',
                                        onPress: () => {
                                          void run(() =>
                                            api.deleteCoachingHistory(
                                              proposal.id
                                            )
                                          );
                                        },
                                      },
                                    ]
                                  );
                                }}
                              />
                            </>
                          )}
                        </GlowCard>
                      ))}
                {!query.isPending &&
                  !(tab === 'active'
                    ? actions.some((action) => action.status === 'active')
                    : proposals.some((proposal) =>
                        tab === 'history' ? proposal.status !== 'pending' : true
                      )) && (
                    <Text className="text-base text-text-secondary">
                      {t('coaching.empty', {
                        defaultValue:
                          'Set up an agent connection and review schedule. New recommendations will appear here after a successful review.',
                      })}
                    </Text>
                  )}
                {query.hasNextPage && (
                  <NeonButton
                    variant="outline"
                    label={t('coaching.more', { defaultValue: 'Load more' })}
                    onPress={() => {
                      void query.fetchNextPage();
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
      </View>
    </TrackingScreen>
  );
}
export default function CoachingScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Coaching'>) {
  const { api, scope } = useCoaching(),
    { t } = useTranslation();
  if (!scope)
    return (
      <TrackingScreen
        title={t('coaching.title', { defaultValue: 'Recommendations' })}
        subtitle={t('coaching.ownerOnly', {
          defaultValue: 'Switch to your own account to review recommendations.',
        })}
        onBack={() => navigation.goBack()}
        testID="coaching-signin"
      >
        <Text className="text-base text-text-primary">
          {t('coaching.loading', { defaultValue: 'Loading…' })}
        </Text>
      </TrackingScreen>
    );
  return <Inbox key={scope} api={api} scope={scope} navigation={navigation} />;
}
