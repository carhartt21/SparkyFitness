import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  coachingActionSchema,
  coachingDomainSchema,
  type CoachingProposal,
  type CoachingFeedback,
  type CoachingPreview,
} from '@workspace/shared';
import {
  useCoachingSettings,
  useCoachingActions,
  useCoachingEvidence,
  useCoachingInbox,
  useCoachingRefresh,
} from '@/hooks/Coaching/useCoaching';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { Button } from '@/components/ui/button';
import { GlowCard } from '@/components/ui/glow-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionFields } from './ActionFields';
import { CommitmentFeedback } from './CommitmentFeedback';
import { CoachingSettings } from './CoachingSettings';

function ProposalReview({
  proposal,
  onClose,
}: {
  proposal: CoachingProposal;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation(),
    refresh = useCoachingRefresh();
  const [draft, setDraft] = useState(() => z.json().parse(proposal.action)),
    [preview, setPreview] = useState<CoachingPreview | null>(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const operation = useRef<{ fingerprint: string; id: string } | null>(null);
  const { previewCoaching, reviewCoaching } = useCoachingActions();
  const evidence = useCoachingEvidence(proposal.id);
  const parsed = coachingActionSchema.safeParse(draft);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t('coaching.error', {
              defaultValue: 'Could not save. Refresh and try again.',
            })
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = (decision: 'accept' | 'decline') =>
    run(async () => {
      if (decision === 'accept' && !preview) return;
      const fingerprint = JSON.stringify({ decision, preview, reason });
      if (operation.current?.fingerprint !== fingerprint)
        operation.current = { fingerprint, id: crypto.randomUUID() };
      const body =
        decision === 'accept' && preview
          ? {
              decision: 'accept' as const,
              operationId: operation.current.id,
              expectedRevision: proposal.revision,
              previewToken: preview.previewToken,
              action: preview.action,
              reason,
            }
          : {
              decision: 'decline' as const,
              operationId: operation.current.id,
              expectedRevision: proposal.revision,
              reason,
            };
      await reviewCoaching(proposal.id, body);
      await refresh();
      onClose();
    });
  return (
    <GlowCard
      as="section"
      tone="mint"
      className="space-y-5 p-4 md:p-6"
      aria-label={t('coaching.review', {
        defaultValue: 'Review recommendation',
      })}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-semibold">{proposal.title}</h2>
        <Button variant="ghost" onClick={onClose}>
          {t('coaching.close', { defaultValue: 'Close' })}
        </Button>
      </div>
      <p>{proposal.rationale}</p>
      <p className="text-muted-foreground">{proposal.benefit}</p>
      <details>
        <summary className="min-h-11 cursor-pointer font-medium">
          {t('coaching.evidence', { defaultValue: 'Evidence and limitations' })}
        </summary>
        <div className="space-y-3 pt-3">
          {proposal.evidence.map((ref, index) => (
            <div key={index}>
              <p>
                {ref.from} – {ref.to} ·{' '}
                {new Intl.NumberFormat(i18n.language, {
                  style: 'percent',
                }).format(ref.coverage)}{' '}
                · {ref.freshness}
              </p>
              {ref.limitation && <p>{ref.limitation}</p>}
            </div>
          ))}
          {evidence.isPending && (
            <p role="status">
              {t('coaching.loading', { defaultValue: 'Loading…' })}
            </p>
          )}
          {evidence.isError && (
            <p role="alert">
              {t('coaching.evidenceError', {
                defaultValue:
                  'Evidence could not be loaded. Try again before accepting.',
              })}
            </p>
          )}
          {evidence.data?.map((row) => (
            <details key={row.id} className="rounded-lg border p-3">
              <summary className="break-words">
                {row.kind} · {row.day ?? '—'} · {row.source} ·{' '}
                {row.confirmation}
              </summary>
              <ActionFields value={row.value} readOnly />
            </details>
          ))}
        </div>
      </details>
      <h3 className="font-semibold">
        {t('coaching.action', { defaultValue: 'Action details' })}
      </h3>
      <ActionFields
        value={draft}
        action={parsed.success ? parsed.data : proposal.action}
        onChange={(next) => {
          setDraft(next);
          setPreview(null);
        }}
      />
      {!parsed.success && (
        <p role="alert" className="text-destructive">
          {t('coaching.invalid', {
            defaultValue:
              'Check the action details, dates, quantities and selected items.',
          })}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="coaching-reason">
          {t('coaching.reason', { defaultValue: 'Your feedback (optional)' })}
        </Label>
        <Input
          id="coaching-reason"
          value={reason}
          maxLength={2000}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {preview && (
        <section className="space-y-4 rounded-xl border p-4" aria-live="polite">
          <h3 className="font-semibold">
            {t('coaching.preview', { defaultValue: 'Changes to confirm' })}
          </h3>
          {preview.effects.map((effect, index) => (
            <div
              key={index}
              className="grid gap-4 border-b pb-4 sm:grid-cols-2"
            >
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  {t('coaching.before', { defaultValue: 'Before' })}{' '}
                  {effect.unit ?? ''}
                </h4>
                <ActionFields
                  field={effect.label.replace('goals.', '')}
                  value={effect.before}
                  readOnly
                />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  {t('coaching.after', { defaultValue: 'After' })}{' '}
                  {effect.unit ?? ''}
                </h4>
                <ActionFields
                  field={effect.label.replace('goals.', '')}
                  value={effect.after}
                  readOnly
                />
              </div>
            </div>
          ))}
          {preview.warnings.map((warning) => (
            <p key={warning} className="text-sm text-muted-foreground">
              {warning}
            </p>
          ))}
        </section>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={
            busy || !parsed.success || evidence.isError || evidence.isPending
          }
          onClick={() =>
            run(async () => {
              if (parsed.success)
                setPreview(
                  await previewCoaching(
                    proposal.id,
                    proposal.revision,
                    parsed.data
                  )
                );
            })
          }
        >
          {t('coaching.preview', { defaultValue: 'Changes to confirm' })}
        </Button>
        {preview && (
          <Button disabled={busy} onClick={() => submit('accept')}>
            {t('coaching.accept', { defaultValue: 'Accept and activate' })}
          </Button>
        )}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => submit('decline')}
        >
          {t('coaching.decline', { defaultValue: 'Decline' })}
        </Button>
      </div>
    </GlowCard>
  );
}
export default function Coaching() {
  const { activeUserId } = useActiveUser();
  return <CoachingInbox key={activeUserId} />;
}
function CoachingInbox() {
  const [feedback, setFeedback] = useState<Record<string, CoachingFeedback>>(
    {}
  );
  const { t, i18n } = useTranslation(),
    { isActingOnBehalf } = useActiveUser(),
    refresh = useCoachingRefresh();
  const [tab, setTab] = useState<'pending' | 'active' | 'history' | 'settings'>(
      'pending'
    ),
    [domain, setDomain] = useState(''),
    [selected, setSelected] = useState<CoachingProposal | null>(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  const settings = useCoachingSettings();
  const { updateCoachingAction, deleteCoachingHistory, requestCoaching } =
    useCoachingActions();
  const query = useCoachingInbox(tab, domain, !!settings.data?.featureEnabled);
  const proposals = query.data?.pages.flatMap((page) => page.proposals) ?? [],
    commitments = query.data?.pages.flatMap((page) => page.commitments) ?? [];
  const act = async (work: () => Promise<unknown>) => {
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
  if (isActingOnBehalf)
    return (
      <main className="p-6">
        <p role="status">
          {t('coaching.ownerOnly', {
            defaultValue:
              'Switch to your own account to review recommendations.',
          })}
        </p>
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 [&_button]:min-h-11 [&_input]:min-h-11">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">
            {t('coaching.eyebrow', { defaultValue: 'Your next step' })}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            {t('coaching.title', { defaultValue: 'Recommendations' })}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {t('coaching.intro', {
              defaultValue:
                'Review suggestions based on your recorded data. You decide which actions become part of your plan.',
            })}
          </p>
        </div>
        {settings.data?.featureEnabled && (
          <Button
            variant="outline"
            disabled={busy || !settings.data.settings.enabled}
            onClick={() => act(() => requestCoaching())}
          >
            {t('coaching.request', { defaultValue: 'Request a review' })}
          </Button>
        )}
      </header>
      {(settings.isError || query.isError || error) && (
        <div role="alert" className="rounded-xl border border-destructive p-4">
          <p>
            {t('coaching.error', {
              defaultValue: 'Could not save. Refresh and try again.',
            })}
          </p>
          <Button variant="outline" onClick={() => refresh()}>
            {t('coaching.retry', { defaultValue: 'Refresh' })}
          </Button>
        </div>
      )}
      {settings.isPending ? (
        <p role="status">
          {t('coaching.loading', { defaultValue: 'Loading…' })}
        </p>
      ) : settings.data && !settings.data.featureEnabled ? (
        <GlowCard className="p-6">
          <p>
            {t('coaching.unavailable', {
              defaultValue:
                'Recommendations are not enabled on this server yet.',
            })}
          </p>
        </GlowCard>
      ) : (
        <>
          <nav
            className="flex flex-wrap gap-2"
            aria-label={t('coaching.views', {
              defaultValue: 'Recommendation views',
            })}
          >
            {(['pending', 'active', 'history', 'settings'] as const).map(
              (value) => (
                <Button
                  key={value}
                  variant={tab === value ? 'default' : 'outline'}
                  aria-pressed={tab === value}
                  onClick={() => {
                    setTab(value);
                    setSelected(null);
                  }}
                >
                  {t(`coaching.tabs.${value}`, {
                    defaultValue:
                      value === 'pending'
                        ? 'New'
                        : value === 'active'
                          ? 'Active'
                          : value === 'history'
                            ? 'History'
                            : 'Schedule & connections',
                  })}
                </Button>
              )
            )}
          </nav>
          {tab === 'settings' ? (
            <CoachingSettings />
          ) : (
            <>
              <div className="max-w-xs space-y-2">
                <Label htmlFor="coaching-domain">
                  {t('coaching.domain', { defaultValue: 'Wellness area' })}
                </Label>
                <select
                  id="coaching-domain"
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                  value={domain}
                  onChange={(event) => {
                    setDomain(event.target.value);
                    setSelected(null);
                  }}
                >
                  <option value="">
                    {t('coaching.allDomains', { defaultValue: 'All areas' })}
                  </option>
                  {coachingDomainSchema.options.map((value) => (
                    <option key={value} value={value}>
                      {t(`coaching.domains.${value}`, { defaultValue: value })}
                    </option>
                  ))}
                </select>
              </div>
              {selected && (
                <ProposalReview
                  key={selected.id}
                  proposal={selected}
                  onClose={() => setSelected(null)}
                />
              )}
              {query.isPending && (
                <p role="status">
                  {t('coaching.loading', { defaultValue: 'Loading…' })}
                </p>
              )}
              {tab === 'active' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {commitments
                    .filter((item) => item.status === 'active')
                    .map((item) => (
                      <GlowCard
                        key={item.id}
                        as="article"
                        tone="green"
                        className="space-y-4 p-5"
                      >
                        <h2 className="text-lg font-semibold">
                          {'title' in item.action
                            ? item.action.title
                            : 'definition' in item.action &&
                                'name' in item.action.definition
                              ? item.action.definition.name
                              : (proposals.find((p) => p.id === item.proposalId)
                                  ?.title ?? item.action.kind)}
                        </h2>
                        <p>
                          {t(`coaching.options.${item.success.metric}`, {
                            defaultValue: item.success.metric,
                          })}{' '}
                          ·{' '}
                          {new Intl.NumberFormat(i18n.language).format(
                            item.success.target
                          )}{' '}
                          {item.success.unit} · {item.success.reviewDay}
                        </p>
                        {item.outcome && (
                          <p>
                            {t(
                              `coaching.options.${item.outcome.interpretation}`,
                              { defaultValue: item.outcome.interpretation }
                            )}{' '}
                            ·{' '}
                            {item.outcome.value === null
                              ? '—'
                              : new Intl.NumberFormat(i18n.language, {
                                  maximumFractionDigits: 2,
                                }).format(item.outcome.value)}{' '}
                            ·{' '}
                            {new Intl.NumberFormat(i18n.language, {
                              style: 'percent',
                            }).format(item.outcome.coverage)}
                          </p>
                        )}
                        <details>
                          <summary className="min-h-11 cursor-pointer">
                            {t('coaching.action', {
                              defaultValue: 'Action details',
                            })}
                          </summary>
                          <ActionFields
                            value={z.json().parse(item.action)}
                            readOnly
                          />
                        </details>
                        <CommitmentFeedback
                          value={feedback[item.id] ?? {}}
                          onChange={(next) =>
                            setFeedback({ ...feedback, [item.id]: next })
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          {item.action.kind === 'task' && (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                act(() =>
                                  updateCoachingAction(item.id, {
                                    operationId: crypto.randomUUID(),
                                    ...feedback[item.id],
                                    expectedRevision: item.revision,
                                    status: 'completed',
                                  })
                                )
                              }
                            >
                              {t('coaching.complete', {
                                defaultValue: 'Mark task done',
                              })}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              act(() =>
                                updateCoachingAction(item.id, {
                                  operationId: crypto.randomUUID(),
                                  ...feedback[item.id],
                                  expectedRevision: item.revision,
                                  status: 'skipped',
                                })
                              )
                            }
                          >
                            {t('coaching.skip', { defaultValue: 'Skip' })}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              act(() =>
                                updateCoachingAction(item.id, {
                                  operationId: crypto.randomUUID(),
                                  ...feedback[item.id],
                                  expectedRevision: item.revision,
                                  status: 'stopped',
                                })
                              )
                            }
                          >
                            {t('coaching.stop', {
                              defaultValue: 'Stop tracking',
                            })}
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('coaching.stopHint', {
                            defaultValue:
                              'Stopping tracking closes this commitment and its task reminders. Manage accepted habits and plans in their usual app screens.',
                          })}
                        </p>
                      </GlowCard>
                    ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {proposals
                    .filter((item) =>
                      tab === 'history' ? item.status !== 'pending' : true
                    )
                    .map((item) => (
                      <GlowCard
                        key={item.id}
                        as="article"
                        tone={item.impact >= 4 ? 'mint' : undefined}
                        className="flex flex-col items-start gap-3 p-5"
                      >
                        <div className="flex w-full flex-wrap justify-between gap-2 text-sm text-muted-foreground">
                          <span>
                            {t(`coaching.domains.${item.domain}`, {
                              defaultValue: item.domain,
                            })}
                          </span>
                          <span>
                            {t('coaching.impact', { defaultValue: 'Impact' })}{' '}
                            {item.impact}/5
                          </span>
                        </div>
                        <h2 className="text-xl font-semibold">{item.title}</h2>
                        <p className="flex-1">{item.benefit}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.effort} ·{' '}
                          {new Intl.NumberFormat(i18n.language, {
                            style: 'percent',
                          }).format(item.confidence)}{' '}
                          ·{' '}
                          {item.status === 'pending'
                            ? item.expiresDay
                            : item.status}
                        </p>
                        {tab === 'pending' ? (
                          <Button
                            onClick={() => {
                              setSelected(item);
                              window.scrollTo({ top: 0, behavior: 'instant' });
                            }}
                          >
                            {t('coaching.review', {
                              defaultValue: 'Review recommendation',
                            })}
                          </Button>
                        ) : (
                          <>
                            <details>
                              <summary className="min-h-11 cursor-pointer">
                                {t('coaching.evidence', {
                                  defaultValue: 'Evidence and limitations',
                                })}
                              </summary>
                              <p>{item.rationale}</p>
                              {item.evidence.map((e, i) => (
                                <p key={i}>
                                  {e.from} – {e.to}: {e.limitation}
                                </p>
                              ))}
                              <ActionFields
                                value={z
                                  .json()
                                  .parse(item.acceptedAction ?? item.action)}
                                readOnly
                              />
                            </details>
                            {item.status === 'declined' && (
                              <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  act(() => requestCoaching([item.topic]))
                                }
                              >
                                {t('coaching.reconsider', {
                                  defaultValue: 'Reconsider this topic',
                                })}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              disabled={
                                busy ||
                                commitments.some(
                                  (a) =>
                                    a.proposalId === item.id &&
                                    a.status === 'active'
                                )
                              }
                              onClick={() => {
                                if (
                                  window.confirm(
                                    t('coaching.deleteConfirm', {
                                      defaultValue:
                                        'Delete this recommendation and its retained evidence and history permanently? Diary entries and accepted configurations are kept.',
                                    })
                                  )
                                )
                                  void act(() =>
                                    deleteCoachingHistory(item.id)
                                  );
                              }}
                            >
                              {t('coaching.delete', {
                                defaultValue: 'Delete review history',
                              })}
                            </Button>
                          </>
                        )}
                      </GlowCard>
                    ))}
                </div>
              )}
              {!query.isPending &&
                !(tab === 'active'
                  ? commitments.some((item) => item.status === 'active')
                  : proposals.some((item) =>
                      tab === 'history' ? item.status !== 'pending' : true
                    )) && (
                  <GlowCard className="space-y-2 p-6">
                    <h2 className="font-semibold">
                      {t('coaching.emptyTitle', {
                        defaultValue: 'Nothing here yet',
                      })}
                    </h2>
                    <p className="text-muted-foreground">
                      {t('coaching.empty', {
                        defaultValue:
                          'Set up an agent connection and review schedule. New recommendations will appear here after a successful review.',
                      })}
                    </p>
                  </GlowCard>
                )}
              {query.hasNextPage && (
                <Button
                  variant="outline"
                  disabled={query.isFetchingNextPage}
                  onClick={() => query.fetchNextPage()}
                >
                  {t('coaching.more', { defaultValue: 'Load more' })}
                </Button>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
